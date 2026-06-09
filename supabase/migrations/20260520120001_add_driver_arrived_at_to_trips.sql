-- +goose Up
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS driver_arrived_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE trips
  DROP COLUMN IF EXISTS driver_arrived_at;
