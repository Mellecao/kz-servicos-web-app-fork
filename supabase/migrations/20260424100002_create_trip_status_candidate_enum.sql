-- ============================================================================
-- Migration: cria enum trip_status_candidate e converte trip_driver_candidates.status
-- ============================================================================
-- Define os status possíveis de uma candidatura de motorista a uma viagem.
-- A coluna trip_driver_candidates.status era VARCHAR(20); agora passa a usar
-- o enum trip_status_candidate para garantir integridade.
-- ============================================================================

-- +goose Up

-- 1) Cria o enum
DO $$ BEGIN
  CREATE TYPE trip_status_candidate AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Converte a coluna status para o novo enum
-- Remove o default antigo, converte os valores existentes via cast e
-- restabelece o default tipado.
ALTER TABLE public.trip_driver_candidates
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.trip_driver_candidates
  ALTER COLUMN status TYPE trip_status_candidate
  USING status::trip_status_candidate;

ALTER TABLE public.trip_driver_candidates
  ALTER COLUMN status SET DEFAULT 'pending'::trip_status_candidate;

-- +goose Down
-- ALTER TABLE public.trip_driver_candidates
--   ALTER COLUMN status DROP DEFAULT;
-- ALTER TABLE public.trip_driver_candidates
--   ALTER COLUMN status TYPE VARCHAR(20) USING status::text;
-- ALTER TABLE public.trip_driver_candidates
--   ALTER COLUMN status SET DEFAULT 'pending';
-- DROP TYPE IF EXISTS trip_status_candidate;
