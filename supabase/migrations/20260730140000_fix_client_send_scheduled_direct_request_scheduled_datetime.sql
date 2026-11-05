-- ============================================================================
-- Fix: trips.scheduled_datetime é NOT NULL. RPC client_send_scheduled_direct_request
-- não recebia esse campo, INSERT falhava com PostgrestException 23502.
-- Adiciona parâmetro scheduled_datetime_input timestamptz (obrigatório).
-- Nota: DROP FUNCTION antes do CREATE porque assinatura mudou (novo param).
-- ============================================================================

-- +goose Up
DROP FUNCTION IF EXISTS public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text);

CREATE OR REPLACE FUNCTION public.client_send_scheduled_direct_request(
  driver_profile_id_input uuid,
  pickup_address_id_input uuid,
  dropoff_address_id_input uuid,
  service_category_id_input uuid,
  passenger_count_input int,
  observation_input text,
  scheduled_datetime_input timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_trip_id uuid;
  v_provider_status text;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF scheduled_datetime_input IS NULL THEN
    RAISE EXCEPTION 'scheduled_datetime obrigatorio';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_client_id::text, 0));

  SELECT pp.status::text INTO v_provider_status
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE dp.id = driver_profile_id_input;

  IF v_provider_status IS NULL THEN
    RAISE EXCEPTION 'Motorista nao encontrado';
  END IF;

  IF v_provider_status <> 'approved' THEN
    RAISE EXCEPTION 'Motorista nao aprovado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM trips
     WHERE client_id = v_client_id
       AND trip_type = 'scheduled_choose_driver'
       AND status IN ('awaiting_driver_confirmation', 'awaiting_client_confirmation')
  ) THEN
    RAISE EXCEPTION 'Voce ja tem uma solicitacao pendente';
  END IF;

  INSERT INTO trips (
    client_id, driver_profile_id, trip_type, status,
    pickup_address_id, dropoff_address_id, service_category_id,
    passenger_count, observations, scheduled_datetime
  ) VALUES (
    v_client_id, driver_profile_id_input, 'scheduled_choose_driver', 'awaiting_driver_confirmation',
    pickup_address_id_input, dropoff_address_id_input, service_category_id_input,
    passenger_count_input, observation_input, scheduled_datetime_input
  ) RETURNING id INTO v_trip_id;

  INSERT INTO trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  VALUES (v_trip_id, driver_profile_id_input, 'pending', now());

  RETURN v_trip_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text, timestamptz) TO authenticated;
