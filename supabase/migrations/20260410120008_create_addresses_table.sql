-- ============================================================================
-- Migration 09: Create Addresses Table
-- Description: Endereços utilizados em viagens e serviços. Armazena dados
--   do Google Places, coordenadas geográficas e um campo PostGIS (GEOGRAPHY)
--   auto-populado via trigger para consultas espaciais.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id VARCHAR(255),
  formatted_address TEXT NOT NULL,
  street VARCHAR(255),
  number VARCHAR(20),
  complement VARCHAR(255),
  neighborhood VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(10),
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  location GEOGRAPHY(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice GiST para consultas espaciais (ex: buscar endereços próximos)
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses USING GIST(location);

-- Trigger function: auto-popula o campo 'location' a partir de latitude/longitude
CREATE OR REPLACE FUNCTION set_address_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger no INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_set_address_location ON addresses;
CREATE TRIGGER trg_set_address_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION set_address_location();

-- Habilitar Row Level Security
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TRIGGER IF EXISTS trg_set_address_location ON addresses;
-- DROP FUNCTION IF EXISTS set_address_location();
-- DROP TABLE IF EXISTS addresses;
