-- ============================================================================
-- Migration 01: Create Extensions
-- Description: Habilita extensões necessárias do PostgreSQL para o sistema
--   - PostGIS: suporte a dados geográficos (localização de motoristas, endereços)
--   - pg_trgm: busca por similaridade de texto (busca fuzzy)
--   - unaccent: remoção de acentos para buscas normalizadas
-- ============================================================================

-- +goose Up
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- +goose Down
-- DROP EXTENSION IF EXISTS "unaccent";
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "postgis";
