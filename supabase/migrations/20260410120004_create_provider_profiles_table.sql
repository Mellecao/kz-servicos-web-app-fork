-- ============================================================================
-- Migration 05: Create Provider Profiles Table
-- Description: Perfil do prestador de serviço. Cada usuário com role 'provider'
--   possui um registro aqui com documentos, dados bancários e avaliações.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  status provider_status DEFAULT 'pending',
  rg_document_url TEXT,
  cnh_document_url TEXT,
  proof_of_address_url TEXT,
  has_card_machine BOOLEAN DEFAULT false,
  has_tap_payment BOOLEAN DEFAULT false,
  issues_invoice BOOLEAN DEFAULT false,
  issues_receipt BOOLEAN DEFAULT false,
  bank_name VARCHAR(100),
  bank_agency VARCHAR(20),
  bank_account VARCHAR(30),
  bank_account_type bank_account_type,
  bank_pix_key VARCHAR(255),
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id ON provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_service_category_id ON provider_profiles(service_category_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_status ON provider_profiles(status);

-- Habilitar Row Level Security
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS provider_profiles;
