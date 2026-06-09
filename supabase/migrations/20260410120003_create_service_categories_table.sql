-- ============================================================================
-- Migration 04: Create Service Categories Table
-- Description: Categorias de serviço disponíveis na plataforma (ex: Motorista,
--   Diarista, Eletricista). Cada categoria define se é do tipo viagem ou
--   serviço genérico.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  service_type service_type_enum NOT NULL,
  is_active BOOLEAN DEFAULT true,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Seed data: categorias iniciais
INSERT INTO service_categories (name, slug, description, service_type) VALUES
  ('Motorista', 'driver', 'Serviço de transporte de passageiros', 'trip'),
  ('Diarista', 'housekeeper', 'Serviço de limpeza', 'other_service'),
  ('Eletricista', 'electrician', 'Serviço elétrico', 'other_service')
ON CONFLICT (slug) DO NOTHING;

-- +goose Down
-- DROP TABLE IF EXISTS service_categories;
