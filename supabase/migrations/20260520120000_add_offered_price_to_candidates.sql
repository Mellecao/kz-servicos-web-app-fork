-- +goose Up
ALTER TABLE trip_driver_candidates
  ADD COLUMN IF NOT EXISTS offered_price DECIMAL(10,2);

-- +goose Down
ALTER TABLE trip_driver_candidates
  DROP COLUMN IF EXISTS offered_price;
