-- ============================================================================
-- Migration 12: Create Trip Luggage Table
-- Description: Registra bagagens de cada viagem com tamanho e quantidade.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS trip_luggage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  size luggage_size NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE trip_luggage ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS trip_luggage;
