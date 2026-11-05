-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

ALTER TABLE public.trips
  ADD CONSTRAINT trips_flash_no_scheduling CHECK (
    trip_type = 'standard' OR (
      is_round_trip = false
      AND return_datetime IS NULL
    )
  );
