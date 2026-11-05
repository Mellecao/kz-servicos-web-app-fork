-- pgTAP test — enum + coluna trip_type
BEGIN;
SELECT plan(3);

SELECT has_type('public', 'trip_type', 'enum public.trip_type deve existir');
SELECT has_column('public', 'trips', 'trip_type', 'coluna trip_type deve existir em trips');
SELECT col_default_is('public', 'trips', 'trip_type', 'standard'::text, 'default deve ser standard');

SELECT * FROM finish();
ROLLBACK;
