-- +goose Up
CREATE OR REPLACE FUNCTION reject_trip_candidates_when_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE trip_driver_candidates
    SET status = 'rejected',
        responded_at = COALESCE(responded_at, NOW()),
        observations = COALESCE(observations, 'Corrida cancelada pela KZ')
    WHERE trip_id = NEW.id
      AND status IN ('pending', 'accepted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_trip_candidates_when_cancelled ON trips;
CREATE TRIGGER trg_reject_trip_candidates_when_cancelled
  AFTER UPDATE OF status ON trips
  FOR EACH ROW
  EXECUTE FUNCTION reject_trip_candidates_when_cancelled();
