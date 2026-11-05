-- Rejeitar um serviço na análise (under_review -> review_rejected) com motivo.
-- Só aditivo: cria uma função nova. Não altera tabelas, triggers nem dados.
--
-- Porquê: service_requests não tem coluna para o motivo e, ao contrário das viagens
-- (reject_trip), não existe RPC. O trigger log_service_request_status_change já grava
-- uma linha em service_request_status_history a cada mudança de estado, por isso esta
-- função muda o estado e acrescenta o motivo (admin) a essa linha (coluna observations).
-- Uso no painel: supabase.rpc('reject_service_request', { p_service_request_id, p_reason }).

CREATE OR REPLACE FUNCTION public.reject_service_request(
  p_service_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_history_id uuid;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar um serviço.';
  END IF;

  UPDATE public.service_requests
  SET status = 'review_rejected'
  WHERE id = p_service_request_id
    AND status = 'under_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O serviço % não está em análise.', p_service_request_id;
  END IF;

  IF v_reason IS NOT NULL THEN
    SELECT id INTO v_history_id
    FROM public.service_request_status_history
    WHERE service_request_id = p_service_request_id
      AND to_status = 'review_rejected'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_history_id IS NOT NULL THEN
      UPDATE public.service_request_status_history
      SET observations = v_reason
      WHERE id = v_history_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_service_request(uuid, text) TO authenticated;

-- Reversão: DROP FUNCTION IF EXISTS public.reject_service_request(uuid, text);
