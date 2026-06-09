-- ============================================================================
-- Migration 14: Create Service Requests Table
-- Description: Solicitações de serviços genéricos (diarista, eletricista, etc).
--   Semelhante a trips, mas para serviços que não são de transporte.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_profile_id UUID REFERENCES provider_profiles(id) ON DELETE SET NULL,
  service_category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  service_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  status service_request_status DEFAULT 'open',
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  estimated_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  is_paid BOOLEAN DEFAULT false,
  payment_method payment_method,
  observations TEXT,
  provider_observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_profile_id ON service_requests(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_date ON service_requests(service_date);

-- Habilitar Row Level Security
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS service_requests;
