-- Segurança: 7 RPCs de viagens que alteram dados estavam executáveis por QUALQUER pessoa, inclusive sem login
-- (chave pública do app). Três delas não têm nenhuma verificação interna (nearby_trip_drivers expõe a posição
-- dos motoristas; select_trip_driver; notify_admins_for_trip_action).
-- Correção mínima e reversível: exigir login. Para utilizadores autenticados nada muda; a lógica não é tocada.
-- (get_user_role e is_*_for_current_user ficam como estão: as políticas RLS dependem deles.)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'add_all_approved_trip_candidates', 'advance_trip_execution', 'insert_trip_stop_address',
        'nearby_trip_drivers', 'notify_admins_for_trip_action', 'rollback_failed_trip_creation',
        'select_trip_driver'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
