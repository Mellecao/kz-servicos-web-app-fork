-- +goose Up
-- client_accept_flash_proposal: cliente escolhe uma proposta específica.
-- pg_advisory_xact_lock evita race condition (2 aceites simultâneos).

CREATE OR REPLACE FUNCTION public.client_accept_flash_proposal(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_trip_id uuid; v_driver_profile uuid; v_price numeric;
  v_trip_status public.trip_status; v_trip_type public.trip_type; v_trip_client uuid;
  v_vehicle_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT trip_id, driver_profile_id, offered_price INTO v_trip_id, v_driver_profile, v_price
  FROM public.trip_driver_candidates WHERE id = p_candidate_id;
  IF v_trip_id IS NULL THEN RAISE EXCEPTION 'Candidato inexistente'; END IF;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Proposta sem preço'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trip_id::text));

  SELECT status, trip_type, client_id INTO v_trip_status, v_trip_type, v_trip_client
  FROM public.trips WHERE id = v_trip_id FOR UPDATE;
  IF v_trip_client <> v_user THEN RAISE EXCEPTION 'Não é sua corrida'; END IF;
  IF v_trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Esta RPC só aceita corridas Flash';
  END IF;
  IF v_trip_status <> 'searching_drivers' THEN
    RAISE EXCEPTION 'Corrida não está mais buscando';
  END IF;

  SELECT id INTO v_vehicle_id FROM public.vehicles
   WHERE driver_profile_id = v_driver_profile AND is_active = true
   ORDER BY updated_at DESC LIMIT 1;

  UPDATE public.trips
     SET status = 'awaiting_driver_confirmation',
         driver_profile_id = v_driver_profile,
         vehicle_id = v_vehicle_id,
         final_price = v_price,
         updated_at = now()
   WHERE id = v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_accept_flash_proposal(uuid) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.client_accept_flash_proposal(uuid);
