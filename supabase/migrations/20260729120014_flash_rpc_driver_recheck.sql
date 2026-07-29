-- +goose Up
-- driver_flash_recheck_confirm / reject: re-check do motorista após cliente aceitar proposta.
-- Confirm: trip vira 'scheduled' -> advance_trip_execution move para 'to_pickup'/'started'.
-- Reject: candidato vira 'rejected', trip volta pra searching, redispatch_flash_trip é chamado.

CREATE OR REPLACE FUNCTION public.driver_flash_recheck_confirm(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile uuid;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT dp.id INTO v_driver_profile
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Só corridas Flash';
  END IF;
  IF v_trip.driver_profile_id IS DISTINCT FROM v_driver_profile THEN
    RAISE EXCEPTION 'Você não é o motorista dessa corrida';
  END IF;
  IF v_trip.status <> 'awaiting_driver_confirmation' THEN
    RAISE EXCEPTION 'Trip não está aguardando sua confirmação';
  END IF;

  UPDATE public.trips SET status = 'scheduled' WHERE id = p_trip_id;
  PERFORM public.advance_trip_execution(p_trip_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_flash_recheck_reject(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile uuid;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT dp.id INTO v_driver_profile
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Só corridas Flash';
  END IF;
  IF v_trip.driver_profile_id IS DISTINCT FROM v_driver_profile THEN
    RAISE EXCEPTION 'Você não é o motorista dessa corrida';
  END IF;
  IF v_trip.status <> 'awaiting_driver_confirmation' THEN
    RAISE EXCEPTION 'Trip não está aguardando sua confirmação';
  END IF;

  UPDATE public.trip_driver_candidates
     SET status = 'rejected', updated_at = now()
   WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile;

  UPDATE public.trips
     SET status = 'searching_drivers',
         driver_profile_id = NULL,
         vehicle_id = NULL,
         final_price = NULL,
         updated_at = now()
   WHERE id = p_trip_id;

  PERFORM public.redispatch_flash_trip(p_trip_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_flash_recheck_confirm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_flash_recheck_reject(uuid) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.driver_flash_recheck_confirm(uuid);
DROP FUNCTION IF EXISTS public.driver_flash_recheck_reject(uuid);
