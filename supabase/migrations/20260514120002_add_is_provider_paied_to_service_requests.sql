-- ============================================================================
-- Migration: adiciona coluna is_provider_paied à tabela service_requests
-- Description: indica se o prestador já recebeu o pagamento referente ao serviço.
--   Independente de is_paid (que indica se o cliente pagou).
-- ============================================================================

-- +goose Up
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS is_provider_paied BOOLEAN DEFAULT false;

-- +goose Down
-- ALTER TABLE service_requests DROP COLUMN IF EXISTS is_provider_paied;
