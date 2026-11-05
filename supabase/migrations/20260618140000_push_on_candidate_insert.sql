-- ATENÇÃO: JWT service_role removido deste snapshot (substituído por <REDACTED_JWT>).
-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- ============================================================================
-- Migration: Push notification when driver is added as candidate
-- Description: A trigger existente trg_push_on_trip_status_change só dispara
--   em mudanças de status da trip. Quando admin adiciona candidato com a
--   trip já em 'searching_drivers', nenhum push é enviado. Este trigger
--   fecha essa lacuna disparando push direto para o motorista recém
--   adicionado (não dispara para os outros candidatos já existentes).
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
    )::text,
    timeout_milliseconds := 10000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_candidate_insert ON public.trip_driver_candidates;

CREATE TRIGGER trg_push_on_candidate_insert
  AFTER INSERT ON public.trip_driver_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_candidate_insert();
