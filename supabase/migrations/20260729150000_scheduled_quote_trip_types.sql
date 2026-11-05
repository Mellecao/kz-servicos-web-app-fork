-- ============================================================================
-- Migration: Extend trip_type enum for Subprojeto 2A/2B
-- Adds 'scheduled_quote' (Cotação — fluxo scheduled atual) and
-- 'scheduled_choose_driver' (Escolha seu Motorista — usado no Subprojeto 2B).
-- Retrocompatível: trips 'standard' existentes permanecem inalteradas.
-- ============================================================================

-- +goose Up
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_quote';
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_choose_driver';

-- +goose Down
-- Postgres não suporta remoção de valores de enum em uso; Down = no-op.
