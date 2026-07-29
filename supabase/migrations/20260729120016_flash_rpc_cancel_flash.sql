-- +goose Up
-- cancel_flash_trip: cliente cancela a corrida Flash.
-- Só permite enquanto status ainda pode ser cancelado (não iniciado).

CREATE OR REPLACE FUNCTION public.cancel_flash_trip(p_trip_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Só corridas Flash';
  END IF;
  IF v_trip.client_id <> v_user THEN
    RAISE EXCEPTION 'Não é sua corrida';
  END IF;
  IF v_trip.status NOT IN ('searching_drivers','awaiting_driver_confirmation','scheduled') THEN
    RAISE EXCEPTION 'Corrida não pode mais ser cancelada';
  END IF;

  UPDATE public.trips
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_at = now()
   WHERE id = p_trip_id;
  -- Trigger reject_candidates_when_trip_cancelled cuida dos candidatos.
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_flash_trip(uuid, text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.cancel_flash_trip(uuid, text);
