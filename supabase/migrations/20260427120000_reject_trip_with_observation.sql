-- ============================================================================
-- Migration: permite recusar viagens com observação sem duplicar histórico
-- ============================================================================
-- O trigger log_trip_status_change sempre insere uma linha em
-- trip_status_history quando trips.status muda — porém, na versão original,
-- sem observations. Por isso rejectTrip fazia UPDATE em trips e depois INSERT
-- manual em trip_status_history para registrar a justificativa, gerando 2 linhas.
--
-- Solução: o trigger passa a ler observations de uma session config
-- (app.status_observation) que pode ser definida pela RPC reject_trip dentro
-- da mesma transação, mantendo o trigger como única fonte de inserção.
-- ============================================================================

-- +goose Up

-- 1) Trigger lê observations de current_setting (NULL quando não definido)
CREATE OR REPLACE FUNCTION log_trip_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_observation TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_observation := NULLIF(current_setting('app.status_observation', true), '');
    INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, observations)
    VALUES (
      NEW.id,
      OLD.status::VARCHAR,
      NEW.status::VARCHAR,
      COALESCE(auth.uid(), NEW.client_id),
      v_observation
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) RPC: recusa uma viagem em "under_review" e registra a observação
--    em uma única transação (set_config local + UPDATE → trigger insere 1 linha).
CREATE OR REPLACE FUNCTION reject_trip(p_trip_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.status_observation', COALESCE(p_reason, ''), true);
  UPDATE trips
    SET status = 'open'
    WHERE id = p_trip_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION reject_trip(UUID, TEXT) TO authenticated;

-- +goose Down
-- CREATE OR REPLACE FUNCTION log_trip_status_change()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF OLD.status IS DISTINCT FROM NEW.status THEN
--     INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by)
--     VALUES (
--       NEW.id,
--       OLD.status::VARCHAR,
--       NEW.status::VARCHAR,
--       COALESCE(auth.uid(), NEW.client_id)
--     );
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- DROP FUNCTION IF EXISTS reject_trip(UUID, TEXT);
