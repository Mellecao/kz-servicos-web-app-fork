-- ============================================================================
-- Migration 26: Create Updated At Triggers
-- Description: Cria uma função genérica para auto-atualizar a coluna
--   updated_at e aplica triggers em todas as tabelas que possuem essa coluna.
-- ============================================================================

-- +goose Up

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em: users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger em: provider_profiles
DROP TRIGGER IF EXISTS trg_provider_profiles_updated_at ON provider_profiles;
CREATE TRIGGER trg_provider_profiles_updated_at
  BEFORE UPDATE ON provider_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger em: driver_profiles
DROP TRIGGER IF EXISTS trg_driver_profiles_updated_at ON driver_profiles;
CREATE TRIGGER trg_driver_profiles_updated_at
  BEFORE UPDATE ON driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger em: vehicles
DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger em: trips
DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger em: service_requests
DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON service_requests;
CREATE TRIGGER trg_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger em: driver_locations
DROP TRIGGER IF EXISTS trg_driver_locations_updated_at ON driver_locations;
CREATE TRIGGER trg_driver_locations_updated_at
  BEFORE UPDATE ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- +goose Down
-- DROP TRIGGER IF EXISTS trg_driver_locations_updated_at ON driver_locations;
-- DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON service_requests;
-- DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
-- DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
-- DROP TRIGGER IF EXISTS trg_driver_profiles_updated_at ON driver_profiles;
-- DROP TRIGGER IF EXISTS trg_provider_profiles_updated_at ON provider_profiles;
-- DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
