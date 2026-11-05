-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

CREATE OR REPLACE FUNCTION public.rollback_failed_trip_creation(p_trip_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_address_ids UUID[];
BEGIN
  SELECT array_remove(ARRAY[t.pickup_address_id,t.dropoff_address_id,t.return_pickup_address_id,t.return_dropoff_address_id]::UUID[], NULL)
  INTO v_address_ids FROM public.trips t WHERE t.id = p_trip_id AND t.client_id = auth.uid();
  IF v_address_ids IS NULL THEN RAISE EXCEPTION 'Trip not found or not owned by caller'; END IF;
  SELECT v_address_ids || COALESCE(array_agg(ts.address_id), ARRAY[]::UUID[])
  INTO v_address_ids FROM public.trip_stops ts WHERE ts.trip_id = p_trip_id;
  DELETE FROM public.trips WHERE id = p_trip_id AND client_id = auth.uid();
  DELETE FROM public.addresses a
  WHERE a.id = ANY(v_address_ids)
    AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE a.id IN (t.pickup_address_id,t.dropoff_address_id,t.return_pickup_address_id,t.return_dropoff_address_id))
    AND NOT EXISTS (SELECT 1 FROM public.trip_stops ts WHERE ts.address_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_saved_addresses usa WHERE usa.address_id = a.id);
END; $$;
REVOKE ALL ON FUNCTION public.rollback_failed_trip_creation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_failed_trip_creation(UUID) TO authenticated;
