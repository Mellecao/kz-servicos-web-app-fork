-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

DROP POLICY IF EXISTS trip_passengers_select ON public.trip_passengers;
CREATE POLICY trip_passengers_select ON public.trip_passengers FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
      t.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.driver_profiles dp
        JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
        WHERE pp.user_id = auth.uid()
      )
      OR public.get_user_role() = 'admin'
    )
  )
);
DROP POLICY IF EXISTS trip_luggage_select ON public.trip_luggage;
CREATE POLICY trip_luggage_select ON public.trip_luggage FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
      t.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.driver_profiles dp
        JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
        WHERE pp.user_id = auth.uid()
      )
      OR public.get_user_role() = 'admin'
    )
  )
);
