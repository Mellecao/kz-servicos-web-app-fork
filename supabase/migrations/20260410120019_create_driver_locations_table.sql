-- ============================================================================
-- Migration 20: Create Driver Locations Table
-- Description: Localização em tempo real dos motoristas. Utiliza PostGIS para
--   consultas espaciais. Habilitada para Supabase Realtime.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id UUID UNIQUE NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  location GEOGRAPHY(Point, 4326),
  heading DECIMAL(5,2),
  speed DECIMAL(6,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger function: auto-popula o campo 'location' a partir de latitude/longitude
CREATE OR REPLACE FUNCTION set_driver_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger no INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_set_driver_location ON driver_locations;
CREATE TRIGGER trg_set_driver_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION set_driver_location();

-- Índice GiST para consultas espaciais
CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations USING GIST(location);

-- Habilitar Row Level Security
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- NOTA: Habilitar Supabase Realtime para esta tabela.
-- Será feito na migration 27 via: ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- +goose Down
-- DROP TRIGGER IF EXISTS trg_set_driver_location ON driver_locations;
-- DROP FUNCTION IF EXISTS set_driver_location();
-- DROP TABLE IF EXISTS driver_locations;
