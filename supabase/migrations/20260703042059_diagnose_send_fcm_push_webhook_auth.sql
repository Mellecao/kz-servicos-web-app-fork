-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

do $$
declare
  v_webhook_secret text;
begin
  select decrypted_secret
    into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  order by created_at desc
  limit 1;

  perform net.http_post(
    url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Webhook-Secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'table', 'trips',
      'event', 'UPDATE',
      'old_status', 'open',
      'new_record', jsonb_build_object(
        'id', '00000000-0000-0000-0000-000000000001',
        'status', 'under_review',
        'client_id', '00000000-0000-0000-0000-000000000002',
        'driver_profile_id', null,
        'pickup_address_id', null,
        'dropoff_address_id', null
      )
    ),
    timeout_milliseconds := 10000
  );
end;
$$;
