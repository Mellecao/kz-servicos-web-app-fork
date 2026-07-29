-- ============================================================================
-- Migration: Seed scheduled_quote_admin_override + policy p/ authenticated
-- Adiciona linha seed em system_settings (default 'auto') e cria policy
-- SELECT escopada por key para permitir o cliente ler o override sem
-- expor o restante da tabela (que continua admin-only).
-- ============================================================================

-- +goose Up
INSERT INTO system_settings (key, value, updated_by)
VALUES ('scheduled_quote_admin_override', '"auto"'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "authenticated_read_scheduled_quote_override"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (key = 'scheduled_quote_admin_override');

-- +goose Down
DROP POLICY IF EXISTS "authenticated_read_scheduled_quote_override" ON public.system_settings;
DELETE FROM system_settings WHERE key = 'scheduled_quote_admin_override';
