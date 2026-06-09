-- ============================================================================
-- Migration 13: Create Trip Status History Table
-- Description: Histórico de mudanças de status das viagens. Registrado
--   automaticamente via trigger toda vez que trips.status é atualizado.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS trip_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  observations TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas de histórico
CREATE INDEX IF NOT EXISTS idx_trip_status_history_trip_id ON trip_status_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_status_history_created_at ON trip_status_history(created_at);

-- Trigger function: registra automaticamente mudanças de status em trips
CREATE OR REPLACE FUNCTION log_trip_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Só registra se o status realmente mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by)
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

-- Trigger no UPDATE de trips
DROP TRIGGER IF EXISTS trg_log_trip_status_change ON trips;
CREATE TRIGGER trg_log_trip_status_change
  AFTER UPDATE OF status ON trips
  FOR EACH ROW
  EXECUTE FUNCTION log_trip_status_change();

-- Habilitar Row Level Security
ALTER TABLE trip_status_history ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TRIGGER IF EXISTS trg_log_trip_status_change ON trips;
-- DROP FUNCTION IF EXISTS log_trip_status_change();
-- DROP TABLE IF EXISTS trip_status_history;
