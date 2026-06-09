-- ============================================================================
-- Migration 15: Create Service Request Status History Table
-- Description: Histórico de mudanças de status de solicitações de serviço.
--   Registrado automaticamente via trigger.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS service_request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  observations TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas de histórico
CREATE INDEX IF NOT EXISTS idx_sr_status_history_service_request_id ON service_request_status_history(service_request_id);
CREATE INDEX IF NOT EXISTS idx_sr_status_history_created_at ON service_request_status_history(created_at);

-- Trigger function: registra automaticamente mudanças de status em service_requests
CREATE OR REPLACE FUNCTION log_service_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Só registra se o status realmente mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO service_request_status_history (service_request_id, from_status, to_status, changed_by)
    VALUES (
      NEW.id,
      OLD.status::VARCHAR,
      NEW.status::VARCHAR,
      COALESCE(auth.uid(), NEW.client_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no UPDATE de service_requests
DROP TRIGGER IF EXISTS trg_log_service_request_status_change ON service_requests;
CREATE TRIGGER trg_log_service_request_status_change
  AFTER UPDATE OF status ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_service_request_status_change();

-- Habilitar Row Level Security
ALTER TABLE service_request_status_history ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TRIGGER IF EXISTS trg_log_service_request_status_change ON service_requests;
-- DROP FUNCTION IF EXISTS log_service_request_status_change();
-- DROP TABLE IF EXISTS service_request_status_history;
