-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- Subprojeto 6: Outros Serviços com formulário livre
-- Adiciona coluna freeform_profession para cliente descrever o profissional
-- em texto livre. service_category_id vira nullable para permitir requests
-- sem categoria pré-definida (retrocompatível com requests antigos).

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS freeform_profession text;

ALTER TABLE public.service_requests
  ALTER COLUMN service_category_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_freeform_profession
  ON public.service_requests (freeform_profession)
  WHERE freeform_profession IS NOT NULL;
