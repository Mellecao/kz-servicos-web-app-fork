-- Rode este arquivo no SQL Editor do Supabase.
-- Objetivo:
-- 1. Quando cliente/admin selecionar o motorista, a viagem vai para
--    awaiting_driver_confirmation, nao para scheduled.
-- 2. Se algum fluxo antigo tentar pular direto para scheduled logo apos a
--    escolha do motorista, o trigger corrige para awaiting_driver_confirmation.
-- 3. Quando a viagem entrar em awaiting_driver_confirmation, o motorista recebe
--    uma notificacao na tabela notifications.

CREATE OR REPLACE FUNCTION public.select_trip_driver(
  p_trip_id UUID,
  p_candidate_id UUID,
  p_driver_profile_id UUID,
  p_offered_price DECIMAL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trips
  SET driver_profile_id = p_driver_profile_id,
      final_price       = p_offered_price,
      status            = 'awaiting_driver_confirmation'
  WHERE id = p_trip_id
    AND status = 'searching_drivers';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip % is not in searching_drivers status', p_trip_id;
  END IF;

  UPDATE public.trip_driver_candidates
  SET status       = 'accepted',
      responded_at = NOW()
  WHERE id = p_candidate_id;

  UPDATE public.trip_driver_candidates
  SET status       = 'rejected',
      responded_at = NOW()
  WHERE trip_id = p_trip_id
    AND id != p_candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_trip_driver(UUID, UUID, UUID, DECIMAL) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_driver_recheck_before_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'scheduled'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status IN ('searching_drivers', 'awaiting_client_confirmation')
     AND NEW.driver_profile_id IS NOT NULL THEN
    NEW.status := 'awaiting_driver_confirmation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_driver_recheck_before_scheduled ON public.trips;
CREATE TRIGGER trg_require_driver_recheck_before_scheduled
  BEFORE UPDATE OF status, driver_profile_id ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.require_driver_recheck_before_scheduled();

CREATE OR REPLACE FUNCTION public.notify_driver_recheck_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_user_id UUID;
  v_pickup TEXT;
  v_dropoff TEXT;
BEGIN
  IF NEW.status = 'awaiting_driver_confirmation'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.driver_profile_id IS NOT NULL THEN

    SELECT pp.user_id
    INTO v_driver_user_id
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = NEW.driver_profile_id;

    SELECT a.formatted_address
    INTO v_pickup
    FROM public.addresses a
    WHERE a.id = NEW.pickup_address_id;

    SELECT a.formatted_address
    INTO v_dropoff
    FROM public.addresses a
    WHERE a.id = NEW.dropoff_address_id;

    IF v_driver_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        reference_type,
        reference_id,
        link
      )
      VALUES (
        v_driver_user_id,
        'Confirme o agendamento',
        'O passageiro aceitou sua proposta para ' ||
          COALESCE(split_part(v_pickup, ',', 1), 'origem') ||
          ' -> ' ||
          COALESCE(split_part(v_dropoff, ',', 1), 'destino') ||
          '. Confirme ou recuse o agendamento.',
        'trip_driver_confirmation',
        'trip',
        NEW.id,
        '/schedules/' || NEW.id::TEXT
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_recheck_requested ON public.trips;
CREATE TRIGGER trg_notify_driver_recheck_requested
  AFTER UPDATE OF status, driver_profile_id ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_recheck_requested();

CREATE OR REPLACE FUNCTION public.reject_trip_candidates_when_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.trip_driver_candidates
    SET status = 'rejected',
        responded_at = COALESCE(responded_at, NOW()),
        observations = COALESCE(observations, 'Corrida cancelada pela KZ')
    WHERE trip_id = NEW.id
      AND status IN ('pending', 'accepted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_trip_candidates_when_cancelled ON public.trips;
CREATE TRIGGER trg_reject_trip_candidates_when_cancelled
  AFTER UPDATE OF status ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_trip_candidates_when_cancelled();
