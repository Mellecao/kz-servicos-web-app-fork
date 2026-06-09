-- ============================================================================
-- Migration 18: Create Notifications Table
-- Description: Notificações do sistema para os usuários. Suporta diferentes
--   tipos de notificação com referência polimórfica ao recurso relacionado.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_pushed BOOLEAN DEFAULT false,
  pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Habilitar Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS notifications;
