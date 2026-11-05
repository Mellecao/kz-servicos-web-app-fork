-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- Persist named passengers and detailed luggage for each trip.
-- This migration is intentionally additive so legacy clients and rows remain valid.

CREATE TABLE IF NOT EXISTS public.trip_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
  needs_car_seat BOOLEAN GENERATED ALWAYS AS (age <= 10) STORED,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, sort_order)
);

CREATE INDEX IF NOT EXISTS trip_passengers_trip_id_idx ON public.trip_passengers (trip_id);
ALTER TABLE public.trip_passengers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_passengers_select ON public.trip_passengers;
CREATE POLICY trip_passengers_select ON public.trip_passengers FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
      t.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.driver_profiles dp
        JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
        WHERE dp.id = t.driver_profile_id AND pp.user_id = auth.uid()
      )
      OR public.get_user_role() = 'admin'
    )
  )
);

DROP POLICY IF EXISTS trip_passengers_insert ON public.trip_passengers;
CREATE POLICY trip_passengers_insert ON public.trip_passengers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.client_id = auth.uid())
  OR public.get_user_role() = 'admin'
);

DROP POLICY IF EXISTS trip_passengers_update ON public.trip_passengers;
CREATE POLICY trip_passengers_update ON public.trip_passengers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.client_id = auth.uid() OR public.get_user_role() = 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.client_id = auth.uid() OR public.get_user_role() = 'admin')));

DROP POLICY IF EXISTS trip_passengers_delete ON public.trip_passengers;
CREATE POLICY trip_passengers_delete ON public.trip_passengers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.client_id = auth.uid() OR public.get_user_role() = 'admin'))
);

ALTER TABLE public.trip_luggage
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE public.trip_luggage SET type = 'unspecified' WHERE type IS NULL OR length(btrim(type)) = 0;
ALTER TABLE public.trip_luggage ALTER COLUMN type SET DEFAULT 'unspecified', ALTER COLUMN type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_luggage_type_not_blank' AND conrelid = 'public.trip_luggage'::regclass) THEN
    ALTER TABLE public.trip_luggage ADD CONSTRAINT trip_luggage_type_not_blank CHECK (length(btrim(type)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_luggage_weight_kg_positive' AND conrelid = 'public.trip_luggage'::regclass) THEN
    ALTER TABLE public.trip_luggage ADD CONSTRAINT trip_luggage_weight_kg_positive CHECK (weight_kg IS NULL OR weight_kg > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_luggage_sort_order_nonnegative' AND conrelid = 'public.trip_luggage'::regclass) THEN
    ALTER TABLE public.trip_luggage ADD CONSTRAINT trip_luggage_sort_order_nonnegative CHECK (sort_order >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_luggage_quantity_positive' AND conrelid = 'public.trip_luggage'::regclass) THEN
    ALTER TABLE public.trip_luggage ADD CONSTRAINT trip_luggage_quantity_positive CHECK (quantity > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trip_luggage_trip_sort_order_idx ON public.trip_luggage (trip_id, sort_order);
COMMENT ON COLUMN public.trip_luggage.type IS 'Luggage kind, for example suitcase, backpack, or other.';
COMMENT ON COLUMN public.trip_luggage.weight_kg IS 'Optional positive luggage weight in kilograms.';
