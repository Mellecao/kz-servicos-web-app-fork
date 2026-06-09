-- +goose Up
CREATE OR REPLACE FUNCTION select_trip_driver(
  p_trip_id UUID,
  p_candidate_id UUID,
  p_driver_profile_id UUID,
  p_offered_price DECIMAL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Depois que o passageiro aprova o motorista/preco, a corrida ainda precisa
  -- do re-check do motorista antes de virar agendada.
  UPDATE trips
  SET driver_profile_id = p_driver_profile_id,
      final_price       = p_offered_price,
      status            = 'awaiting_driver_confirmation'
  WHERE id = p_trip_id
    AND status = 'searching_drivers';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip % is not in searching_drivers status', p_trip_id;
  END IF;

  UPDATE trip_driver_candidates
  SET status       = 'accepted',
      responded_at = NOW()
  WHERE id = p_candidate_id;

  UPDATE trip_driver_candidates
  SET status       = 'rejected',
      responded_at = NOW()
  WHERE trip_id = p_trip_id
    AND id != p_candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION select_trip_driver(UUID, UUID, UUID, DECIMAL) TO authenticated;

CREATE OR REPLACE FUNCTION require_driver_recheck_before_scheduled()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'scheduled'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status IN ('searching_drivers', 'awaiting_client_confirmation')
     AND NEW.driver_profile_id IS NOT NULL THEN
    NEW.status := 'awaiting_driver_confirmation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_driver_recheck_before_scheduled ON trips;
CREATE TRIGGER trg_require_driver_recheck_before_scheduled
  BEFORE UPDATE OF status, driver_profile_id ON trips
  FOR EACH ROW
  EXECUTE FUNCTION require_driver_recheck_before_scheduled();
