-- +goose Up

create or replace function public.trigger_push_on_candidate_insert()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  v_trip record;
  v_webhook_secret text;
begin
  if new.status::text <> 'pending' then
    return new;
  end if;

  select id, status, client_id, pickup_address_id, dropoff_address_id
    into v_trip
  from public.trips
  where id = new.trip_id;

  if not found or v_trip.status::text <> 'searching_drivers' then
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
          'status', 'pending',
          'client_id', v_trip.client_id,
          'driver_profile_id', new.driver_profile_id,
          'pickup_address_id', v_trip.pickup_address_id,
          'dropoff_address_id', v_trip.dropoff_address_id
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

drop trigger if exists trg_push_on_candidate_insert on public.trip_driver_candidates;

create trigger trg_push_on_candidate_insert
  after insert on public.trip_driver_candidates
  for each row
  execute function public.trigger_push_on_candidate_insert();

-- +goose Down

drop trigger if exists trg_push_on_candidate_insert on public.trip_driver_candidates;
drop function if exists public.trigger_push_on_candidate_insert();
