-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

ALTER TABLE public.trip_driver_candidates
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tdc_pending_last_push
  ON public.trip_driver_candidates(trip_id, last_push_at)
  WHERE status = 'pending';
