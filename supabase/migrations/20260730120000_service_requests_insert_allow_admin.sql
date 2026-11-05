-- ============================================================================
-- Fix: admin precisa criar service_requests em nome de clientes via painel
-- (NovaSolicitacaoForm). Policy INSERT antiga exigia
-- client_id = auth.uid() + role='client', bloqueando admin.
-- ============================================================================

-- +goose Up
DROP POLICY IF EXISTS service_requests_insert ON public.service_requests;

CREATE POLICY service_requests_insert
  ON public.service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (client_id = auth.uid() AND public.get_user_role() = 'client')
    OR public.get_user_role() = 'admin'
  );

-- +goose Down
DROP POLICY IF EXISTS service_requests_insert ON public.service_requests;
CREATE POLICY service_requests_insert
  ON public.service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid() AND public.get_user_role() = 'client');
