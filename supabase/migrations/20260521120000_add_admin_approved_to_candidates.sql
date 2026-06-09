-- +goose Up
ALTER TABLE trip_driver_candidates
  ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_admin_approved
  ON trip_driver_candidates(trip_id, admin_approved);

-- +goose Down
DROP INDEX IF EXISTS idx_trip_driver_candidates_admin_approved;
ALTER TABLE trip_driver_candidates DROP COLUMN IF EXISTS admin_approved;
