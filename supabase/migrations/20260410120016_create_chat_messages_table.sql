-- ============================================================================
-- Migration 17: Create Chat Messages Table
-- Description: Mensagens enviadas nas salas de chat. Suporta texto, imagem,
--   áudio, arquivo e localização. Habilitada para Supabase Realtime.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  message_type message_type DEFAULT 'text',
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_room_id ON chat_messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Habilitar Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- NOTA: Habilitar Supabase Realtime para esta tabela.
-- Será feito na migration 27 via: ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- Alternativamente, habilite via Dashboard > Database > Replication

-- +goose Down
-- DROP TABLE IF EXISTS chat_messages;
