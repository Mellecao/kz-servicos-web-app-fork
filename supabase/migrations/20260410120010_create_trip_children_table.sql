-- ============================================================================
-- Migration 11: Create Trip Children Table
-- Description: Registra informações sobre crianças em cada viagem,
--   incluindo idade e necessidade de cadeirinha.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS trip_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  needs_car_seat BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE trip_children ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS trip_children;
