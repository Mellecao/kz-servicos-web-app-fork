-- +goose Up
-- Corridas Flash não podem ser ida-e-volta nem ter horário de retorno.
-- Standard preserva comportamento atual.

ALTER TABLE public.trips
  ADD CONSTRAINT trips_flash_no_scheduling CHECK (
    trip_type = 'standard' OR (
      is_round_trip = false
      AND return_datetime IS NULL
    )
  );

-- +goose Down
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_flash_no_scheduling;
