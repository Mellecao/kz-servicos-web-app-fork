-- +goose Up
-- Adiciona discriminator trip_type para suportar Corrida Flash.
-- Ver spec: docs/superpowers/specs/2026-07-29-corrida-flash-design.md

DO $$ BEGIN
  CREATE TYPE public.trip_type AS ENUM ('standard', 'flash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_type public.trip_type NOT NULL DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_trips_type_status ON public.trips(trip_type, status);

-- +goose Down
DROP INDEX IF EXISTS public.idx_trips_type_status;
ALTER TABLE public.trips DROP COLUMN IF EXISTS trip_type;
DROP TYPE IF EXISTS public.trip_type;
