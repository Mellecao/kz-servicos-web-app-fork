-- ============================================================================
-- Migration: adiciona coluna is_driver_paied à tabela trips
-- Description: indica se o motorista já recebeu o pagamento referente à viagem.
--   Independente de is_paid (que indica se o cliente pagou).
-- ============================================================================

-- +goose Up
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS is_driver_paied BOOLEAN DEFAULT false;

-- +goose Down
-- ALTER TABLE trips DROP COLUMN IF EXISTS is_driver_paied;
