-- +goose Up

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Service_Request_Photos',
  'Service_Request_Photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS service_request_photos_storage_public_read ON storage.objects;
CREATE POLICY service_request_photos_storage_public_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'Service_Request_Photos');

DROP POLICY IF EXISTS service_request_photos_storage_authenticated_insert ON storage.objects;
CREATE POLICY service_request_photos_storage_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Service_Request_Photos');

DROP POLICY IF EXISTS service_request_photos_storage_owner_or_admin_update ON storage.objects;
CREATE POLICY service_request_photos_storage_owner_or_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Service_Request_Photos'
  AND (
    owner = auth.uid()
    OR public.get_user_role() = 'admin'
  )
)
WITH CHECK (bucket_id = 'Service_Request_Photos');

CREATE TABLE IF NOT EXISTS public.service_request_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_request_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_request_photos_request_order
  ON public.service_request_photos(service_request_id, sort_order, created_at);

DROP POLICY IF EXISTS service_request_photos_select ON public.service_request_photos;
CREATE POLICY service_request_photos_select
ON public.service_request_photos
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.service_requests sr
    WHERE sr.id = service_request_photos.service_request_id
      AND (
        sr.client_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.provider_profiles pp
          WHERE pp.id = sr.provider_profile_id
            AND pp.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS service_request_photos_insert ON public.service_request_photos;
CREATE POLICY service_request_photos_insert
ON public.service_request_photos
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.service_requests sr
    WHERE sr.id = service_request_photos.service_request_id
      AND sr.client_id = auth.uid()
  )
);

DROP POLICY IF EXISTS service_request_photos_delete ON public.service_request_photos;
CREATE POLICY service_request_photos_delete
ON public.service_request_photos
FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.service_requests sr
    WHERE sr.id = service_request_photos.service_request_id
      AND sr.client_id = auth.uid()
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
  END IF;
END $$;

-- +goose Down

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.service_requests;
  END IF;
END $$;

DROP POLICY IF EXISTS service_request_photos_delete ON public.service_request_photos;
DROP POLICY IF EXISTS service_request_photos_insert ON public.service_request_photos;
DROP POLICY IF EXISTS service_request_photos_select ON public.service_request_photos;
DROP TABLE IF EXISTS public.service_request_photos;

DROP POLICY IF EXISTS service_request_photos_storage_owner_or_admin_update ON storage.objects;
DROP POLICY IF EXISTS service_request_photos_storage_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS service_request_photos_storage_public_read ON storage.objects;
