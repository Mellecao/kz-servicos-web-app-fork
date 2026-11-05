-- Impede que um prestador altere, na sua própria linha de convite, campos que só o
-- administrador pode decidir (aprovação, proposta da Só Serviços, rejeição de preço) ou
-- que mude a que pedido/prestador a linha pertence. O prestador continua a poder
-- responder ao convite: status, offered_price, responded_at e observations.
-- Aditivo: cria 1 função e 1 trigger. Sem sessão de utilizador (auth.uid() nulo: SQL de
-- manutenção/service role) não restringe.
CREATE OR REPLACE FUNCTION public.guard_service_candidate_provider_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_approved IS DISTINCT FROM OLD.admin_approved
     OR NEW.kz_proposed_price IS DISTINCT FROM OLD.kz_proposed_price
     OR NEW.kz_proposed_at IS DISTINCT FROM OLD.kz_proposed_at
     OR NEW.kz_proposal_locked IS DISTINCT FROM OLD.kz_proposal_locked
     OR NEW.price_rejection_reason IS DISTINCT FROM OLD.price_rejection_reason
     OR NEW.price_rejected_at IS DISTINCT FROM OLD.price_rejected_at
     OR NEW.service_request_id IS DISTINCT FROM OLD.service_request_id
     OR NEW.provider_profile_id IS DISTINCT FROM OLD.provider_profile_id THEN
    RAISE EXCEPTION 'Sem permissão para alterar estes campos do convite.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_service_candidate_provider_columns
  ON public.service_request_provider_candidates;
CREATE TRIGGER trg_guard_service_candidate_provider_columns
  BEFORE UPDATE ON public.service_request_provider_candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_service_candidate_provider_columns();

-- Reversão:
--   DROP TRIGGER IF EXISTS trg_guard_service_candidate_provider_columns ON public.service_request_provider_candidates;
--   DROP FUNCTION IF EXISTS public.guard_service_candidate_provider_columns();
