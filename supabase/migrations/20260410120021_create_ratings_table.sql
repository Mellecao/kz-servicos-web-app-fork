-- ============================================================================
-- Migration 22: Create Ratings Table
-- Description: Avaliações de viagens e serviços. Cada rating recalcula
--   automaticamente a média e total de avaliações do prestador via trigger.
-- ============================================================================

-- +goose Up
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rated_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraint: exatamente um dos dois deve ser NOT NULL
  CONSTRAINT chk_rating_reference CHECK (
    (trip_id IS NOT NULL AND service_request_id IS NULL) OR
    (trip_id IS NULL AND service_request_id IS NOT NULL)
  )
);

-- Trigger function: recalcula average_rating e total_ratings do provider_profile
CREATE OR REPLACE FUNCTION recalculate_provider_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_profile_id UUID;
  v_avg DECIMAL(3,2);
  v_total INTEGER;
BEGIN
  -- Busca o provider_profile do rated_id
  SELECT id INTO v_provider_profile_id
  FROM provider_profiles
  WHERE user_id = NEW.rated_id;

  -- Se o rated_id é um provider, recalcula
  IF v_provider_profile_id IS NOT NULL THEN
    SELECT COALESCE(AVG(r.rating), 0), COUNT(r.id)
    INTO v_avg, v_total
    FROM ratings r
    WHERE r.rated_id = NEW.rated_id;

    UPDATE provider_profiles
    SET average_rating = v_avg,
        total_ratings = v_total
    WHERE id = v_provider_profile_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no INSERT de ratings
DROP TRIGGER IF EXISTS trg_recalculate_provider_rating ON ratings;
CREATE TRIGGER trg_recalculate_provider_rating
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_provider_rating();

-- Habilitar Row Level Security
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- +goose Down
-- DROP TRIGGER IF EXISTS trg_recalculate_provider_rating ON ratings;
-- DROP FUNCTION IF EXISTS recalculate_provider_rating();
-- DROP TABLE IF EXISTS ratings;
