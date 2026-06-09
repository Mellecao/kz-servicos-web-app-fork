-- ============================================================================
-- Migration 02: Create Enums
-- Description: Cria todos os tipos ENUM utilizados no sistema KZ Serviços.
--   Esses tipos garantem integridade dos dados em colunas de status, roles,
--   tipos de serviço, pagamento, etc.
-- ============================================================================

-- +goose Up

-- Papel do usuário no sistema
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'provider', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status de aprovação do prestador
DO $$ BEGIN
  CREATE TYPE provider_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de conta bancária
DO $$ BEGIN
  CREATE TYPE bank_account_type AS ENUM ('checking', 'savings');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status da viagem (trip)
DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM (
    'open',
    'under_review',
    'review_rejected',
    'searching_drivers',
    'awaiting_client_confirmation',
    'awaiting_driver_confirmation',
    'scheduled',
    'started',
    'finished',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status da solicitação de serviço genérico
DO $$ BEGIN
  CREATE TYPE service_request_status AS ENUM (
    'open',
    'under_review',
    'review_rejected',
    'searching_provider',
    'assigned',
    'in_progress',
    'finished',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de serviço (viagem vs. outros)
DO $$ BEGIN
  CREATE TYPE service_type_enum AS ENUM ('trip', 'other_service');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Métodos de pagamento aceitos
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('pix', 'debit', 'credit', 'cash', 'billing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tamanho de bagagem
DO $$ BEGIN
  CREATE TYPE luggage_size AS ENUM ('small', 'medium', 'large', 'extra_large');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Plataforma do dispositivo
DO $$ BEGIN
  CREATE TYPE platform_type AS ENUM ('android', 'ios', 'web');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de mensagem no chat
DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'audio', 'file', 'location');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de foto do veículo
DO $$ BEGIN
  CREATE TYPE photo_type AS ENUM ('front', 'back', 'interior', 'side_left', 'side_right');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- +goose Down
-- DROP TYPE IF EXISTS photo_type;
-- DROP TYPE IF EXISTS message_type;
-- DROP TYPE IF EXISTS platform_type;
-- DROP TYPE IF EXISTS luggage_size;
-- DROP TYPE IF EXISTS payment_method;
-- DROP TYPE IF EXISTS service_type_enum;
-- DROP TYPE IF EXISTS service_request_status;
-- DROP TYPE IF EXISTS trip_status;
-- DROP TYPE IF EXISTS bank_account_type;
-- DROP TYPE IF EXISTS provider_status;
-- DROP TYPE IF EXISTS user_role;
