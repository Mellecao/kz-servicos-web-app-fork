-- +goose Up
-- Dispatch filters, nearby drivers and persistent multi-leg trip execution.

DO $$ BEGIN
  CREATE TYPE public.vehicle_category AS ENUM ('simple', 'popular', 'luxury');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_execution_stage AS ENUM (
    'to_pickup', 'to_stop', 'waiting_at_stop', 'to_destination',
    'waiting_for_return', 'returning', 'finished'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS category public.vehicle_category;

CREATE TABLE IF NOT EXISTS public.driver_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  normalized_name text GENERATED ALWAYS AS (lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS public.driver_profile_regions (
  driver_profile_id uuid NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.driver_regions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_profile_id, region_id)
);

ALTER TABLE public.driver_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profile_regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_regions_admin_all ON public.driver_regions;
CREATE POLICY driver_regions_admin_all ON public.driver_regions FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role() = 'admin'::public.user_role);
DROP POLICY IF EXISTS driver_regions_authenticated_read ON public.driver_regions;
CREATE POLICY driver_regions_authenticated_read ON public.driver_regions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS driver_profile_regions_admin_all ON public.driver_profile_regions;
CREATE POLICY driver_profile_regions_admin_all ON public.driver_profile_regions FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role() = 'admin'::public.user_role);
DROP POLICY IF EXISTS driver_profile_regions_driver_read ON public.driver_profile_regions;
CREATE POLICY driver_profile_regions_driver_read ON public.driver_profile_regions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.driver_profiles dp JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = driver_profile_regions.driver_profile_id AND pp.user_id = auth.uid()
  ));

GRANT SELECT ON public.driver_regions, public.driver_profile_regions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.driver_regions, public.driver_profile_regions TO authenticated;

-- Some production environments predate the stops migration. Create its base
-- table before extending it so this script can be safely run from SQL Editor.
CREATE TABLE IF NOT EXISTS public.trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  stop_order integer NOT NULL CHECK (stop_order >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, stop_order)
);
ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id_order
  ON public.trip_stops(trip_id, stop_order);
DROP POLICY IF EXISTS trip_stops_select ON public.trip_stops;
CREATE POLICY trip_stops_select ON public.trip_stops FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'admin'::public.user_role
  OR EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_stops.trip_id AND (
      t.client_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.driver_profiles dp
        JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
        WHERE dp.id = t.driver_profile_id AND pp.user_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.trip_driver_candidates tdc
        JOIN public.driver_profiles dp ON dp.id = tdc.driver_profile_id
        JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
        WHERE tdc.trip_id = t.id
          AND pp.user_id = auth.uid()
      )
    )
  )
);
DROP POLICY IF EXISTS trip_stops_insert ON public.trip_stops;
CREATE POLICY trip_stops_insert ON public.trip_stops FOR INSERT TO authenticated
WITH CHECK (public.get_user_role() = 'admin'::public.user_role);

ALTER TABLE public.trip_stops
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS execution_stage public.trip_execution_stage,
  ADD COLUMN IF NOT EXISTS current_stop_order integer,
  ADD COLUMN IF NOT EXISTS return_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_arrived_at timestamptz;

UPDATE public.trips
SET execution_stage = CASE
  WHEN status = 'finished' THEN 'finished'::public.trip_execution_stage
  WHEN started_at IS NOT NULL THEN 'to_destination'::public.trip_execution_stage
  WHEN driver_arrived_at IS NOT NULL THEN 'to_pickup'::public.trip_execution_stage
  ELSE NULL
END
WHERE execution_stage IS NULL;

CREATE INDEX IF NOT EXISTS idx_driver_profile_regions_region ON public.driver_profile_regions(region_id, driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_active_category ON public.vehicles(category, driver_profile_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_driver_locations_recent ON public.driver_locations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_stops_execution ON public.trip_stops(trip_id, stop_order, arrived_at);

-- Candidate rejections remain auditable but never produce admin notifications.
CREATE OR REPLACE FUNCTION public.trigger_admin_notification_on_candidate_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text = 'accepted' THEN
    PERFORM public.notify_admins_for_trip_action('admin_driver_returned_proposal', 'Motorista retornou proposta', 'Um motorista aceitou a corrida ou informou uma proposta para análise.', NEW.trip_id);
  ELSIF OLD.offered_price IS DISTINCT FROM NEW.offered_price AND NEW.offered_price IS NOT NULL THEN
    PERFORM public.notify_admins_for_trip_action('admin_driver_returned_price', 'Motorista retornou preço', 'Um motorista enviou ou atualizou o preço proposto para uma corrida.', NEW.trip_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Inserts every approved driver only once. Existing candidate insert triggers keep push delivery.
CREATE OR REPLACE FUNCTION public.add_all_approved_trip_candidates(p_trip_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inserted integer;
BEGIN
  IF public.get_user_role() <> 'admin'::public.user_role THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_trip_id::text));
  INSERT INTO public.trip_driver_candidates (trip_id, driver_profile_id, status)
  SELECT p_trip_id, dp.id, 'pending'::public.trip_status_candidate
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.status = 'approved'::public.provider_status
    AND NOT EXISTS (SELECT 1 FROM public.trip_driver_candidates c WHERE c.trip_id = p_trip_id AND c.driver_profile_id = dp.id);
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_all_approved_trip_candidates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.nearby_trip_drivers(p_trip_id uuid, p_radius_meters integer DEFAULT 10000)
RETURNS TABLE(driver_profile_id uuid, distance_meters double precision, vehicle_category public.vehicle_category, regions text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT dp.id, ST_Distance(dl.location, pickup.location), v.category,
         COALESCE(array_agg(DISTINCT dr.name) FILTER (WHERE dr.id IS NOT NULL), ARRAY[]::text[])
  FROM public.trips t
  JOIN public.addresses pickup ON pickup.id = t.pickup_address_id
  JOIN public.driver_locations dl ON ST_DWithin(dl.location, pickup.location, LEAST(GREATEST(p_radius_meters, 1), 50000))
  JOIN public.driver_profiles dp ON dp.id = dl.driver_profile_id
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id AND pp.status = 'approved'::public.provider_status
  LEFT JOIN LATERAL (SELECT category FROM public.vehicles WHERE driver_profile_id = dp.id AND is_active ORDER BY updated_at DESC LIMIT 1) v ON true
  LEFT JOIN public.driver_profile_regions dpr ON dpr.driver_profile_id = dp.id
  LEFT JOIN public.driver_regions dr ON dr.id = dpr.region_id
  WHERE t.id = p_trip_id AND dl.updated_at >= now() - interval '10 minutes'
  GROUP BY dp.id, dl.location, pickup.location, v.category
  ORDER BY ST_Distance(dl.location, pickup.location), dp.id;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_trip_drivers(uuid, integer) TO authenticated;

-- Server-enforced transition prevents completion before all stops and return legs.
CREATE OR REPLACE FUNCTION public.advance_trip_execution(p_trip_id uuid)
RETURNS public.trip_execution_stage LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_trip public.trips%ROWTYPE; v_next_stop public.trip_stops%ROWTYPE;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corrida não encontrada'; END IF;
  IF public.get_user_role() <> 'admin'::public.user_role AND NOT EXISTS (
    SELECT 1
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = v_trip.driver_profile_id AND pp.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  CASE v_trip.execution_stage
    WHEN 'to_pickup' THEN UPDATE public.trips SET driver_arrived_at = COALESCE(driver_arrived_at, now()) WHERE id = p_trip_id;
    WHEN 'to_stop' THEN
      SELECT * INTO v_next_stop FROM public.trip_stops WHERE trip_id = p_trip_id AND arrived_at IS NULL ORDER BY stop_order LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'Não há parada pendente'; END IF;
      UPDATE public.trip_stops SET arrived_at = now() WHERE id = v_next_stop.id;
      UPDATE public.trips SET execution_stage = 'waiting_at_stop', current_stop_order = v_next_stop.stop_order WHERE id = p_trip_id;
    WHEN 'waiting_at_stop' THEN
      UPDATE public.trip_stops SET resumed_at = now() WHERE trip_id = p_trip_id AND stop_order = v_trip.current_stop_order AND resumed_at IS NULL;
      IF EXISTS (SELECT 1 FROM public.trip_stops WHERE trip_id = p_trip_id AND arrived_at IS NULL) THEN
        UPDATE public.trips SET execution_stage = 'to_stop' WHERE id = p_trip_id;
      ELSE UPDATE public.trips SET execution_stage = 'to_destination' WHERE id = p_trip_id; END IF;
    WHEN 'to_destination' THEN
      IF v_trip.is_round_trip THEN UPDATE public.trips SET execution_stage = 'waiting_for_return' WHERE id = p_trip_id;
      ELSE UPDATE public.trips SET execution_stage = 'finished', status = 'finished', finished_at = now() WHERE id = p_trip_id; END IF;
    WHEN 'waiting_for_return' THEN UPDATE public.trips SET execution_stage = 'returning', return_started_at = now() WHERE id = p_trip_id;
    WHEN 'returning' THEN UPDATE public.trips SET execution_stage = 'finished', status = 'finished', finished_at = now(), return_arrived_at = now() WHERE id = p_trip_id;
    ELSE RAISE EXCEPTION 'A corrida já está finalizada';
  END CASE;
  IF v_trip.execution_stage = 'to_pickup' THEN
    UPDATE public.trips SET execution_stage = CASE WHEN EXISTS (SELECT 1 FROM public.trip_stops WHERE trip_id = p_trip_id) THEN 'to_stop'::public.trip_execution_stage ELSE 'to_destination'::public.trip_execution_stage END, started_at = COALESCE(started_at, now()), status = 'started' WHERE id = p_trip_id;
  END IF;
  RETURN (SELECT execution_stage FROM public.trips WHERE id = p_trip_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.advance_trip_execution(uuid) TO authenticated;

-- +goose Down
-- Intentionally omitted: this migration alters production trip history.
