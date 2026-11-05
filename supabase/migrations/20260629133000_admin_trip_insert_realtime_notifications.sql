-- ============================================================================
-- Migration: Admin trip insert realtime notifications
-- Description: Ensures new trips enter the admin realtime/push pipeline.
-- ============================================================================

-- +goose Up

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_driver_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_driver_candidates;
  END IF;
END $$;

ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.trip_driver_candidates REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.trigger_admin_notification_on_trip_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text IN ('open', 'under_review') THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_trip_created',
      'Nova corrida criada',
      'Um cliente criou uma corrida. Acompanhe o pedido no painel de viagens.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_notification_on_trip_insert ON public.trips;
CREATE TRIGGER trg_admin_notification_on_trip_insert
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_admin_notification_on_trip_insert();

-- +goose Down

DROP TRIGGER IF EXISTS trg_admin_notification_on_trip_insert ON public.trips;
DROP FUNCTION IF EXISTS public.trigger_admin_notification_on_trip_insert();
