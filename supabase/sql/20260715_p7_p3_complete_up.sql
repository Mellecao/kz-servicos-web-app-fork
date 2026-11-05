-- P7 + P3 - Publicacao completa pelo Supabase SQL Editor.
-- Projeto esperado: mtsqeomctrqfyekyzapc.
-- Execute este arquivo inteiro uma unica vez.
-- Uma falha reverte todo o conjunto porque existe uma unica transacao.

BEGIN;

-- ============================================================================
-- P7 - Solicitacoes de cancelamento revisadas pelo admin
-- ============================================================================

-- P7 - Solicitacoes de cancelamento revisadas pelo admin.
-- Execute uma unica vez no Supabase SQL Editor.
-- Este arquivo contem somente o bloco UP e nao altera o historico de migrations.

DO $$
BEGIN
  IF to_regclass('public.trip_cancellation_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'public.trip_cancellation_requests ja existe; script nao executado';
  END IF;
END $$;

CREATE TABLE public.trip_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 10),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_cancellation_requests_review_reason_check CHECK (
    status <> 'rejected'
    OR char_length(btrim(coalesce(review_reason, ''))) >= 3
  ),
  CONSTRAINT trip_cancellation_requests_review_state_check CHECK (
    (
      status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND review_reason IS NULL
    )
    OR (
      status = 'approved'
      AND reviewed_at IS NOT NULL
      AND review_reason IS NULL
    )
    OR (
      status = 'rejected'
      AND reviewed_at IS NOT NULL
    )
  )
);

CREATE INDEX idx_trip_cancellation_requests_trip_id
  ON public.trip_cancellation_requests(trip_id, created_at DESC);
CREATE INDEX idx_trip_cancellation_requests_requested_by
  ON public.trip_cancellation_requests(requested_by, created_at DESC);
CREATE UNIQUE INDEX idx_trip_cancellation_requests_unique_pending
  ON public.trip_cancellation_requests(trip_id)
  WHERE status = 'pending';

ALTER TABLE public.trip_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_cancellation_requests_select
ON public.trip_cancellation_requests
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'::user_role
  OR requested_by = auth.uid()
);

CREATE POLICY trip_cancellation_requests_insert_driver
ON public.trip_cancellation_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.trips t
    JOIN public.driver_profiles dp ON dp.id = t.driver_profile_id
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE t.id = trip_cancellation_requests.trip_id
      AND pp.user_id = auth.uid()
      AND t.status::text IN ('scheduled', 'started')
  )
);

CREATE POLICY trip_cancellation_requests_update_admin
ON public.trip_cancellation_requests
FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'admin'::user_role)
WITH CHECK (public.get_user_role() = 'admin'::user_role);

GRANT SELECT, INSERT, UPDATE ON public.trip_cancellation_requests TO authenticated;

CREATE TRIGGER trg_trip_cancellation_requests_updated_at
  BEFORE UPDATE ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_trip_cancellation_request_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_status trip_status;
BEGIN
  IF OLD.trip_id IS DISTINCT FROM NEW.trip_id
     OR OLD.requested_by IS DISTINCT FROM NEW.requested_by
     OR OLD.reason IS DISTINCT FROM NEW.reason THEN
    RAISE EXCEPTION 'Os dados originais do pedido de cancelamento nao podem ser alterados';
  END IF;

  IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'O pedido de cancelamento ja foi analisado ou possui transicao invalida';
  END IF;

  IF NEW.status = 'rejected'
     AND char_length(btrim(coalesce(NEW.review_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa com pelo menos 3 caracteres';
  END IF;

  IF NEW.status = 'approved' THEN
    SELECT status
      INTO v_trip_status
    FROM public.trips
    WHERE id = NEW.trip_id
    FOR UPDATE;

    IF v_trip_status IS NULL THEN
      RAISE EXCEPTION 'A viagem do pedido de cancelamento nao existe';
    END IF;

    IF v_trip_status NOT IN (
      'scheduled'::trip_status,
      'started'::trip_status,
      'cancelled'::trip_status
    ) THEN
      RAISE EXCEPTION 'A viagem nao esta mais ativa e nao pode ser cancelada';
    END IF;
  END IF;

  NEW.reviewed_by := coalesce(auth.uid(), NEW.reviewed_by);
  NEW.reviewed_at := now();
  IF NEW.status = 'approved' THEN
    NEW.review_reason := NULL;
  ELSE
    NEW.review_reason := btrim(NEW.review_reason);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_trip_cancellation_request_review
  BEFORE UPDATE ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_cancellation_request_review();

CREATE OR REPLACE FUNCTION public.notify_admins_on_trip_cancellation_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_name text;
BEGIN
  SELECT u.full_name
    INTO v_driver_name
  FROM public.users u
  WHERE u.id = NEW.requested_by;

  PERFORM public.notify_admins_for_trip_action(
    'admin_trip_cancellation_request',
    'Motorista solicitou cancelamento',
    format(
      '%s solicitou o cancelamento. Motivo: %s',
      coalesce(v_driver_name, 'Motorista'),
      left(NEW.reason, 180)
    ),
    NEW.trip_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_on_trip_cancellation_request
  AFTER INSERT ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_trip_cancellation_request();

CREATE OR REPLACE FUNCTION public.apply_trip_cancellation_request_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.trips
    SET status = 'cancelled'::trip_status,
        cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = NEW.reason
    WHERE id = NEW.trip_id
      AND status IN ('scheduled'::trip_status, 'started'::trip_status);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_trip_cancellation_request_review
  AFTER UPDATE OF status ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_trip_cancellation_request_review();

CREATE OR REPLACE FUNCTION public.resolve_pending_request_on_trip_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'cancelled'::trip_status THEN
    UPDATE public.trip_cancellation_requests
    SET status = 'approved',
        reviewed_by = auth.uid(),
        review_reason = NULL
    WHERE trip_id = NEW.id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_pending_request_on_trip_cancelled
  AFTER UPDATE OF status ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pending_request_on_trip_cancelled();

CREATE OR REPLACE FUNCTION public.push_driver_trip_cancellation_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  v_webhook_secret text;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status <> 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
    INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF coalesce(v_webhook_secret, '') = '' THEN
    RAISE WARNING 'push_webhook_secret ausente; recusa do pedido % sem push', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Push-Webhook-Secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'table', 'trip_cancellation_requests',
        'event', 'UPDATE',
        'old_status', OLD.status,
        'new_record', jsonb_build_object(
          'id', NEW.id,
          'status', NEW.status,
          'trip_id', NEW.trip_id,
          'requested_by', NEW.requested_by,
          'review_reason', NEW.review_reason
        )
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'push de recusa do pedido % falhou: %', NEW.id, sqlerrm;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_driver_trip_cancellation_rejection
  AFTER UPDATE OF status ON public.trip_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.push_driver_trip_cancellation_rejection();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_cancellation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.trip_cancellation_requests;
  END IF;
END $$;

ALTER TABLE public.trip_cancellation_requests REPLICA IDENTITY FULL;

-- Verificacao esperada:
-- SELECT to_regclass('public.trip_cancellation_requests');

-- ============================================================================
-- P3 - Chat persistente entre prestadores e administradores KZ
-- ============================================================================

-- P3 - Chat persistente entre KZ e prestadores.
-- Execute uma unica vez no Supabase SQL Editor, depois do SQL P7.
-- Este arquivo contem somente o bloco UP e nao altera o historico de migrations.

DO $$
BEGIN
  IF to_regclass('public.support_conversations') IS NOT NULL
     OR to_regclass('public.support_messages') IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelas de suporte ja existem; script nao executado';
  END IF;
END $$;

CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL UNIQUE
    REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  unread_admin_count integer NOT NULL DEFAULT 0 CHECK (unread_admin_count >= 0),
  unread_provider_count integer NOT NULL DEFAULT 0 CHECK (unread_provider_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_conversations_preview_length CHECK (
    last_message_preview IS NULL OR char_length(last_message_preview) <= 240
  )
);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  message text NOT NULL CHECK (
    char_length(btrim(message)) BETWEEN 1 AND 4000
  ),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_read_state CHECK (
    (is_read = false AND read_at IS NULL)
    OR (is_read = true AND read_at IS NOT NULL)
  )
);

CREATE INDEX idx_support_conversations_last_message
  ON public.support_conversations(last_message_at DESC)
  WHERE last_message_at IS NOT NULL;
CREATE INDEX idx_support_messages_conversation_created
  ON public.support_messages(conversation_id, created_at DESC);
CREATE INDEX idx_support_messages_unread
  ON public.support_messages(conversation_id, is_read, created_at)
  WHERE is_read = false;

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_conversations_select
ON public.support_conversations
FOR SELECT
TO authenticated
USING (
  provider_user_id = auth.uid()
  OR public.get_user_role() = 'admin'::user_role
);

CREATE POLICY support_conversations_insert_provider
ON public.support_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  provider_user_id = auth.uid()
  AND public.get_user_role() = 'provider'::user_role
);

CREATE POLICY support_messages_select
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id
      AND (
        sc.provider_user_id = auth.uid()
        OR public.get_user_role() = 'admin'::user_role
      )
  )
);

CREATE POLICY support_messages_insert_participant
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_read = false
  AND read_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id
      AND (
        sc.provider_user_id = auth.uid()
        OR public.get_user_role() = 'admin'::user_role
      )
  )
);

CREATE POLICY support_messages_update_recipient
ON public.support_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id
      AND (
        (
          public.get_user_role() = 'admin'::user_role
          AND support_messages.sender_id = sc.provider_user_id
        )
        OR (
          sc.provider_user_id = auth.uid()
          AND support_messages.sender_id <> sc.provider_user_id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id
      AND (
        (
          public.get_user_role() = 'admin'::user_role
          AND support_messages.sender_id = sc.provider_user_id
        )
        OR (
          sc.provider_user_id = auth.uid()
          AND support_messages.sender_id <> sc.provider_user_id
        )
      )
  )
);

GRANT SELECT, INSERT ON public.support_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;

CREATE TRIGGER trg_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_support_message_read_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id
     OR OLD.message IS DISTINCT FROM NEW.message
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'O conteudo da mensagem de suporte nao pode ser alterado';
  END IF;

  IF OLD.is_read = true OR NEW.is_read <> true THEN
    RAISE EXCEPTION 'A mensagem de suporte permite apenas a transicao para lida';
  END IF;

  NEW.read_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_support_message_read_update
  BEFORE UPDATE ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_support_message_read_update();

CREATE OR REPLACE FUNCTION public.sync_support_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_user_id uuid;
  v_preview text;
BEGIN
  SELECT provider_user_id
    INTO v_provider_user_id
  FROM public.support_conversations
  WHERE id = NEW.conversation_id
  FOR UPDATE;

  v_preview := left(
    regexp_replace(btrim(NEW.message), E'\\s+', ' ', 'g'),
    240
  );

  UPDATE public.support_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = v_preview,
      last_sender_id = NEW.sender_id,
      unread_admin_count = unread_admin_count
        + CASE WHEN NEW.sender_id = v_provider_user_id THEN 1 ELSE 0 END,
      unread_provider_count = unread_provider_count
        + CASE WHEN NEW.sender_id = v_provider_user_id THEN 0 ELSE 1 END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_support_conversation_on_message
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_support_conversation_on_message();

CREATE OR REPLACE FUNCTION public.sync_support_conversation_on_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_user_id uuid;
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    SELECT provider_user_id
      INTO v_provider_user_id
    FROM public.support_conversations
    WHERE id = NEW.conversation_id
    FOR UPDATE;

    UPDATE public.support_conversations
    SET unread_admin_count = CASE
          WHEN OLD.sender_id = v_provider_user_id
            THEN greatest(unread_admin_count - 1, 0)
          ELSE unread_admin_count
        END,
        unread_provider_count = CASE
          WHEN OLD.sender_id <> v_provider_user_id
            THEN greatest(unread_provider_count - 1, 0)
          ELSE unread_provider_count
        END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_support_conversation_on_read
  AFTER UPDATE OF is_read ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_support_conversation_on_read();

CREATE OR REPLACE FUNCTION public.notify_support_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  v_provider_user_id uuid;
  v_sender_name text;
  v_preview text;
  v_webhook_secret text;
BEGIN
  SELECT sc.provider_user_id, u.full_name
    INTO v_provider_user_id, v_sender_name
  FROM public.support_conversations sc
  LEFT JOIN public.users u ON u.id = NEW.sender_id
  WHERE sc.id = NEW.conversation_id;

  v_preview := left(
    regexp_replace(btrim(NEW.message), E'\\s+', ' ', 'g'),
    180
  );

  IF NEW.sender_id = v_provider_user_id THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      type,
      reference_type,
      reference_id,
      link
    )
    SELECT
      admin_user.id,
      format('Mensagem de %s', coalesce(v_sender_name, 'Prestador')),
      v_preview,
      'admin_support_message',
      'support_conversation',
      NEW.conversation_id,
      format('/chats/%s', v_provider_user_id)
    FROM public.users admin_user
    WHERE admin_user.role = 'admin'::user_role
      AND admin_user.is_active = true;

    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    reference_type,
    reference_id,
    link
  ) VALUES (
    v_provider_user_id,
    'Nova mensagem da KZ',
    v_preview,
    'support_message',
    'support_conversation',
    NEW.conversation_id,
    '/support-chat'
  );

  SELECT decrypted_secret
    INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF coalesce(v_webhook_secret, '') = '' THEN
    RAISE WARNING 'push_webhook_secret ausente; mensagem de suporte % sem push', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Push-Webhook-Secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'table', 'support_messages',
        'event', 'INSERT',
        'new_record', jsonb_build_object(
          'id', NEW.id,
          'conversation_id', NEW.conversation_id,
          'sender_id', NEW.sender_id,
          'message', NEW.message
        )
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'push de suporte para mensagem % falhou: %', NEW.id, sqlerrm;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_support_message_recipient
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_message_recipient();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.support_conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.support_messages;
  END IF;
END $$;

ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

-- Verificacao esperada:
-- SELECT to_regclass('public.support_conversations'),
--        to_regclass('public.support_messages');

COMMIT;
