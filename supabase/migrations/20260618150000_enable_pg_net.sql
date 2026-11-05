-- ============================================================================
-- Migration: Enable pg_net extension
-- Description: Habilita pg_net para permitir net.http_post() usado pelos
--   triggers de push notification (20260618000000, 20260618140000).
--   Idempotente — segura em ambientes onde a extensão já existe.
-- ============================================================================

-- +goose Up

CREATE EXTENSION IF NOT EXISTS pg_net;

-- +goose Down

-- Down intencionalmente vazio: desabilitar pg_net quebraria os triggers
-- de notificação que dependem do schema net. Para reverter, descomente:
-- DROP EXTENSION IF EXISTS pg_net;
