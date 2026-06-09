-- ============================================================================
-- Migration 06: Create Driver Profiles Table
-- Description: Extensão do perfil de prestador para motoristas. Contém dados
--   específicos da CNH e status de disponibilidade.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  cnh_category VARCHAR(5),
  cnh_expiration_date DATE,
  cnh_number VARCHAR(20) UNIQUE,
  is_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS driver_profiles;
