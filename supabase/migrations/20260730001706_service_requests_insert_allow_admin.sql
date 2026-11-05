-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- Admin precisa criar service_requests em nome de clientes (NovaSolicitacaoForm).
-- Policy antiga exigia client_id=auth.uid()+role='client' — bloqueava admin.

DROP POLICY IF EXISTS service_requests_insert ON public.service_requests;

CREATE POLICY service_requests_insert
  ON public.service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (client_id = auth.uid() AND public.get_user_role() = 'client')
    OR public.get_user_role() = 'admin'
  );
