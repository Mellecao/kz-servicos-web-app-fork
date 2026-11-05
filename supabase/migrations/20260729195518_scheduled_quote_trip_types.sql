-- Exportado do histórico remoto (supabase_migrations.schema_migrations) em 2026-11-05.
-- Snapshot de referência do que está aplicado em produção; não garante replay limpo.

-- Migration: Extend trip_type enum for Subprojeto 2A/2B
-- Adds 'scheduled_quote' (Cotação — fluxo scheduled atual) and
-- 'scheduled_choose_driver' (Escolha seu Motorista — Subprojeto 2B).
-- Retrocompatível: trips 'standard' existentes permanecem inalteradas.

ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_quote';
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_choose_driver';
