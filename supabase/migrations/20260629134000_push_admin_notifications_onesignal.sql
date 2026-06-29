-- ============================================================================
-- Migration: Push admin notifications through OneSignal
-- Description: Sends OneSignal web push when admin notifications are inserted.
-- ============================================================================

-- +goose Up

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_push_admin_notification_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  v_webhook_secret text;
BEGIN
  IF NEW.type IS NULL OR NEW.type NOT LIKE 'admin_%' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
    INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF coalesce(v_webhook_secret, '') = '' THEN
    RAISE WARNING 'push_webhook_secret ausente; push admin ignorado para notification %',
      NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-admin-onesignal-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Push-Webhook-Secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'table', 'notifications',
        'event', 'INSERT',
        'new_record', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'title', NEW.title,
          'body', NEW.body,
          'type', NEW.type,
          'reference_type', NEW.reference_type,
          'reference_id', NEW.reference_id,
          'link', NEW.link
        )
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'OneSignal admin push failed for notification %: %',
      NEW.id, sqlerrm;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_admin_notification_onesignal
  ON public.notifications;
CREATE TRIGGER trg_push_admin_notification_onesignal
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_admin_notification_onesignal();

-- +goose Down

DROP TRIGGER IF EXISTS trg_push_admin_notification_onesignal
  ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_push_admin_notification_onesignal();
