-- ATENÇÃO: JWT service_role removido deste snapshot (substituído por <REDACTED_JWT>).
-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

CREATE OR REPLACE FUNCTION public.trigger_push_on_candidate_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
BEGIN
  IF NEW.status::TEXT != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id, status, client_id, pickup_address_id, dropoff_address_id
  INTO v_trip
  FROM public.trips
  WHERE id = NEW.trip_id;

  IF NOT FOUND OR v_trip.status::TEXT != 'searching_drivers' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <REDACTED_JWT>'
      ),
      body := jsonb_build_object(
        'table', 'trip_driver_candidates',
        'event', 'INSERT',
        'new_record', jsonb_build_object(
          'id', v_trip.id,
          'status', 'pending',
          'client_id', v_trip.client_id,
          'driver_profile_id', NEW.driver_profile_id,
          'pickup_address_id', v_trip.pickup_address_id,
          'dropoff_address_id', v_trip.dropoff_address_id
        )
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push notification failed for candidate % (trip %): %', NEW.id, NEW.trip_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
