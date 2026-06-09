-- ============================================================================
-- Migration: permitir motorista candidato visualizar suas candidaturas e trips
-- ============================================================================

-- 1) trip_driver_candidates_select
-- Adiciona "candidato vê sua própria candidatura" às permissões existentes.
DROP POLICY IF EXISTS "trip_driver_candidates_select"
  ON public.trip_driver_candidates;

CREATE POLICY "trip_driver_candidates_select"
ON public.trip_driver_candidates
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'::user_role
  OR EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = trip_driver_candidates.trip_id
      AND (
        t.client_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.driver_profiles dp
          JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
          WHERE dp.id = t.driver_profile_id
            AND pp.user_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    -- Candidato vendo sua própria candidatura
    SELECT 1
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = trip_driver_candidates.driver_profile_id
      AND pp.user_id = auth.uid()
  )
);

-- 2) trips_select
-- Adiciona "candidato vê a trip onde foi indicado" às permissões existentes.
DROP POLICY IF EXISTS "trips_select" ON public.trips;

CREATE POLICY "trips_select"
ON public.trips
FOR SELECT
TO authenticated
USING (
  client_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = trips.driver_profile_id
      AND pp.user_id = auth.uid()
  )
  OR EXISTS (
    -- Candidato vendo a trip parent
    SELECT 1
    FROM public.trip_driver_candidates tdc
    JOIN public.driver_profiles dp ON dp.id = tdc.driver_profile_id
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE tdc.trip_id = trips.id
      AND pp.user_id = auth.uid()
  )
  OR public.get_user_role() = 'admin'::user_role
);
