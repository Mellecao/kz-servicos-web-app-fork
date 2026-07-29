-- pgTAP test — CHECK constraint bloqueia flash com is_round_trip/return_datetime
BEGIN;
SELECT plan(1);

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'trips_flash_no_scheduling' AND convalidated = true
), 'constraint trips_flash_no_scheduling existe e está validada');

-- Nota: teste de insert (que exige fixtures completos com FKs) fica na Task 4/5
-- quando o helper flash_setup_fixtures() já estiver disponível.

SELECT * FROM finish();
ROLLBACK;
