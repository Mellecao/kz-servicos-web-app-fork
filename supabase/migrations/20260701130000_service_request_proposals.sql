-- +goose Up

-- -----------------------------------------------------------------------------
-- Service request status expansion
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'awaiting_client_confirmation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'awaiting_provider_confirmation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Candidate status enum
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.service_request_provider_candidate_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Service request provider candidates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_request_provider_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  provider_profile_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  status public.service_request_provider_candidate_status NOT NULL DEFAULT 'pending',
  offered_price numeric(10,2),
  admin_approved boolean NOT NULL DEFAULT false,
  price_rejection_reason text,
  price_rejected_at timestamptz,
  kz_proposed_price numeric(10,2),
  kz_proposed_at timestamptz,
  kz_proposal_locked boolean NOT NULL DEFAULT false,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_request_id, provider_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_service_request_provider_candidates_request_id
  ON public.service_request_provider_candidates (service_request_id);

CREATE INDEX IF NOT EXISTS idx_service_request_provider_candidates_provider_profile_id
  ON public.service_request_provider_candidates (provider_profile_id);

CREATE INDEX IF NOT EXISTS idx_service_request_provider_candidates_admin_approved
  ON public.service_request_provider_candidates (service_request_id, admin_approved);

CREATE INDEX IF NOT EXISTS idx_service_request_provider_candidates_kz_proposal_locked
  ON public.service_request_provider_candidates (service_request_id, kz_proposal_locked);

ALTER TABLE public.service_request_provider_candidates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_service_request_provider_candidates_updated_at
  ON public.service_request_provider_candidates;
CREATE TRIGGER trg_service_request_provider_candidates_updated_at
  BEFORE UPDATE ON public.service_request_provider_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_service_request_provider_candidate_for_current_user(
  p_service_request_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_request_provider_candidates srpc
    JOIN public.provider_profiles pp ON pp.id = srpc.provider_profile_id
    WHERE srpc.service_request_id = p_service_request_id
      AND pp.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_service_request_provider_candidate_for_current_user(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.select_service_request_provider(
  p_service_request_id uuid,
  p_provider_profile_id uuid,
  p_offered_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.service_requests
  SET provider_profile_id = p_provider_profile_id,
      final_price = p_offered_price,
      status = 'awaiting_client_confirmation'
  WHERE id = p_service_request_id
    AND status = 'searching_provider';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request % is not in searching_provider status', p_service_request_id;
  END IF;

  UPDATE public.service_request_provider_candidates
  SET status = 'accepted',
      admin_approved = true,
      offered_price = p_offered_price,
      responded_at = NOW()
  WHERE service_request_id = p_service_request_id
    AND provider_profile_id = p_provider_profile_id;

  UPDATE public.service_request_provider_candidates
  SET status = 'rejected',
      responded_at = NOW()
  WHERE service_request_id = p_service_request_id
    AND provider_profile_id != p_provider_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_service_request_provider(uuid, uuid, numeric)
TO authenticated;

CREATE OR REPLACE FUNCTION public.require_service_request_provider_recheck_before_assigned()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'assigned'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status IN ('searching_provider', 'awaiting_client_confirmation')
     AND NEW.provider_profile_id IS NOT NULL THEN
    NEW.status := 'awaiting_provider_confirmation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_service_request_provider_recheck_before_assigned
  ON public.service_requests;
CREATE TRIGGER trg_require_service_request_provider_recheck_before_assigned
  BEFORE UPDATE OF status, provider_profile_id ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.require_service_request_provider_recheck_before_assigned();

CREATE OR REPLACE FUNCTION public.reject_service_request_candidates_when_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.service_request_provider_candidates
    SET status = 'rejected',
        responded_at = COALESCE(responded_at, NOW()),
        observations = COALESCE(observations, 'Solicitação cancelada pela KZ')
    WHERE service_request_id = NEW.id
      AND status IN ('pending', 'accepted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_service_request_candidates_when_cancelled
  ON public.service_requests;
CREATE TRIGGER trg_reject_service_request_candidates_when_cancelled
  AFTER UPDATE OF status ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_service_request_candidates_when_cancelled();

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_request_provider_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_request_provider_candidates;
  END IF;
END $$;

ALTER TABLE public.service_request_provider_candidates REPLICA IDENTITY FULL;

-- -----------------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS service_request_provider_candidates_select
  ON public.service_request_provider_candidates;
CREATE POLICY service_request_provider_candidates_select
ON public.service_request_provider_candidates
FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.service_requests sr
    WHERE sr.id = service_request_id
      AND sr.client_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_profile_id
      AND pp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS service_request_provider_candidates_insert
  ON public.service_request_provider_candidates;
CREATE POLICY service_request_provider_candidates_insert
ON public.service_request_provider_candidates
FOR INSERT TO authenticated
WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS service_request_provider_candidates_update
  ON public.service_request_provider_candidates;
CREATE POLICY service_request_provider_candidates_update
ON public.service_request_provider_candidates
FOR UPDATE TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_profile_id
      AND pp.user_id = auth.uid()
  )
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_profile_id
      AND pp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS service_request_provider_candidates_delete
  ON public.service_request_provider_candidates;
CREATE POLICY service_request_provider_candidates_delete
ON public.service_request_provider_candidates
FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_profile_id
      AND pp.user_id = auth.uid()
  )
);

-- +goose Down

DROP POLICY IF EXISTS service_request_provider_candidates_delete
  ON public.service_request_provider_candidates;
DROP POLICY IF EXISTS service_request_provider_candidates_update
  ON public.service_request_provider_candidates;
DROP POLICY IF EXISTS service_request_provider_candidates_insert
  ON public.service_request_provider_candidates;
DROP POLICY IF EXISTS service_request_provider_candidates_select
  ON public.service_request_provider_candidates;

DROP TRIGGER IF EXISTS trg_reject_service_request_candidates_when_cancelled
  ON public.service_requests;
DROP FUNCTION IF EXISTS public.reject_service_request_candidates_when_cancelled();

DROP TRIGGER IF EXISTS trg_require_service_request_provider_recheck_before_assigned
  ON public.service_requests;
DROP FUNCTION IF EXISTS public.require_service_request_provider_recheck_before_assigned();

REVOKE EXECUTE ON FUNCTION public.select_service_request_provider(uuid, uuid, numeric)
FROM authenticated;
DROP FUNCTION IF EXISTS public.select_service_request_provider(uuid, uuid, numeric);

REVOKE EXECUTE ON FUNCTION public.is_service_request_provider_candidate_for_current_user(uuid)
FROM authenticated;
DROP FUNCTION IF EXISTS public.is_service_request_provider_candidate_for_current_user(uuid);

DROP TRIGGER IF EXISTS trg_service_request_provider_candidates_updated_at
  ON public.service_request_provider_candidates;

ALTER TABLE public.service_request_provider_candidates DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS public.service_request_provider_candidates;
DROP TYPE IF EXISTS public.service_request_provider_candidate_status;

-- NOTE: enum values added to public.service_request_status are intentionally
-- not dropped in Down because PostgreSQL does not support removing enum values
-- cleanly once they may be referenced by existing rows.
