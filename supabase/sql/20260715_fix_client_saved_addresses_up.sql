-- Corrige a listagem de clientes e habilita enderecos Casa/Trabalho.
-- Execute uma unica vez no Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (label IN ('home', 'work', 'custom')),
  custom_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id
  ON public.user_saved_addresses(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_addresses_unique_fixed_label
  ON public.user_saved_addresses(user_id, label)
  WHERE label IN ('home', 'work');

ALTER TABLE public.user_saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_saved_addresses_select
  ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_select
ON public.user_saved_addresses
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'::public.user_role
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS user_saved_addresses_insert
  ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_insert
ON public.user_saved_addresses
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'::public.user_role
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS user_saved_addresses_update
  ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_update
ON public.user_saved_addresses
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'::public.user_role
  OR user_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() = 'admin'::public.user_role
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS user_saved_addresses_delete
  ON public.user_saved_addresses;
CREATE POLICY user_saved_addresses_delete
ON public.user_saved_addresses
FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'::public.user_role
  OR user_id = auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_saved_addresses
  TO authenticated;

DROP TRIGGER IF EXISTS trg_user_saved_addresses_updated_at
  ON public.user_saved_addresses;
CREATE TRIGGER trg_user_saved_addresses_updated_at
  BEFORE UPDATE ON public.user_saved_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- Verificacao esperada:
-- SELECT to_regclass('public.user_saved_addresses');
