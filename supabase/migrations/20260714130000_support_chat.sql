-- ============================================================================
-- Migration: Persistent support chat between KZ admins and providers
-- ============================================================================

-- +goose Up

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

-- +goose Down

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.support_conversations;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_notify_support_message_recipient
  ON public.support_messages;
DROP FUNCTION IF EXISTS public.notify_support_message_recipient();

DROP TRIGGER IF EXISTS trg_sync_support_conversation_on_read
  ON public.support_messages;
DROP FUNCTION IF EXISTS public.sync_support_conversation_on_read();

DROP TRIGGER IF EXISTS trg_sync_support_conversation_on_message
  ON public.support_messages;
DROP FUNCTION IF EXISTS public.sync_support_conversation_on_message();

DROP TRIGGER IF EXISTS trg_validate_support_message_read_update
  ON public.support_messages;
DROP FUNCTION IF EXISTS public.validate_support_message_read_update();

DROP TABLE IF EXISTS public.support_messages;
DROP TABLE IF EXISTS public.support_conversations;
