-- ============================================================================
-- Migration: RPC set_scheduled_quote_override(new_value text)
-- SECURITY DEFINER, admin-only, valida value ∈ {auto, force_enabled, force_disabled}
-- Padrão Flash: revoke anon + guard get_user_role() + inline validation.
-- ============================================================================

-- +goose Up
CREATE OR REPLACE FUNCTION public.set_scheduled_quote_override(new_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Apenas admin pode alterar este setting';
  END IF;

  IF new_value NOT IN ('auto', 'force_enabled', 'force_disabled') THEN
    RAISE EXCEPTION 'Valor invalido: %', new_value;
  END IF;

  INSERT INTO system_settings (key, value, updated_by, updated_at)
  VALUES ('scheduled_quote_admin_override', to_jsonb(new_value), auth.uid(), now())
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by,
                updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_scheduled_quote_override(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_scheduled_quote_override(text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.set_scheduled_quote_override(text);
