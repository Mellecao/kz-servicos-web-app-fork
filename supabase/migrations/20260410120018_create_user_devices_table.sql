-- ============================================================================
-- Migration 19: Create User Devices Table
-- Description: Dispositivos registrados dos usuários para push notifications.
--   Cada dispositivo possui um token, plataforma e status.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform platform_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Um usuário não pode ter o mesmo token duplicado
  CONSTRAINT uq_user_device_token UNIQUE (user_id, device_token)
);

-- Habilitar Row Level Security
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS user_devices;
