-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- Revoga acesso público (inclui anon) das RPCs Flash. Só authenticated executa.
REVOKE EXECUTE ON FUNCTION public.create_flash_trip(uuid,uuid,uuid,int,int,int,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_send_flash_proposal(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_flash_call(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.client_accept_flash_proposal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_flash_recheck_confirm(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_flash_recheck_reject(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_flash_trip(uuid, text) FROM PUBLIC, anon;
