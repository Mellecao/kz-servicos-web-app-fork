-- pgTAP test — coluna last_push_at
BEGIN;
SELECT plan(2);

SELECT has_column('public', 'trip_driver_candidates', 'last_push_at',
  'coluna last_push_at deve existir');
SELECT col_type_is('public', 'trip_driver_candidates', 'last_push_at',
  'timestamp with time zone', 'tipo deve ser timestamptz');

SELECT * FROM finish();
ROLLBACK;
