-- +goose Up
-- Consolida Task 13 do plano: em vez de criar edge function send-flash-repush
-- separada, redispatch_flash_trip itera candidatos pending e chama
-- send-fcm-push diretamente (mesmo padrão do trigger de INSERT).
-- Throttle 30s preservado. Elimina superfície nova.

CREATE OR REPLACE FUNCTION public.redispatch_flash_trip(p_trip_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'vault', 'pg_temp'
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_pushed int := 0;
  v_webhook_secret text;
  v_candidate record;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Não é Flash';
  END IF;
  IF v_trip.status <> 'searching_drivers' THEN
    RETURN 0;
  END IF;

  -- Insere candidatos para novos motoristas aprovados (INSERT trigger dispara push).
  PERFORM pg_advisory_xact_lock(hashtext(p_trip_id::text));
  INSERT INTO public.trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  SELECT p_trip_id, dp.id, 'pending'::public.trip_status_candidate, now()
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.status = 'approved'::public.provider_status
    AND NOT EXISTS (
      SELECT 1 FROM public.trip_driver_candidates c
      WHERE c.trip_id = p_trip_id AND c.driver_profile_id = dp.id
    );

  SELECT decrypted_secret INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  ORDER BY created_at DESC LIMIT 1;

  IF COALESCE(v_webhook_secret, '') = '' THEN
    RAISE WARNING 'push_webhook_secret ausente; repush ignorado para trip %', p_trip_id;
    RETURN 0;
  END IF;

  FOR v_candidate IN
    SELECT id, driver_profile_id
    FROM public.trip_driver_candidates
    WHERE trip_id = p_trip_id
      AND status = 'pending'
      AND (last_push_at IS NULL OR last_push_at < now() - interval '30 seconds')
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Push-Webhook-Secret', v_webhook_secret
        ),
        body := jsonb_build_object(
          'table', 'trip_driver_candidates',
          'event', 'REDISPATCH',
          'new_record', jsonb_build_object(
            'id', v_trip.id,
            'status', 'pending',
            'client_id', v_trip.client_id,
            'driver_profile_id', v_candidate.driver_profile_id,
            'pickup_address_id', v_trip.pickup_address_id,
            'dropoff_address_id', v_trip.dropoff_address_id,
            'trip_type', v_trip.trip_type
          )
        ),
        timeout_milliseconds := 10000
      );
      UPDATE public.trip_driver_candidates
        SET last_push_at = now()
        WHERE id = v_candidate.id;
      v_pushed := v_pushed + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'repush failed for candidate % (trip %): %',
        v_candidate.id, p_trip_id, sqlerrm;
    END;
  END LOOP;

  RETURN v_pushed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) TO authenticated;

-- +goose Down
-- Reverter para versão anterior (com URL em system_settings) fora do escopo.
