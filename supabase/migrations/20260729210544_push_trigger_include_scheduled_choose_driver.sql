-- ============================================================================
-- Migration: Extend trigger_push_on_candidate_insert para reagir também quando
-- trip.status='awaiting_driver_confirmation' (usado em scheduled_choose_driver).
-- Preserva comportamento existente para 'searching_drivers' (Flash/standard).
--
-- Também passa v_trip.status no payload em vez de hardcode 'pending', pra
-- edge function saber o contexto real.
-- ============================================================================

-- +goose Up
CREATE OR REPLACE FUNCTION public.trigger_push_on_candidate_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_trip record;
  v_webhook_secret text;
begin
  if new.status::text <> 'pending' then
    return new;
  end if;

  select id, status, client_id, pickup_address_id, dropoff_address_id, trip_type
    into v_trip
  from public.trips
  where id = new.trip_id;

  -- Aceita searching_drivers (Flash/standard) OU awaiting_driver_confirmation (scheduled_choose_driver)
  if not found or v_trip.status::text not in ('searching_drivers', 'awaiting_driver_confirmation') then
    return new;
  end if;

  select decrypted_secret
    into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  order by created_at desc
  limit 1;

  if coalesce(v_webhook_secret, '') = '' then
    raise warning 'push_webhook_secret ausente; push ignorado para candidato %', new.id;
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Push-Webhook-Secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'table', 'trip_driver_candidates',
        'event', 'INSERT',
        'new_record', jsonb_build_object(
          'id', v_trip.id,
          'status', v_trip.status,
          'client_id', v_trip.client_id,
          'driver_profile_id', new.driver_profile_id,
          'pickup_address_id', v_trip.pickup_address_id,
          'dropoff_address_id', v_trip.dropoff_address_id,
          'trip_type', v_trip.trip_type
        )
      ),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'push notification failed for candidate % (trip %): %',
      new.id, new.trip_id, sqlerrm;
  end;

  return new;
end;
$$;
