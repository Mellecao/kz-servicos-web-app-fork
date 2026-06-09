-- ============================================================================
-- Migration: Create Trip Driver Candidates Table
-- Description: Tabela de candidatos (motoristas pendentes) para viagens no
--   status "searching_drivers". Permite indicar múltiplos motoristas antes da
--   confirmação final do motorista responsável pela viagem.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS trip_driver_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  driver_profile_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, driver_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_trip_id ON trip_driver_candidates(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_driver_profile_id ON trip_driver_candidates(driver_profile_id);

ALTER TABLE trip_driver_candidates ENABLE ROW LEVEL SECURITY;

-- SELECT: participantes da trip ou admin
CREATE POLICY trip_driver_candidates_select ON trip_driver_candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM driver_profiles dp
          JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
          WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
        )
        OR public.get_user_role() = 'admin'
      )
    )
  );

-- INSERT: apenas admin
CREATE POLICY trip_driver_candidates_insert ON trip_driver_candidates
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

-- UPDATE: driver próprio ou admin
CREATE POLICY trip_driver_candidates_update ON trip_driver_candidates
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
  );

-- DELETE: apenas admin
CREATE POLICY trip_driver_candidates_delete ON trip_driver_candidates
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- +goose Down
-- DROP TABLE IF EXISTS trip_driver_candidates;
