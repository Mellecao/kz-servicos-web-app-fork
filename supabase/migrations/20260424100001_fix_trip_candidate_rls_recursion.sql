-- ============================================================================
-- Migration: corrige recursão infinita em RLS entre trips e trip_driver_candidates
-- ============================================================================
-- Problema: a versão anterior fez trips_select referenciar trip_driver_candidates
-- via EXISTS, e trip_driver_candidates_select referencia trips. Postgres aplica
-- RLS dentro de subqueries, então um dispara o outro recursivamente.
--
-- Solução: usar uma função SECURITY DEFINER para o check de candidatura. Como
-- ela executa com privilégios do owner, bypassa RLS e quebra o ciclo. Mesmo
-- pattern usado por public.get_user_role().
-- ============================================================================

-- 1) Helper SECURITY DEFINER: checa se auth.uid() é candidato para uma trip
CREATE OR REPLACE FUNCTION public.is_trip_candidate_for_current_user(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_driver_candidates tdc
    JOIN public.driver_profiles dp ON dp.id = tdc.driver_profile_id
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE tdc.trip_id = p_trip_id
      AND pp.user_id = auth.uid()
  );
$$;

-- Permitir que clientes autenticados chamem a função (apenas SELECT, é STABLE)
GRANT EXECUTE ON FUNCTION public.is_trip_candidate_for_current_user(uuid) TO authenticated;

-- 2) trips_select: usa a função em vez de EXISTS — quebra o ciclo
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
  OR public.is_trip_candidate_for_current_user(trips.id)
  OR public.get_user_role() = 'admin'::user_role
);

-- 3) trip_driver_candidates_select: mantém a versão da migration anterior
-- (não muda — a parte do candidato vendo a própria candidatura não recursa)
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
    SELECT 1
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = trip_driver_candidates.driver_profile_id
      AND pp.user_id = auth.uid()
  )
);
