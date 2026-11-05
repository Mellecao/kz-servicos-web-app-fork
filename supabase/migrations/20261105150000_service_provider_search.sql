-- Busca de prestadores próximos + pedido direto a um prestador + interruptor das caronas.
-- Aditivo: só acrescenta colunas/funções/políticas e tranca uma função que estava aberta. Não apaga nada.

-- ---------------------------------------------------------------------------
-- 1) Dados públicos do prestador para o cartão do mapa
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS price_min            numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_max            numeric(12,2),
  ADD COLUMN IF NOT EXISTS avg_response_minutes integer,
  ADD COLUMN IF NOT EXISTS is_demo              boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.provider_profiles
    ADD CONSTRAINT provider_profiles_price_range_chk
    CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.provider_profiles.is_demo IS
  'Prestador de demonstração: não tem localização real; search_service_providers gera uma posição simulada perto do cliente.';

-- ---------------------------------------------------------------------------
-- 2) Interruptor das caronas/viagens (false = escondidas; o código das viagens fica intacto)
-- ---------------------------------------------------------------------------
INSERT INTO public.system_settings (key, value)
VALUES ('trips_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS authenticated_read_trips_enabled ON public.system_settings;
CREATE POLICY authenticated_read_trips_enabled ON public.system_settings
  FOR SELECT TO authenticated
  USING ((key)::text = 'trips_enabled');

-- ---------------------------------------------------------------------------
-- 3) Busca de prestadores próximos do cliente
--    Prestadores de demonstração ganham uma posição estável (derivada do id) a 250–1900 m
--    do ponto informado; prestadores sem localização real e sem is_demo não aparecem.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_service_providers(
  p_category_id uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_limit       integer DEFAULT 12
)
RETURNS TABLE (
  provider_profile_id  uuid,
  full_name            text,
  avatar_url           text,
  bio                  text,
  category_id          uuid,
  category_name        text,
  average_rating       numeric,
  total_ratings        integer,
  price_min            numeric,
  price_max            numeric,
  avg_response_minutes integer,
  is_demo              boolean,
  lat                  double precision,
  lng                  double precision,
  distance_m           integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'Indique a sua localização' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH cands AS (
    SELECT pp.id AS pid,
           (250 + (abs(hashtext(pp.id::text || 'd')::bigint) % 1651))::integer AS dist,
           radians((abs(hashtext(pp.id::text || 'b')::bigint) % 360)::double precision) AS brg
    FROM public.provider_profiles pp
    JOIN public.users u ON u.id = pp.user_id AND COALESCE(u.is_active, true) AND u.deleted_at IS NULL
    WHERE pp.status = 'approved'
      AND pp.is_demo
      AND (
        pp.service_category_id = p_category_id
        OR EXISTS (SELECT 1 FROM public.provider_category_services pcs
                   WHERE pcs.provider_profile_id = pp.id AND pcs.service_category_id = p_category_id)
      )
  )
  SELECT pp.id,
         u.full_name::text,
         u.avatar_url::text,
         pp.bio::text,
         sc.id,
         sc.name::text,
         COALESCE(pp.average_rating, 0),
         COALESCE(pp.total_ratings, 0),
         pp.price_min,
         pp.price_max,
         pp.avg_response_minutes,
         pp.is_demo,
         p_lat + (c.dist * cos(c.brg)) / 111320.0,
         p_lng + (c.dist * sin(c.brg)) / (111320.0 * GREATEST(cos(radians(p_lat)), 0.1)),
         c.dist
  FROM cands c
  JOIN public.provider_profiles pp ON pp.id = c.pid
  JOIN public.users u ON u.id = pp.user_id
  JOIN public.service_categories sc ON sc.id = p_category_id
  ORDER BY c.dist
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_service_providers(uuid, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_service_providers(uuid, double precision, double precision, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Pedido direto: o cliente escolheu um prestador no mapa.
--    Cria o pedido já em "searching_provider" (a escolha do cliente substitui a aprovação inicial) e
--    convida só esse prestador. A partir daqui segue o fluxo existente:
--    prestador propõe preço → admin escolhe (select_service_request_provider) → cliente aceita → ...
-- ---------------------------------------------------------------------------
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
      AND sr.status IN ('searching_provider', 'awaiting_client_confirmation', 'awaiting_provider_confirmation', 'assigned', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'Já tem um pedido em curso com este prestador' USING ERRCODE = '22023';
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

-- ---------------------------------------------------------------------------
-- 5) Segurança: select_service_request_provider estava aberta a QUALQUER pessoa (inclusive anónima)
--    e sem verificação de papel. Só o painel (admin) a usa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.select_service_request_provider(p_service_request_id uuid, p_provider_profile_id uuid, p_offered_price numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem escolher o prestador' USING ERRCODE = '42501';
  END IF;
  UPDATE public.service_requests
  SET provider_profile_id = p_provider_profile_id,
      final_price = p_offered_price,
      status = 'awaiting_client_confirmation'
  WHERE id = p_service_request_id
    AND status = 'searching_provider';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request % is not in searching_provider status', p_service_request_id;
  END IF;
  UPDATE public.service_request_provider_candidates
  SET status = 'accepted',
      admin_approved = true,
      offered_price = p_offered_price,
      responded_at = NOW()
  WHERE service_request_id = p_service_request_id
    AND provider_profile_id = p_provider_profile_id;
  UPDATE public.service_request_provider_candidates
  SET status = 'rejected',
      responded_at = NOW()
  WHERE service_request_id = p_service_request_id
    AND provider_profile_id != p_provider_profile_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.select_service_request_provider(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_service_request_provider(uuid, uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_service_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_service_request(uuid, text) TO authenticated;
