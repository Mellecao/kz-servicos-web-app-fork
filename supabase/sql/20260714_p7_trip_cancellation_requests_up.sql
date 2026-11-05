-- P7 - Solicitacoes de cancelamento revisadas pelo admin.
-- Execute uma unica vez no Supabase SQL Editor.
-- Este arquivo contem somente o bloco UP e nao altera o historico de migrations.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.trip_cancellation_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'public.trip_cancellation_requests ja existe; script nao executado';
  END IF;
END $$;

CREATE TABLE public.trip_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 10),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_cancellation_requests_review_reason_check CHECK (
    status <> 'rejected'
    OR char_length(btrim(coalesce(review_reason, ''))) >= 3
  ),
  CONSTRAINT trip_cancellation_requests_review_state_check CHECK (
    (
      status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND review_reason IS NULL
    )
    OR (
      status = 'approved'
      AND reviewed_at IS NOT NULL
      AND review_reason IS NULL
    )
    OR (
      status = 'rejected'
      AND reviewed_at IS NOT NULL
    )
  )
);

CREATE INDEX idx_trip_cancellation_requests_trip_id
  ON public.trip_cancellation_requests(trip_id, created_at DESC);
CREATE INDEX idx_trip_cancellation_requests_requested_by
  ON public.trip_cancellation_requests(requested_by, created_at DESC);
CREATE UNIQUE INDEX idx_trip_cancellation_requests_unique_pending
  ON public.trip_cancellation_requests(trip_id)
  WHERE status = 'pending';

ALTER TABLE public.trip_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_cancellation_requests_select
ON public.trip_cancellation_requests
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'::user_role
  OR requested_by = auth.uid()
);

CREATE POLICY trip_cancellation_requests_insert_driver
ON public.trip_cancellation_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.trips t
    JOIN public.driver_profiles dp ON dp.id = t.driver_profile_id
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE t.id = trip_cancellation_requests.trip_id
      AND pp.user_id = auth.uid()
      AND t.status::text IN ('scheduled', 'started')
  )
);

CREATE POLICY trip_cancellation_requests_update_admin
ON public.trip_cancellation_requests
FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'admin'::user_role)
WITH CHECK (public.get_user_role() = 'admin'::user_role);

GRANT SELECT, INSERT, UPDATE ON public.trip_cancellation_requests TO authenticated;

CREATE TRIGGER trg_trip_cancellation_requests_updated_at
  BEFORE UPDATE ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_trip_cancellation_request_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_status trip_status;
BEGIN
  IF OLD.trip_id IS DISTINCT FROM NEW.trip_id
     OR OLD.requested_by IS DISTINCT FROM NEW.requested_by
     OR OLD.reason IS DISTINCT FROM NEW.reason THEN
    RAISE EXCEPTION 'Os dados originais do pedido de cancelamento nao podem ser alterados';
  END IF;

  IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'O pedido de cancelamento ja foi analisado ou possui transicao invalida';
  END IF;

  IF NEW.status = 'rejected'
     AND char_length(btrim(coalesce(NEW.review_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa com pelo menos 3 caracteres';
  END IF;

  IF NEW.status = 'approved' THEN
    SELECT status
      INTO v_trip_status
    FROM public.trips
    WHERE id = NEW.trip_id
    FOR UPDATE;

    IF v_trip_status IS NULL THEN
      RAISE EXCEPTION 'A viagem do pedido de cancelamento nao existe';
    END IF;

    IF v_trip_status NOT IN (
      'scheduled'::trip_status,
      'started'::trip_status,
      'cancelled'::trip_status
    ) THEN
      RAISE EXCEPTION 'A viagem nao esta mais ativa e nao pode ser cancelada';
    END IF;
  END IF;

  NEW.reviewed_by := coalesce(auth.uid(), NEW.reviewed_by);
  NEW.reviewed_at := now();
  IF NEW.status = 'approved' THEN
    NEW.review_reason := NULL;
  ELSE
    NEW.review_reason := btrim(NEW.review_reason);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_trip_cancellation_request_review
  BEFORE UPDATE ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_cancellation_request_review();

CREATE OR REPLACE FUNCTION public.notify_admins_on_trip_cancellation_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_name text;
BEGIN
  SELECT u.full_name
    INTO v_driver_name
  FROM public.users u
  WHERE u.id = NEW.requested_by;

  PERFORM public.notify_admins_for_trip_action(
    'admin_trip_cancellation_request',
    'Motorista solicitou cancelamento',
    format(
      '%s solicitou o cancelamento. Motivo: %s',
      coalesce(v_driver_name, 'Motorista'),
      left(NEW.reason, 180)
    ),
    NEW.trip_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_on_trip_cancellation_request
  AFTER INSERT ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_trip_cancellation_request();

CREATE OR REPLACE FUNCTION public.apply_trip_cancellation_request_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.trips
    SET status = 'cancelled'::trip_status,
        cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = NEW.reason
    WHERE id = NEW.trip_id
      AND status IN ('scheduled'::trip_status, 'started'::trip_status);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_trip_cancellation_request_review
  AFTER UPDATE OF status ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_trip_cancellation_request_review();

CREATE OR REPLACE FUNCTION public.resolve_pending_request_on_trip_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'cancelled'::trip_status THEN
    UPDATE public.trip_cancellation_requests
    SET status = 'approved',
        reviewed_by = auth.uid(),
        review_reason = NULL
    WHERE trip_id = NEW.id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_pending_request_on_trip_cancelled
  AFTER UPDATE OF status ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pending_request_on_trip_cancelled();

CREATE OR REPLACE FUNCTION public.push_driver_trip_cancellation_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  v_webhook_secret text;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status <> 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
    INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF coalesce(v_webhook_secret, '') = '' THEN
    RAISE WARNING 'push_webhook_secret ausente; recusa do pedido % sem push', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Push-Webhook-Secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'table', 'trip_cancellation_requests',
        'event', 'UPDATE',
        'old_status', OLD.status,
        'new_record', jsonb_build_object(
          'id', NEW.id,
          'status', NEW.status,
          'trip_id', NEW.trip_id,
          'requested_by', NEW.requested_by,
          'review_reason', NEW.review_reason
        )
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'push de recusa do pedido % falhou: %', NEW.id, sqlerrm;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_driver_trip_cancellation_rejection
  AFTER UPDATE OF status ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.push_driver_trip_cancellation_rejection();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_cancellation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.trip_cancellation_requests;
  END IF;
END $$;

ALTER TABLE public.trip_cancellation_requests REPLICA IDENTITY FULL;

COMMIT;

-- Verificacao esperada:
-- SELECT to_regclass('public.trip_cancellation_requests');
