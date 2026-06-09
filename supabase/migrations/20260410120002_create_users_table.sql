-- ============================================================================
-- Migration 03: Create Users Table
-- Description: Tabela principal de usuários, vinculada ao Supabase Auth
--   (auth.users). Armazena dados de perfil, role e informações pessoais.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  cpf VARCHAR(14) UNIQUE,
  avatar_url TEXT,
  date_of_birth DATE,
  is_active BOOLEAN DEFAULT true,
  auth_provider VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Habilitar Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TABLE IF EXISTS users;
