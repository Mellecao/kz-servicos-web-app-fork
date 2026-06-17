-- ============================================================================
-- Migration: Push notification when driver is added as candidate
-- Description: A trigger existente trg_push_on_trip_status_change só dispara
--   em mudanças de status da trip. Quando admin adiciona candidato com a
--   trip já em 'searching_drivers', nenhum push é enviado. Este trigger
--   fecha essa lacuna disparando push direto para o motorista recém
--   adicionado (não dispara para os outros candidatos já existentes).
-- ============================================================================

-- +goose Up

-- Extensão pg_net é pré-requisito para net.http_post usado no trigger abaixo.
-- IF NOT EXISTS torna a operação idempotente.
CREATE EXTENSION IF NOT EXISTS pg_net;

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
    -- Push falhou (Edge Function offline, sem permissão, etc) — não aborta o INSERT do candidato.
    RAISE WARNING 'push notification failed for candidate % (trip %): %', NEW.id, NEW.trip_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_candidate_insert ON public.trip_driver_candidates;
CREATE TRIGGER trg_push_on_candidate_insert
  AFTER INSERT ON public.trip_driver_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_candidate_insert();
