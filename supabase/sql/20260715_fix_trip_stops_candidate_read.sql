-- Run once in Supabase SQL Editor so candidate drivers can read trip stops.
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
