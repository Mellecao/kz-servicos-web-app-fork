-- ============================================================================
-- Migration: cancel_scheduled_choose_driver_trip
-- Aceita cancelamento pelo cliente dono OU admin. Reject candidate + trip cancelled.
-- ============================================================================

-- +goose Up
CREATE OR REPLACE FUNCTION public.cancel_scheduled_choose_driver_trip(
  p_trip_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_trip_id::text, 0));

  SELECT client_id, status::text INTO v_client_id, v_status
    FROM trips
   WHERE id = p_trip_id
     AND trip_type = 'scheduled_choose_driver';

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Corrida nao encontrada';
  END IF;

  IF v_client_id <> v_user_id AND public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  IF v_status NOT IN ('awaiting_driver_confirmation', 'awaiting_client_confirmation', 'searching_drivers') THEN
    RAISE EXCEPTION 'Corrida nao pode ser cancelada no status %', v_status;
  END IF;

  UPDATE trips
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_at = now()
   WHERE id = p_trip_id;

  UPDATE trip_driver_candidates
     SET status = 'rejected'
   WHERE trip_id = p_trip_id
     AND status IN ('pending', 'accepted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_scheduled_choose_driver_trip(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_choose_driver_trip(uuid, text) TO authenticated;
