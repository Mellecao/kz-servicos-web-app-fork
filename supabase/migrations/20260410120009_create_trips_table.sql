-- ============================================================================
-- Migration 10: Create Trips Table
-- Description: Tabela principal de viagens. Registra todas as solicitações de
--   transporte, com endereços de origem/destino, dados de passageiros,
--   preços, status e datas relevantes.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  driver_profile_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  service_category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  pickup_address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  dropoff_address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  scheduled_datetime TIMESTAMPTZ NOT NULL,
  is_round_trip BOOLEAN DEFAULT false,
  return_datetime TIMESTAMPTZ,
  passenger_count INTEGER NOT NULL,
  children_count INTEGER DEFAULT 0,
  observations TEXT,
  driver_observations TEXT,
  luggage_count INTEGER DEFAULT 0,
  status trip_status DEFAULT 'open',
  estimated_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  is_paid BOOLEAN DEFAULT false,
  payment_method payment_method,
  payment_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_trips_client_id ON trips(client_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_profile_id ON trips(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_datetime ON trips(scheduled_datetime);

-- Habilitar Row Level Security
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS trips;
