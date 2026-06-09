-- +goose Up
-- Enable realtime publication for trip_driver_candidates so that
-- both client and driver apps receive live updates when:
--   - admin approves a candidate (admin_approved toggled)
--   - driver is invited (INSERT with status='pending')
--   - candidate accepts/rejects (status update)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trip_driver_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trip_driver_candidates;
  END IF;
END $$;

-- Required so UPDATE payloads include the previous row values needed by
-- filtered subscriptions (without this, filters on UPDATE may not match
-- if the filtered column wasn't part of the change).
ALTER TABLE trip_driver_candidates REPLICA IDENTITY FULL;

-- +goose Down
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trip_driver_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE trip_driver_candidates;
  END IF;
END $$;

ALTER TABLE trip_driver_candidates REPLICA IDENTITY DEFAULT;
