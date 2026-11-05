-- Ajuste do pedido direto: a proteção contra duplicados bloqueava qualquer pedido em curso com o prestador,
-- o que impediria um cliente de contratar o mesmo prestador para um segundo trabalho.
-- Agora só bloqueia o clique duplo: mesmo cliente + mesmo prestador + mesma categoria, ainda a aguardar
-- proposta, criado nos últimos 10 minutos.
CREATE OR REPLACE FUNCTION public.client_request_service_from_provider(
  p_provider_profile_id uuid,
  p_service_category_id uuid,
  p_description         text,
  p_service_date        timestamptz DEFAULT now(),
  p_address_id          uuid DEFAULT NULL,
  p_observations        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_request_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF get_user_role() <> 'client' THEN
    RAISE EXCEPTION 'Apenas clientes podem pedir serviços' USING ERRCODE = '42501';
  END IF;
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Descreva o serviço de que precisa' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.provider_profiles pp
    WHERE pp.id = p_provider_profile_id AND pp.status = 'approved'
      AND (pp.service_category_id = p_service_category_id
           OR EXISTS (SELECT 1 FROM public.provider_category_services pcs
                      WHERE pcs.provider_profile_id = pp.id AND pcs.service_category_id = p_service_category_id))
  ) THEN
    RAISE EXCEPTION 'Prestador indisponível para este serviço' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.service_requests sr
    JOIN public.service_request_provider_candidates c ON c.service_request_id = sr.id
    WHERE sr.client_id = v_uid
      AND c.provider_profile_id = p_provider_profile_id
      AND sr.service_category_id = p_service_category_id
      AND sr.status = 'searching_provider'
      AND sr.created_at > now() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Já enviou um pedido a este prestador. Aguarde a proposta dele' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_requests (client_id, service_category_id, description, service_date, address_id, observations, status)
  VALUES (v_uid, p_service_category_id, btrim(p_description), COALESCE(p_service_date, now()), p_address_id,
          NULLIF(btrim(p_observations), ''), 'searching_provider')
  RETURNING id INTO v_request_id;

  INSERT INTO public.service_request_provider_candidates (service_request_id, provider_profile_id)
  VALUES (v_request_id, p_provider_profile_id);

  INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id, link)
  SELECT u.id, 'Novo pedido direto a prestador',
         'Um cliente escolheu um prestador no mapa. Acompanhe a proposta de preço.',
         'service_request', 'service_request', v_request_id, '/outros-servicos'
  FROM public.users u
  WHERE u.role = 'admin' AND COALESCE(u.is_active, true);

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.client_request_service_from_provider(uuid, uuid, text, timestamptz, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_request_service_from_provider(uuid, uuid, text, timestamptz, uuid, text) TO authenticated;
