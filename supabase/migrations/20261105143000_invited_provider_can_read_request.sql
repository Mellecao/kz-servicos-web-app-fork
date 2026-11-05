-- Prestador convidado (service_request_provider_candidates) passa a poder LER o pedido
-- para o qual foi convidado. Antes, service_requests_select só deixava ver pedidos cujo
-- provider_profile_id já era o do prestador, por isso um convite 'pending' ficava
-- invisível e a lista de convites do app Prestador vinha sempre vazia.
-- Aditivo: policies permissivas somam-se (OR) às existentes. A função helper é
-- SECURITY DEFINER (sem recursão de RLS).
DO $$ BEGIN
  CREATE POLICY service_requests_select_invited_provider ON public.service_requests
    FOR SELECT TO authenticated
    USING (public.is_service_request_provider_candidate_for_current_user(id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reversão: DROP POLICY IF EXISTS service_requests_select_invited_provider ON public.service_requests;
