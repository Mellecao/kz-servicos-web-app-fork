set check_function_bodies = false;

drop trigger trg_notify_driver_recheck_requested on public.trips;

drop function public.notify_driver_recheck_requested();

drop trigger trg_reject_trip_candidates_when_cancelled on public.trips;

drop function public.reject_trip_candidates_when_cancelled();

drop trigger trg_require_driver_recheck_before_scheduled on public.trips;

drop function public.require_driver_recheck_before_scheduled();

alter publication supabase_realtime add table public.trip_driver_candidates;

create or replace function public.get_user_role()
  returns public.user_role
  language sql
  stable
  security definer
  AS $function$
  SELECT role FROM public.users WHERE id = auth.uid();
$function$;

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  AS $function$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone, role, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'client',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$function$;

create or replace function public.is_trip_candidate_for_current_user (
  p_trip_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_driver_candidates tdc
    JOIN public.driver_profiles dp ON dp.id = tdc.driver_profile_id
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE tdc.trip_id = p_trip_id
      AND pp.user_id = auth.uid()
  );
$function$;

create or replace function public.log_service_request_status_change()
  returns trigger
  language plpgsql
  security definer
  AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO service_request_status_history (service_request_id, from_status, to_status, changed_by)
    VALUES (
      NEW.id,
      OLD.status::VARCHAR,
      NEW.status::VARCHAR,
      COALESCE(auth.uid(), NEW.client_id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

create or replace function public.log_trip_status_change()
  returns trigger
  language plpgsql
  security definer
  AS $function$
DECLARE
  v_observation TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_observation := NULLIF(current_setting('app.status_observation', true), '');
    INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, observations)
    VALUES (
      NEW.id,
      OLD.status::VARCHAR,
      NEW.status::VARCHAR,
      COALESCE(auth.uid(), NEW.client_id),
      v_observation
    );
  END IF;
  RETURN NEW;
END;
$function$;

create or replace function public.recalculate_provider_rating()
  returns trigger
  language plpgsql
  security definer
  AS $function$
DECLARE
  v_provider_profile_id UUID;
  v_avg                 DECIMAL(3,2);
  v_total               INTEGER;
BEGIN
  SELECT id INTO v_provider_profile_id
  FROM provider_profiles
  WHERE user_id = NEW.rated_id;

  IF v_provider_profile_id IS NOT NULL THEN
    SELECT COALESCE(AVG(r.rating), 0), COUNT(r.id)
    INTO v_avg, v_total
    FROM ratings r
    WHERE r.rated_id = NEW.rated_id;

    UPDATE provider_profiles
    SET average_rating = v_avg,
        total_ratings  = v_total
    WHERE id = v_provider_profile_id;
  END IF;

  RETURN NEW;
END;
$function$;

create or replace function public.reject_trip (
  p_trip_id uuid,
  p_reason  text default null::text
)
  returns void
  language plpgsql
  AS $function$
BEGIN
  PERFORM set_config('app.status_observation', COALESCE(p_reason, ''), true);
  UPDATE trips
    SET status = 'open'
    WHERE id = p_trip_id;
END;
$function$;

create or replace function public.select_trip_driver (
  p_trip_id           uuid,
  p_candidate_id      uuid,
  p_driver_profile_id uuid,
  p_offered_price     numeric
)
  returns void
  language plpgsql
  security definer
  AS $function$
BEGIN
  UPDATE trips
  SET driver_profile_id = p_driver_profile_id,
      final_price       = p_offered_price,
      status            = 'scheduled'
  WHERE id = p_trip_id
    AND status = 'searching_drivers';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip % is not in searching_drivers status', p_trip_id;
  END IF;

  UPDATE trip_driver_candidates
  SET status       = 'accepted',
      responded_at = NOW()
  WHERE id = p_candidate_id;

  UPDATE trip_driver_candidates
  SET status       = 'rejected',
      responded_at = NOW()
  WHERE trip_id = p_trip_id
    AND id != p_candidate_id;
END;
$function$;

create or replace function public.set_address_location()
  returns trigger
  language plpgsql
  AS $function$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$function$;

create or replace function public.set_driver_location()
  returns trigger
  language plpgsql
  AS $function$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$function$;

create or replace function public.update_updated_at_column()
  returns trigger
  language plpgsql
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

alter table public.trip_driver_candidates
  replica identity full;

alter table public.trip_driver_candidates
  add column offered_price numeric(10,2);

alter table public.trip_driver_candidates
  add column admin_approved boolean default false not null;

create index idx_trip_driver_candidates_admin_approved on public.trip_driver_candidates (trip_id, admin_approved);

alter table public.trips
  add column driver_arrived_at timestamp with time zone