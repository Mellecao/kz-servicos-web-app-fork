-- Prestador convidado ou atribuído passa a poder LER as fotos do pedido de serviço.
-- Antes, o SELECT em service_request_photos só servia admin, cliente dono e prestador
-- atribuído; o convidado não via fotos. Aditivo: policy permissiva (OR com as existentes).
DO $$ BEGIN
  CREATE POLICY service_request_photos_select_provider ON public.service_request_photos
    FOR SELECT TO authenticated
    USING (
      public.is_service_request_provider_candidate_for_current_user(service_request_id)
      OR EXISTS (
        SELECT 1
        FROM public.service_requests sr
        JOIN public.provider_profiles pp ON pp.id = sr.provider_profile_id
        WHERE sr.id = service_request_photos.service_request_id
          AND pp.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reversão: DROP POLICY IF EXISTS service_request_photos_select_provider ON public.service_request_photos;
