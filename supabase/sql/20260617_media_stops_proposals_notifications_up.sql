INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'Profile_Images',
    'Profile_Images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'Vehicle_Photos',
    'Vehicle_Photos',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_images_public_read ON storage.objects;
CREATE POLICY profile_images_public_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'Profile_Images');

DROP POLICY IF EXISTS profile_images_authenticated_insert ON storage.objects;
CREATE POLICY profile_images_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Profile_Images');

DROP POLICY IF EXISTS profile_images_owner_or_admin_update ON storage.objects;
CREATE POLICY profile_images_owner_or_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Profile_Images'
  AND (
    owner = auth.uid()
    OR public.get_user_role() = 'admin'
  )
)
WITH CHECK (bucket_id = 'Profile_Images');

DROP POLICY IF EXISTS vehicle_photos_public_read ON storage.objects;
CREATE POLICY vehicle_photos_public_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'Vehicle_Photos');

DROP POLICY IF EXISTS vehicle_photos_authenticated_insert ON storage.objects;
CREATE POLICY vehicle_photos_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Vehicle_Photos');

DROP POLICY IF EXISTS vehicle_photos_owner_or_admin_update ON storage.objects;
CREATE POLICY vehicle_photos_owner_or_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Vehicle_Photos'
  AND (
    owner = auth.uid()
    OR public.get_user_role() = 'admin'
  )
)
WITH CHECK (bucket_id = 'Vehicle_Photos');

CREATE TABLE IF NOT EXISTS public.trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  stop_order integer NOT NULL CHECK (stop_order >= 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE (trip_id, stop_order)
);

ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id_order
  ON public.trip_stops(trip_id, stop_order);

DROP POLICY IF EXISTS trip_stops_select ON public.trip_stops;
CREATE POLICY trip_stops_select
ON public.trip_stops
FOR SELECT
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = trip_stops.trip_id
      AND (
        t.client_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.driver_profiles dp
          JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
          WHERE dp.id = t.driver_profile_id
            AND pp.user_id = auth.uid()
        )
        OR public.is_trip_candidate_for_current_user(t.id)
      )
  )
);

DROP POLICY IF EXISTS trip_stops_insert ON public.trip_stops;
CREATE POLICY trip_stops_insert
ON public.trip_stops
FOR INSERT
WITH CHECK (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = trip_stops.trip_id
      AND t.client_id = auth.uid()
  )
);

ALTER TABLE public.trip_driver_candidates
  ADD COLUMN IF NOT EXISTS price_rejection_reason text,
  ADD COLUMN IF NOT EXISTS price_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS kz_proposed_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS kz_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kz_proposal_locked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_kz_proposal_locked
  ON public.trip_driver_candidates(trip_id, kz_proposal_locked);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fcm_token text,
  ADD COLUMN IF NOT EXISTS fcm_token_updated_at timestamptz;

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS fcm_token text,
  ADD COLUMN IF NOT EXISTS fcm_token_updated_at timestamptz;

INSERT INTO public.service_categories (name, slug, description, service_type, is_active)
VALUES
  ('Gestão de obra', 'gestao-de-obra', 'Acompanhamento e gestão de obras residenciais e comerciais', 'other_service', true),
  ('Churrasqueiro', 'churrasqueiro', 'Profissional para churrascos e eventos', 'other_service', true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  service_type = EXCLUDED.service_type,
  is_active = true;
