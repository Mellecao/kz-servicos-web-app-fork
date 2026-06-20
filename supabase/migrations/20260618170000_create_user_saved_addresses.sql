-- ============================================================================
-- Migration: Saved client addresses
-- Description: Stores fixed Home/Work addresses and optional address shortcuts
--   for the client app.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS public.user_saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (label IN ('home', 'work', 'custom')),
  custom_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id
  ON public.user_saved_addresses(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_addresses_unique_fixed_label
  ON public.user_saved_addresses(user_id, label)
  WHERE label IN ('home', 'work');

ALTER TABLE public.user_saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_saved_addresses_select ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_select
ON public.user_saved_addresses
FOR SELECT
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS user_saved_addresses_insert ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_insert
ON public.user_saved_addresses
FOR INSERT
WITH CHECK (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS user_saved_addresses_update ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_update
ON public.user_saved_addresses
FOR UPDATE
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS user_saved_addresses_delete ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_delete
ON public.user_saved_addresses
FOR DELETE
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

-- +goose Down
DROP POLICY IF EXISTS user_saved_addresses_delete ON public.user_saved_addresses;
DROP POLICY IF EXISTS user_saved_addresses_update ON public.user_saved_addresses;
DROP POLICY IF EXISTS user_saved_addresses_insert ON public.user_saved_addresses;
DROP POLICY IF EXISTS user_saved_addresses_select ON public.user_saved_addresses;
DROP TABLE IF EXISTS public.user_saved_addresses;
