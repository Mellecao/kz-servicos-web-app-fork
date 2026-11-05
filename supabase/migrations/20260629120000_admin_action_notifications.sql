-- ============================================================================
-- Migration: Admin action notifications
-- Description: Creates dashboard notifications for admins when trip pipeline
--   events need attention or visibility.
-- ============================================================================

-- +goose Up

CREATE OR REPLACE FUNCTION public.notify_admins_for_trip_action(
  p_type text,
  p_title text,
  p_body text,
  p_trip_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    reference_type,
    reference_id,
    link
  )
  SELECT
    u.id,
    p_title,
    p_body,
    p_type,
    'trip',
    p_trip_id,
    '/viagens'
  FROM public.users u
  WHERE u.role = 'admin'
    AND u.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_admin_notification_on_trip_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'under_review' THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_trip_review',
      'Nova corrida aguardando análise',
      'Uma solicitação de corrida precisa ser analisada pela equipe KZ.',
      NEW.id
    );
  ELSIF NEW.status::text = 'awaiting_driver_confirmation' THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_client_confirmed_trip',
      'Cliente aceitou o agendamento',
      'O cliente aceitou a proposta. O motorista precisa confirmar o agendamento.',
      NEW.id
    );
  ELSIF NEW.status::text = 'scheduled' THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_driver_confirmed_trip',
      'Motorista confirmou o agendamento',
      'O motorista confirmou a corrida e o agendamento foi concluído.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_notification_on_trip_status ON public.trips;
CREATE TRIGGER trg_admin_notification_on_trip_status
  AFTER UPDATE OF status ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_admin_notification_on_trip_status();

CREATE OR REPLACE FUNCTION public.trigger_admin_notification_on_candidate_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status::text = 'accepted' THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_driver_returned_proposal',
      'Motorista retornou proposta',
      'Um motorista aceitou a corrida ou informou uma proposta para análise.',
      NEW.trip_id
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status::text = 'rejected' THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_driver_rejected_trip',
      'Motorista recusou corrida',
      'Um motorista recusou uma solicitação ou revalidação de agendamento.',
      NEW.trip_id
    );
  ELSIF OLD.offered_price IS DISTINCT FROM NEW.offered_price
        AND NEW.offered_price IS NOT NULL THEN
    PERFORM public.notify_admins_for_trip_action(
      'admin_driver_returned_price',
      'Motorista retornou preço',
      'Um motorista enviou ou atualizou o preço proposto para uma corrida.',
      NEW.trip_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_notification_on_candidate_update
  ON public.trip_driver_candidates;
CREATE TRIGGER trg_admin_notification_on_candidate_update
  AFTER UPDATE OF status, offered_price ON public.trip_driver_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_admin_notification_on_candidate_update();

-- +goose Down

DROP TRIGGER IF EXISTS trg_admin_notification_on_candidate_update
  ON public.trip_driver_candidates;
DROP FUNCTION IF EXISTS public.trigger_admin_notification_on_candidate_update();

DROP TRIGGER IF EXISTS trg_admin_notification_on_trip_status ON public.trips;
DROP FUNCTION IF EXISTS public.trigger_admin_notification_on_trip_status();

DROP FUNCTION IF EXISTS public.notify_admins_for_trip_action(text, text, text, uuid);
