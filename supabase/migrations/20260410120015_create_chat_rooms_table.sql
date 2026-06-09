-- ============================================================================
-- Migration 16: Create Chat Rooms Table
-- Description: Salas de chat entre cliente e prestador. Cada sala está
--   vinculada a uma viagem OU a uma solicitação de serviço (nunca ambos).
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraint: exatamente um dos dois deve ser NOT NULL
  CONSTRAINT chk_chat_room_reference CHECK (
    (trip_id IS NOT NULL AND service_request_id IS NULL) OR
    (trip_id IS NULL AND service_request_id IS NOT NULL)
  )
);

-- Habilitar Row Level Security
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS chat_rooms;
