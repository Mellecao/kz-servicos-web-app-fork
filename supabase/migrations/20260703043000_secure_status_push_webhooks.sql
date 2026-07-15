-- +goose Up

create or replace function public.trigger_push_on_trip_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  v_webhook_secret text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select decrypted_secret
    into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  order by created_at desc
  limit 1;

  if coalesce(v_webhook_secret, '') = '' then
    raise warning 'push_webhook_secret ausente; push ignorado para trip % status % -> %',
      new.id, old.status, new.status;
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
        'table', 'trips',
        'event', 'UPDATE',
        'old_status', old.status::text,
        'new_record', jsonb_build_object(
          'id', new.id,
          'status', new.status::text,
          'client_id', new.client_id,
          'driver_profile_id', new.driver_profile_id,
          'pickup_address_id', new.pickup_address_id,
          'dropoff_address_id', new.dropoff_address_id
        )
      ),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'push notification failed for trip % status change % -> %: %',
      new.id, old.status, new.status, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_push_on_trip_status_change on public.trips;

create trigger trg_push_on_trip_status_change
  after update of status on public.trips
  for each row
  execute function public.trigger_push_on_trip_status_change();

create or replace function public.trigger_push_on_service_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  v_webhook_secret text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select decrypted_secret
    into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  order by created_at desc
  limit 1;

  if coalesce(v_webhook_secret, '') = '' then
    raise warning 'push_webhook_secret ausente; push ignorado para service_request % status % -> %',
      new.id, old.status, new.status;
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
        'table', 'service_requests',
        'event', 'UPDATE',
        'old_status', old.status::text,
        'new_record', jsonb_build_object(
          'id', new.id,
          'status', new.status::text,
          'client_id', new.client_id,
          'provider_profile_id', new.provider_profile_id
        )
      ),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'push notification failed for service_request % status change % -> %: %',
      new.id, old.status, new.status, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_push_on_service_request_status_change on public.service_requests;

create trigger trg_push_on_service_request_status_change
  after update of status on public.service_requests
  for each row
  execute function public.trigger_push_on_service_request_status_change();

-- +goose Down

drop trigger if exists trg_push_on_service_request_status_change on public.service_requests;
drop function if exists public.trigger_push_on_service_request_status_change();
drop trigger if exists trg_push_on_trip_status_change on public.trips;
drop function if exists public.trigger_push_on_trip_status_change();
