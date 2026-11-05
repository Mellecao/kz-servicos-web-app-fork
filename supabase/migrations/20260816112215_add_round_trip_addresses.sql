-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS return_pickup_address_id uuid
    REFERENCES public.addresses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS return_dropoff_address_id uuid
    REFERENCES public.addresses(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_trips_return_pickup_address_id
  ON public.trips(return_pickup_address_id);
CREATE INDEX IF NOT EXISTS idx_trips_return_dropoff_address_id
  ON public.trips(return_dropoff_address_id);

DROP FUNCTION IF EXISTS public.client_send_scheduled_direct_request(
  uuid, uuid, uuid, uuid, integer, text, timestamptz
);

CREATE OR REPLACE FUNCTION public.client_send_scheduled_direct_request(
  driver_profile_id_input uuid,
  pickup_address_id_input uuid,
  dropoff_address_id_input uuid,
  service_category_id_input uuid,
  passenger_count_input integer,
  observation_input text,
  scheduled_datetime_input timestamptz,
  is_round_trip_input boolean DEFAULT false,
  return_datetime_input timestamptz DEFAULT NULL,
  return_pickup_address_id_input uuid DEFAULT NULL,
  return_dropoff_address_id_input uuid DEFAULT NULL
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
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Nao autenticado'; END IF;
  IF scheduled_datetime_input IS NULL THEN RAISE EXCEPTION 'scheduled_datetime obrigatorio'; END IF;
  IF is_round_trip_input AND (
    return_datetime_input IS NULL OR
    return_pickup_address_id_input IS NULL OR
    return_dropoff_address_id_input IS NULL
  ) THEN
    RAISE EXCEPTION 'Dados da volta obrigatorios para ida e volta';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_client_id::text, 0));

  SELECT pp.status::text INTO v_provider_status
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE dp.id = driver_profile_id_input;

  IF v_provider_status IS NULL THEN RAISE EXCEPTION 'Motorista nao encontrado'; END IF;
  IF v_provider_status <> 'approved' THEN RAISE EXCEPTION 'Motorista nao aprovado'; END IF;

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
    pickup_address_id, dropoff_address_id,
    return_pickup_address_id, return_dropoff_address_id,
    service_category_id, passenger_count, observations,
    scheduled_datetime, is_round_trip, return_datetime
  ) VALUES (
    v_client_id, driver_profile_id_input,
    'scheduled_choose_driver', 'awaiting_driver_confirmation',
    pickup_address_id_input, dropoff_address_id_input,
    return_pickup_address_id_input, return_dropoff_address_id_input,
    service_category_id_input, passenger_count_input, observation_input,
    scheduled_datetime_input, is_round_trip_input, return_datetime_input
  ) RETURNING id INTO v_trip_id;

  INSERT INTO trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  VALUES (v_trip_id, driver_profile_id_input, 'pending', now());

  RETURN v_trip_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(
  uuid, uuid, uuid, uuid, integer, text, timestamptz,
  boolean, timestamptz, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(
  uuid, uuid, uuid, uuid, integer, text, timestamptz,
  boolean, timestamptz, uuid, uuid
) TO authenticated;
