-- ============================================================================
-- Migration: Fix trips INSERT RLS policy
-- Description: A policy trips_insert só permitia clients criando viagens para
--   si mesmos. Admin precisa criar viagens em nome de clientes.
-- ============================================================================

-- +goose Up
DROP POLICY IF EXISTS trips_insert ON trips;

CREATE POLICY trips_insert ON trips
  FOR INSERT TO authenticated
  WITH CHECK (
    (client_id = auth.uid() AND public.get_user_role() = 'client')
    OR public.get_user_role() = 'admin'
  );

-- +goose Down
DROP POLICY IF EXISTS trips_insert ON trips;

CREATE POLICY trips_insert ON trips
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );
