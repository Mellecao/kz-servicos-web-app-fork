-- ============================================================================
-- Migration: Fix push on candidate insert body type
-- Description: net.http_post expects body jsonb. The previous function passed
--   body as text, which aborted INSERTs into trip_driver_candidates when the
--   trigger fired.
-- ============================================================================

-- +goose Up

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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10c3Flb21jdHJxZnlla3l6YXBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAwNjM4MiwiZXhwIjoyMDk2NTgyMzgyfQ.VptxH2aI6VqAJa5-KaXDfzzDAQKkwgigP9q4MG22Ywc'
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

-- +goose Down
-- Intentionally empty. This migration fixes a runtime type error.
