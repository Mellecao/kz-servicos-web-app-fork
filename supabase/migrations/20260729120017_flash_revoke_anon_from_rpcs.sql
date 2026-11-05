-- +goose Up
-- Hardening: RPCs Flash não devem ser executáveis por anon (não autenticado).
-- Comportamento default do Postgres é GRANT EXECUTE TO PUBLIC; revogamos explicitamente.

REVOKE EXECUTE ON FUNCTION public.create_flash_trip(uuid,uuid,uuid,int,int,int,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_send_flash_proposal(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_flash_call(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.client_accept_flash_proposal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_flash_recheck_confirm(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_flash_recheck_reject(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_flash_trip(uuid, text) FROM PUBLIC, anon;

-- +goose Down
GRANT EXECUTE ON FUNCTION public.create_flash_trip(uuid,uuid,uuid,int,int,int,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_send_flash_proposal(uuid, numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_flash_call(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_accept_flash_proposal(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_flash_recheck_confirm(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_flash_recheck_reject(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_flash_trip(uuid, text) TO PUBLIC;
