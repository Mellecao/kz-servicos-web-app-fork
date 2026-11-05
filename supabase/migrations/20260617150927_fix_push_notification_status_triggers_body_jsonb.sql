-- ATENÇÃO: JWT service_role removido deste snapshot (substituído por <REDACTED_JWT>).
-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_push_on_trip_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <REDACTED_JWT>'
        ),
        body := jsonb_build_object(
          'table', 'trips',
          'event', 'UPDATE',
          'old_status', OLD.status::TEXT,
          'new_record', jsonb_build_object(
            'id', NEW.id,
            'status', NEW.status::TEXT,
            'client_id', NEW.client_id,
            'driver_profile_id', NEW.driver_profile_id,
            'pickup_address_id', NEW.pickup_address_id,
            'dropoff_address_id', NEW.dropoff_address_id
          )
        ),
        timeout_milliseconds := 10000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push notification failed for trip % status change % -> %: %', NEW.id, OLD.status, NEW.status, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_trip_status_change ON public.trips;
CREATE TRIGGER trg_push_on_trip_status_change
  AFTER UPDATE OF status ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_trip_status_change();

CREATE OR REPLACE FUNCTION public.trigger_push_on_service_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <REDACTED_JWT>'
        ),
        body := jsonb_build_object(
          'table', 'service_requests',
          'event', 'UPDATE',
          'old_status', OLD.status::TEXT,
          'new_record', jsonb_build_object(
            'id', NEW.id,
            'status', NEW.status::TEXT,
            'client_id', NEW.client_id,
            'provider_profile_id', NEW.provider_profile_id
          )
        ),
        timeout_milliseconds := 10000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push notification failed for service_request % status change % -> %: %', NEW.id, OLD.status, NEW.status, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_service_request_status_change ON public.service_requests;
CREATE TRIGGER trg_push_on_service_request_status_change
  AFTER UPDATE OF status ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_service_request_status_change();
