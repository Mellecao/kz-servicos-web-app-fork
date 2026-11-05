-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

DO $$ BEGIN
  CREATE TYPE public.trip_type AS ENUM ('standard', 'flash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_type public.trip_type NOT NULL DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_trips_type_status ON public.trips(trip_type, status);
