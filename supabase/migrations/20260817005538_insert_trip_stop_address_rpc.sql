-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

CREATE OR REPLACE FUNCTION public.insert_trip_stop_address(p_trip_id UUID,p_stop_order INTEGER,p_address JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_address_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.id=p_trip_id AND t.client_id=auth.uid()) THEN RAISE EXCEPTION 'Trip not found or not owned by caller'; END IF;
  INSERT INTO public.addresses (google_place_id,formatted_address,street,number,complement,neighborhood,city,state,zip_code,latitude,longitude)
  VALUES (p_address->>'google_place_id',p_address->>'formatted_address',p_address->>'street',p_address->>'number',p_address->>'complement',p_address->>'neighborhood',p_address->>'city',p_address->>'state',p_address->>'zip_code',(p_address->>'latitude')::DOUBLE PRECISION,(p_address->>'longitude')::DOUBLE PRECISION)
  RETURNING id INTO v_address_id;
  INSERT INTO public.trip_stops (trip_id,address_id,stop_order) VALUES (p_trip_id,v_address_id,p_stop_order);
  RETURN v_address_id;
END; $$;
REVOKE ALL ON FUNCTION public.insert_trip_stop_address(UUID,INTEGER,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_trip_stop_address(UUID,INTEGER,JSONB) TO authenticated;
