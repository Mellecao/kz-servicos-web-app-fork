-- ============================================================================
-- Migration 24: Create System Settings Table
-- Description: Configurações do sistema em formato chave-valor (JSONB).
--   Gerenciada apenas por administradores.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS system_settings;
