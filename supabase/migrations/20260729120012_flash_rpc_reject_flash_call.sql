-- +goose Up
-- reject_flash_call: motorista rejeita a chamada.
-- Marca candidato como 'rejected' -> excluído permanentemente de redispatches.

CREATE OR REPLACE FUNCTION public.reject_flash_call(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile_id uuid;
  v_current_status public.trip_status_candidate;
  v_trip_type public.trip_type;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT trip_type INTO v_trip_type FROM public.trips WHERE id = p_trip_id;
  IF v_trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Esta RPC só aceita corridas Flash';
  END IF;

  SELECT dp.id INTO v_driver_profile_id
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;
  IF v_driver_profile_id IS NULL THEN RAISE EXCEPTION 'Motorista não encontrado'; END IF;

  SELECT status INTO v_current_status
  FROM public.trip_driver_candidates
  WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Você não foi convidado'; END IF;
  IF v_current_status <> 'pending' THEN RAISE EXCEPTION 'Você já respondeu essa chamada'; END IF;

  UPDATE public.trip_driver_candidates
     SET status = 'rejected', updated_at = now()
   WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_flash_call(uuid) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.reject_flash_call(uuid);
