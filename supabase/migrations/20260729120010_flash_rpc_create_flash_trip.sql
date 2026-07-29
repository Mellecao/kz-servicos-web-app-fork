-- +goose Up
-- create_flash_trip: cliente cria corrida Flash em uma transação.
-- Insere trip com status='searching_drivers' + candidatos para todos motoristas aprovados.
-- Ver spec: docs/superpowers/specs/2026-07-29-corrida-flash-design.md

CREATE OR REPLACE FUNCTION public.create_flash_trip(
  p_pickup_address_id uuid,
  p_dropoff_address_id uuid,
  p_service_category_id uuid,
  p_passenger_count int,
  p_children_count int,
  p_luggage_count int,
  p_observations text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_trip_id uuid;
  v_client_id uuid := auth.uid();
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE client_id = v_client_id
      AND trip_type = 'flash'
      AND status IN ('searching_drivers','awaiting_driver_confirmation','scheduled','started')
  ) THEN
    RAISE EXCEPTION 'Você já tem uma corrida Flash em andamento';
  END IF;

  IF p_passenger_count < 1 THEN
    RAISE EXCEPTION 'Número de passageiros inválido';
  END IF;

  INSERT INTO public.trips (
    client_id, service_category_id, pickup_address_id, dropoff_address_id,
    scheduled_datetime, passenger_count, children_count, luggage_count,
    observations, status, trip_type, is_round_trip
  ) VALUES (
    v_client_id, p_service_category_id, p_pickup_address_id, p_dropoff_address_id,
    now(), p_passenger_count, COALESCE(p_children_count, 0), COALESCE(p_luggage_count, 0),
    p_observations, 'searching_drivers', 'flash', false
  )
  RETURNING id INTO v_trip_id;

  -- Insere candidatos inline (add_all_approved_trip_candidates exige role admin)
  PERFORM pg_advisory_xact_lock(hashtext(v_trip_id::text));
  INSERT INTO public.trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  SELECT v_trip_id, dp.id, 'pending'::public.trip_status_candidate, now()
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.status = 'approved'::public.provider_status;

  RETURN v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_flash_trip(uuid,uuid,uuid,int,int,int,text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.create_flash_trip(uuid,uuid,uuid,int,int,int,text);
