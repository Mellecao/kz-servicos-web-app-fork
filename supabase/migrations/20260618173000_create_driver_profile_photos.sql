-- ============================================================================
-- Migration: Driver profile photos
-- Description: Additional public driver photos shown in client driver details.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS public.driver_profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.driver_profile_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_profile_photos_driver_profile_id
  ON public.driver_profile_photos(driver_profile_id, sort_order, created_at);

DROP POLICY IF EXISTS driver_profile_photos_select ON public.driver_profile_photos;
CREATE POLICY driver_profile_photos_select
ON public.driver_profile_photos
FOR SELECT
USING (true);

DROP POLICY IF EXISTS driver_profile_photos_insert ON public.driver_profile_photos;
CREATE POLICY driver_profile_photos_insert
ON public.driver_profile_photos
FOR INSERT
WITH CHECK (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = driver_profile_photos.driver_profile_id
      AND pp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS driver_profile_photos_delete ON public.driver_profile_photos;
CREATE POLICY driver_profile_photos_delete
ON public.driver_profile_photos
FOR DELETE
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE dp.id = driver_profile_photos.driver_profile_id
      AND pp.user_id = auth.uid()
  )
);

-- +goose Down
DROP POLICY IF EXISTS driver_profile_photos_delete ON public.driver_profile_photos;
DROP POLICY IF EXISTS driver_profile_photos_insert ON public.driver_profile_photos;
DROP POLICY IF EXISTS driver_profile_photos_select ON public.driver_profile_photos;
DROP TABLE IF EXISTS public.driver_profile_photos;
