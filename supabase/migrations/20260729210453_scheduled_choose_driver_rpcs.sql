-- ============================================================================
-- Migration: 5 RPCs de fluxo Escolha seu Motorista (Subprojeto 2B)
-- Padrão Flash: SECURITY DEFINER + revoke anon + guards inline + advisory lock.
-- ============================================================================

-- +goose Up

-- 1) Cliente envia solicitação direta a 1 motorista específico
CREATE OR REPLACE FUNCTION public.client_send_scheduled_direct_request(
  driver_profile_id_input uuid,
  pickup_address_id_input uuid,
  dropoff_address_id_input uuid,
  service_category_id_input uuid,
  passenger_count_input int,
  observation_input text
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
    passenger_count, observation
  ) VALUES (
    v_client_id, driver_profile_id_input, 'scheduled_choose_driver', 'awaiting_driver_confirmation',
    pickup_address_id_input, dropoff_address_id_input, service_category_id_input,
    passenger_count_input, observation_input
  ) RETURNING id INTO v_trip_id;

  INSERT INTO trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  VALUES (v_trip_id, driver_profile_id_input, 'pending', now());

  RETURN v_trip_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text) TO authenticated;

-- 2) Motorista aceita com preço
CREATE OR REPLACE FUNCTION public.driver_accept_scheduled_direct(
  trip_id_input uuid,
  offered_price_input numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_driver_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF offered_price_input IS NULL OR offered_price_input <= 0 OR offered_price_input > 10000 THEN
    RAISE EXCEPTION 'Preco invalido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  SELECT dp.id INTO v_driver_profile_id
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE pp.user_id = v_user_id;

  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao e motorista';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trip_driver_candidates
     WHERE trip_id = trip_id_input
       AND driver_profile_id = v_driver_profile_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Voce nao tem candidatura pendente nesta corrida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trips
     WHERE id = trip_id_input
       AND trip_type = 'scheduled_choose_driver'
       AND status = 'awaiting_driver_confirmation'
  ) THEN
    RAISE EXCEPTION 'Corrida nao esta aguardando resposta do motorista';
  END IF;

  UPDATE trip_driver_candidates
     SET status = 'accepted', offered_price = offered_price_input
   WHERE trip_id = trip_id_input
     AND driver_profile_id = v_driver_profile_id;

  UPDATE trips
     SET status = 'awaiting_client_confirmation', updated_at = now()
   WHERE id = trip_id_input;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_accept_scheduled_direct(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_scheduled_direct(uuid, numeric) TO authenticated;

-- 3) Motorista recusa
CREATE OR REPLACE FUNCTION public.driver_reject_scheduled_direct(trip_id_input uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_driver_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  SELECT dp.id INTO v_driver_profile_id
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE pp.user_id = v_user_id;

  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao e motorista';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trip_driver_candidates
     WHERE trip_id = trip_id_input
       AND driver_profile_id = v_driver_profile_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Voce nao tem candidatura pendente nesta corrida';
  END IF;

  UPDATE trip_driver_candidates
     SET status = 'rejected'
   WHERE trip_id = trip_id_input
     AND driver_profile_id = v_driver_profile_id;

  UPDATE trips
     SET status = 'searching_drivers', driver_profile_id = NULL, updated_at = now()
   WHERE id = trip_id_input
     AND trip_type = 'scheduled_choose_driver';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_reject_scheduled_direct(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_reject_scheduled_direct(uuid) TO authenticated;

-- 4) Cliente confirma preço proposto
CREATE OR REPLACE FUNCTION public.client_accept_scheduled_price(trip_id_input uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_offered_price numeric;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM trips
     WHERE id = trip_id_input
       AND client_id = v_client_id
       AND trip_type = 'scheduled_choose_driver'
       AND status = 'awaiting_client_confirmation'
  ) THEN
    RAISE EXCEPTION 'Corrida nao esta aguardando sua confirmacao';
  END IF;

  SELECT offered_price INTO v_offered_price
    FROM trip_driver_candidates
   WHERE trip_id = trip_id_input
     AND status = 'accepted';

  IF v_offered_price IS NULL THEN
    RAISE EXCEPTION 'Sem preco proposto para esta corrida';
  END IF;

  UPDATE trips
     SET status = 'scheduled', final_price = v_offered_price, updated_at = now()
   WHERE id = trip_id_input;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_accept_scheduled_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_accept_scheduled_price(uuid) TO authenticated;

-- 5) Cliente recusa preço proposto
CREATE OR REPLACE FUNCTION public.client_reject_scheduled_price(trip_id_input uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM trips
     WHERE id = trip_id_input
       AND client_id = v_client_id
       AND trip_type = 'scheduled_choose_driver'
       AND status = 'awaiting_client_confirmation'
  ) THEN
    RAISE EXCEPTION 'Corrida nao esta aguardando sua confirmacao';
  END IF;

  UPDATE trip_driver_candidates
     SET status = 'rejected'
   WHERE trip_id = trip_id_input
     AND status = 'accepted';

  UPDATE trips
     SET status = 'searching_drivers', driver_profile_id = NULL, updated_at = now()
   WHERE id = trip_id_input;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_reject_scheduled_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_reject_scheduled_price(uuid) TO authenticated;
