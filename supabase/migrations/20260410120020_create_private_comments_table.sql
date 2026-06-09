-- ============================================================================
-- Migration 21: Create Private Comments Table
-- Description: Comentários privados feitos por prestadores, visíveis apenas
--   pelo autor e administradores. Admins podem responder.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS private_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  comment TEXT NOT NULL,
  admin_response TEXT,
  responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_private_comments_author_id ON private_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_private_comments_reference_type ON private_comments(reference_type);
CREATE INDEX IF NOT EXISTS idx_private_comments_reference_id ON private_comments(reference_id);

-- Habilitar Row Level Security
ALTER TABLE private_comments ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS private_comments;
