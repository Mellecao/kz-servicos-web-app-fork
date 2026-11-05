-- Marca "KZ" -> "Só Serviços" nos textos gerados pelo servidor que faltaram na migration anterior.
-- Só reescreve texto de 2 funções existentes; não toca em dados.
DO $$
DECLARE
  r     record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('notify_support_message_recipient', 'reject_service_request_candidates_when_cancelled')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(replace(v_def,
      'Nova mensagem da KZ', 'Nova mensagem da Só Serviços'),
      'Solicitação cancelada pela KZ', 'Solicitação cancelada pela Só Serviços');
    IF v_new IS DISTINCT FROM v_def THEN
      EXECUTE v_new;
    END IF;
  END LOOP;
END $$;
