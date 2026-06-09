-- ============================================================================
-- Migration 08: Create Vehicle Photos Table
-- Description: Fotos dos veículos organizadas por tipo (frente, traseira,
--   interior, laterais). Vinculadas ao veículo via CASCADE.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type photo_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS vehicle_photos;
