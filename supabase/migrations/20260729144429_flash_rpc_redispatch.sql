-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

CREATE OR REPLACE FUNCTION public.redispatch_flash_trip(p_trip_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_pushed int := 0;
  v_webhook_url text;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Não é Flash';
  END IF;
  IF v_trip.status <> 'searching_drivers' THEN
    RETURN 0;
  END IF;

  -- Insere candidatos para novos motoristas aprovados (inline, idempotente via NOT EXISTS)
  PERFORM pg_advisory_xact_lock(hashtext(p_trip_id::text));
  INSERT INTO public.trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  SELECT p_trip_id, dp.id, 'pending'::public.trip_status_candidate, now()
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.status = 'approved'::public.provider_status
    AND NOT EXISTS (
      SELECT 1 FROM public.trip_driver_candidates c
      WHERE c.trip_id = p_trip_id AND c.driver_profile_id = dp.id
    );

  -- Re-push com throttle 30s para candidatos pending
  SELECT value INTO v_webhook_url FROM public.system_settings
   WHERE key = 'flash_repush_webhook_url';

  IF v_webhook_url IS NOT NULL THEN
    WITH to_repush AS (
      SELECT id
      FROM public.trip_driver_candidates
      WHERE trip_id = p_trip_id
        AND status = 'pending'
        AND (last_push_at IS NULL OR last_push_at < now() - interval '30 seconds')
    ),
    updated AS (
      UPDATE public.trip_driver_candidates c
         SET last_push_at = now()
        FROM to_repush r
       WHERE c.id = r.id
      RETURNING c.id
    )
    SELECT COUNT(*)::int INTO v_pushed FROM updated;

    IF v_pushed > 0 THEN
      PERFORM net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('trip_id', p_trip_id, 'kind', 'flash_repush')
      );
    END IF;
  END IF;

  RETURN v_pushed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) TO authenticated;
