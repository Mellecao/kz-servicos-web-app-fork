-- +goose Up
-- driver_send_flash_proposal: motorista envia proposta com preço para corrida Flash.
-- Proposta é compromisso (não pode ser retirada — só via re-check reject depois).

CREATE OR REPLACE FUNCTION public.driver_send_flash_proposal(
  p_trip_id uuid, p_price numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile_id uuid;
  v_current_status public.trip_status_candidate;
  v_trip_status public.trip_status;
  v_trip_type public.trip_type;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_price <= 0 OR p_price > 10000 THEN
    RAISE EXCEPTION 'Preço inválido';
  END IF;

  SELECT dp.id INTO v_driver_profile_id
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;
  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  SELECT status, trip_type INTO v_trip_status, v_trip_type
  FROM public.trips WHERE id = p_trip_id;
  IF v_trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Esta RPC só aceita corridas Flash';
  END IF;
  IF v_trip_status <> 'searching_drivers' THEN
    RAISE EXCEPTION 'Corrida não está buscando motoristas';
  END IF;

  SELECT status INTO v_current_status
  FROM public.trip_driver_candidates
  WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Você não foi convidado para essa corrida';
  END IF;
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Você já respondeu essa chamada';
  END IF;

  UPDATE public.trip_driver_candidates
     SET status = 'accepted', offered_price = p_price, updated_at = now()
   WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_send_flash_proposal(uuid, numeric) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.driver_send_flash_proposal(uuid, numeric);
