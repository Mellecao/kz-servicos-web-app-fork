-- ============================================================================
-- Migration 23: Create Provider Category Services Table
-- Description: Relação N:N entre prestadores e categorias de serviço.
--   Permite que um prestador atue em múltiplas categorias, com uma primária.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS provider_category_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Um prestador não pode ter a mesma categoria duplicada
  CONSTRAINT uq_provider_category UNIQUE (provider_profile_id, service_category_id)
);

-- Habilitar Row Level Security
ALTER TABLE provider_category_services ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS provider_category_services;
