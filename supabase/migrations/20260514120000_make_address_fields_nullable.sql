-- ============================================================================
-- Migration: Make address fields nullable
-- Description: city, state, latitude, longitude eram NOT NULL mas o formulário
--   de nova viagem só envia formatted_address. Tornando nullable para alinhar
--   com o tipo TypeScript (Address interface) que já os declara como nullable.
-- ============================================================================

-- +goose Up
ALTER TABLE addresses
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

-- Atualiza o trigger para não tentar criar o ponto geográfico quando lat/lng são null
CREATE OR REPLACE FUNCTION set_address_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- +goose Down
-- ALTER TABLE addresses
--   ALTER COLUMN city SET NOT NULL,
--   ALTER COLUMN state SET NOT NULL,
--   ALTER COLUMN latitude SET NOT NULL,
--   ALTER COLUMN longitude SET NOT NULL;
