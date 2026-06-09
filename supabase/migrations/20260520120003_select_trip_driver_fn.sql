-- +goose Up
CREATE OR REPLACE FUNCTION select_trip_driver(
  p_trip_id UUID,
  p_candidate_id UUID,
  p_driver_profile_id UUID,
  p_offered_price DECIMAL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Guard: only works if trip is in searching_drivers status
  UPDATE trips
  SET driver_profile_id = p_driver_profile_id,
      final_price       = p_offered_price,
      status            = 'scheduled'
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

-- +goose Down
REVOKE EXECUTE ON FUNCTION select_trip_driver(UUID, UUID, UUID, DECIMAL) FROM authenticated;
DROP FUNCTION IF EXISTS select_trip_driver(UUID, UUID, UUID, DECIMAL);
