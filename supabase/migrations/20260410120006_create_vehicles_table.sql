-- ============================================================================
-- Migration 07: Create Vehicles Table
-- Description: Veículos cadastrados pelos motoristas. Cada veículo está
--   vinculado a um driver_profile e contém dados de identificação e capacidade.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  color VARCHAR(50) NOT NULL,
  license_plate VARCHAR(10) UNIQUE NOT NULL,
  vehicle_document_url TEXT NOT NULL,
  passenger_capacity INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS vehicles;
