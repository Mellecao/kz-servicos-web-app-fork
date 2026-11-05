-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- Seed 'auto' + policy authenticated read escopada por key
INSERT INTO system_settings (key, value, updated_by)
VALUES ('scheduled_quote_admin_override', '"auto"'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "authenticated_read_scheduled_quote_override"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (key = 'scheduled_quote_admin_override');
