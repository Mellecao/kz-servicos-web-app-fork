-- pgTAP test — colunas de endereço de retorno em trips
BEGIN;
SELECT plan(3);

SELECT has_column('public', 'trips', 'return_pickup_address_id', 'trips has return_pickup_address_id column');
SELECT has_column('public', 'trips', 'return_dropoff_address_id', 'trips has return_dropoff_address_id column');
SELECT col_is_fk('public', 'trips', 'return_pickup_address_id', 'return_pickup_address_id references addresses');

SELECT * FROM finish();
ROLLBACK;
