-- ============================================================================
-- CONSOLIDATED SCHEMA — KZ Serviços
-- Gerado em: 2026-05-21
-- Engloba todas as migrations de 20260410120000 até 20260520120003
-- ============================================================================

-- +goose Up

-- ============================================================================
-- Seção 01: Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================================
-- Seção 02: Enums
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'provider', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_account_type AS ENUM ('checking', 'savings');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM (
    'open',
    'under_review',
    'review_rejected',
    'searching_drivers',
    'awaiting_client_confirmation',
    'awaiting_driver_confirmation',
    'scheduled',
    'started',
    'finished',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_request_status AS ENUM (
    'open',
    'under_review',
    'review_rejected',
    'searching_provider',
    'assigned',
    'in_progress',
    'finished',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_type_enum AS ENUM ('trip', 'other_service');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('pix', 'debit', 'credit', 'cash', 'billing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE luggage_size AS ENUM ('small', 'medium', 'large', 'extra_large');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE platform_type AS ENUM ('android', 'ios', 'web');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'audio', 'file', 'location');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE photo_type AS ENUM ('front', 'back', 'interior', 'side_left', 'side_right');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE trip_status_candidate AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Seção 03: Tabelas
-- ============================================================================

-- users
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role    NOT NULL DEFAULT 'client',
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  cpf           VARCHAR(14)  UNIQUE,
  avatar_url    TEXT,
  date_of_birth DATE,
  is_active     BOOLEAN      DEFAULT true,
  auth_provider VARCHAR(20),
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cpf   ON users(cpf);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- service_categories
CREATE TABLE IF NOT EXISTS service_categories (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100)      UNIQUE NOT NULL,
  slug         VARCHAR(100)      UNIQUE NOT NULL,
  description  TEXT,
  service_type service_type_enum NOT NULL,
  is_active    BOOLEAN           DEFAULT true,
  icon_url     TEXT,
  created_at   TIMESTAMPTZ       DEFAULT now()
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- provider_profiles
CREATE TABLE IF NOT EXISTS provider_profiles (
  id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID            UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_category_id  UUID            NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  status               provider_status DEFAULT 'pending',
  rg_document_url      TEXT,
  cnh_document_url     TEXT,
  proof_of_address_url TEXT,
  has_card_machine     BOOLEAN         DEFAULT false,
  has_tap_payment      BOOLEAN         DEFAULT false,
  issues_invoice       BOOLEAN         DEFAULT false,
  issues_receipt       BOOLEAN         DEFAULT false,
  bank_name            VARCHAR(100),
  bank_agency          VARCHAR(20),
  bank_account         VARCHAR(30),
  bank_account_type    bank_account_type,
  bank_pix_key         VARCHAR(255),
  average_rating       DECIMAL(3,2)    DEFAULT 0,
  total_ratings        INTEGER         DEFAULT 0,
  bio                  TEXT,
  created_at           TIMESTAMPTZ     DEFAULT now(),
  updated_at           TIMESTAMPTZ     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id             ON provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_service_category_id ON provider_profiles(service_category_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_status              ON provider_profiles(status);

ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;

-- driver_profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID        UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  cnh_category        VARCHAR(5),
  cnh_expiration_date DATE,
  cnh_number          VARCHAR(20) UNIQUE,
  is_available        BOOLEAN     DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

-- vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id     UUID         NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  brand                 VARCHAR(100) NOT NULL,
  model                 VARCHAR(100) NOT NULL,
  year                  INTEGER      NOT NULL,
  color                 VARCHAR(50)  NOT NULL,
  license_plate         VARCHAR(10)  UNIQUE NOT NULL,
  vehicle_document_url  TEXT         NOT NULL,
  passenger_capacity    INTEGER      DEFAULT 4,
  is_active             BOOLEAN      DEFAULT true,
  created_at            TIMESTAMPTZ  DEFAULT now(),
  updated_at            TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- vehicle_photos
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_url  TEXT        NOT NULL,
  photo_type photo_type  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

-- addresses
-- Nota: city, state, latitude, longitude são nullable (alterados em 20260514120000)
CREATE TABLE IF NOT EXISTS addresses (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id   VARCHAR(255),
  formatted_address TEXT           NOT NULL,
  street            VARCHAR(255),
  number            VARCHAR(20),
  complement        VARCHAR(255),
  neighborhood      VARCHAR(255),
  city              VARCHAR(255),
  state             VARCHAR(2),
  zip_code          VARCHAR(10),
  latitude          DECIMAL(10,7),
  longitude         DECIMAL(10,7),
  location          GEOGRAPHY(Point, 4326),
  created_at        TIMESTAMPTZ    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses USING GIST(location);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- trips
-- Inclui: is_driver_paied (20260428) e driver_arrived_at (20260520120001)
CREATE TABLE IF NOT EXISTS trips (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  driver_profile_id   UUID           REFERENCES driver_profiles(id) ON DELETE SET NULL,
  vehicle_id          UUID           REFERENCES vehicles(id) ON DELETE SET NULL,
  service_category_id UUID           NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  pickup_address_id   UUID           NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  dropoff_address_id  UUID           NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  scheduled_datetime  TIMESTAMPTZ    NOT NULL,
  is_round_trip       BOOLEAN        DEFAULT false,
  return_datetime     TIMESTAMPTZ,
  passenger_count     INTEGER        NOT NULL,
  children_count      INTEGER        DEFAULT 0,
  observations        TEXT,
  driver_observations TEXT,
  luggage_count       INTEGER        DEFAULT 0,
  status              trip_status    DEFAULT 'open',
  estimated_price     DECIMAL(10,2),
  final_price         DECIMAL(10,2),
  is_paid             BOOLEAN        DEFAULT false,
  is_driver_paied     BOOLEAN        DEFAULT false,
  payment_method      payment_method,
  payment_date        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  driver_arrived_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ    DEFAULT now(),
  updated_at          TIMESTAMPTZ    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trips_client_id          ON trips(client_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_profile_id  ON trips(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_trips_status             ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_datetime ON trips(scheduled_datetime);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- trip_children
CREATE TABLE IF NOT EXISTS trip_children (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  age           INTEGER     NOT NULL,
  needs_car_seat BOOLEAN    DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trip_children ENABLE ROW LEVEL SECURITY;

-- trip_luggage
CREATE TABLE IF NOT EXISTS trip_luggage (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID         NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  size       luggage_size NOT NULL,
  quantity   INTEGER      DEFAULT 1,
  created_at TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE trip_luggage ENABLE ROW LEVEL SECURITY;

-- trip_status_history
CREATE TABLE IF NOT EXISTS trip_status_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_status  VARCHAR(50),
  to_status    VARCHAR(50) NOT NULL,
  changed_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  observations TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_status_history_trip_id    ON trip_status_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_status_history_created_at ON trip_status_history(created_at);

ALTER TABLE trip_status_history ENABLE ROW LEVEL SECURITY;

-- service_requests
-- Inclui: is_provider_paied (20260514120002)
CREATE TABLE IF NOT EXISTS service_requests (
  id                   UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID                   NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_profile_id  UUID                   REFERENCES provider_profiles(id) ON DELETE SET NULL,
  service_category_id  UUID                   NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  service_date         TIMESTAMPTZ            NOT NULL,
  description          TEXT                   NOT NULL,
  status               service_request_status DEFAULT 'open',
  address_id           UUID                   REFERENCES addresses(id) ON DELETE SET NULL,
  estimated_price      DECIMAL(10,2),
  final_price          DECIMAL(10,2),
  is_paid              BOOLEAN                DEFAULT false,
  is_provider_paied    BOOLEAN                DEFAULT false,
  payment_method       payment_method,
  observations         TEXT,
  provider_observations TEXT,
  created_at           TIMESTAMPTZ            DEFAULT now(),
  updated_at           TIMESTAMPTZ            DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_client_id           ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_profile_id ON service_requests(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status              ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_date        ON service_requests(service_date);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- service_request_status_history
CREATE TABLE IF NOT EXISTS service_request_status_history (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  from_status        VARCHAR(50),
  to_status          VARCHAR(50) NOT NULL,
  changed_by         UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  observations       TEXT,
  metadata           JSONB,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_status_history_service_request_id ON service_request_status_history(service_request_id);
CREATE INDEX IF NOT EXISTS idx_sr_status_history_created_at         ON service_request_status_history(created_at);

ALTER TABLE service_request_status_history ENABLE ROW LEVEL SECURITY;

-- chat_rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            UUID        REFERENCES trips(id) ON DELETE SET NULL,
  service_request_id UUID        REFERENCES service_requests(id) ON DELETE SET NULL,
  client_id          UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id        UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active          BOOLEAN     DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_chat_room_reference CHECK (
    (trip_id IS NOT NULL AND service_request_id IS NULL) OR
    (trip_id IS NULL AND service_request_id IS NOT NULL)
  )
);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID         NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message      TEXT         NOT NULL,
  message_type message_type DEFAULT 'text',
  attachment_url TEXT,
  is_read      BOOLEAN      DEFAULT false,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_room_id ON chat_messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id   ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at  ON chat_messages(created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  body           TEXT         NOT NULL,
  type           VARCHAR(50)  NOT NULL,
  reference_type VARCHAR(50),
  reference_id   UUID,
  link           TEXT,
  is_read        BOOLEAN      DEFAULT false,
  read_at        TIMESTAMPTZ,
  is_pushed      BOOLEAN      DEFAULT false,
  pushed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- user_devices
CREATE TABLE IF NOT EXISTS user_devices (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT          NOT NULL,
  platform     platform_type NOT NULL,
  is_active    BOOLEAN       DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   DEFAULT now(),

  CONSTRAINT uq_user_device_token UNIQUE (user_id, device_token)
);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- driver_locations
CREATE TABLE IF NOT EXISTS driver_locations (
  id                UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id UUID                   UNIQUE NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  trip_id           UUID                   REFERENCES trips(id) ON DELETE SET NULL,
  latitude          DECIMAL(10,7)          NOT NULL,
  longitude         DECIMAL(10,7)          NOT NULL,
  location          GEOGRAPHY(Point, 4326),
  heading           DECIMAL(5,2),
  speed             DECIMAL(6,2),
  updated_at        TIMESTAMPTZ            DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations USING GIST(location);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- private_comments
CREATE TABLE IF NOT EXISTS private_comments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_type VARCHAR(50) NOT NULL,
  reference_id   UUID,
  comment        TEXT        NOT NULL,
  admin_response TEXT,
  responded_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_comments_author_id      ON private_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_private_comments_reference_type ON private_comments(reference_type);
CREATE INDEX IF NOT EXISTS idx_private_comments_reference_id   ON private_comments(reference_id);

ALTER TABLE private_comments ENABLE ROW LEVEL SECURITY;

-- ratings
CREATE TABLE IF NOT EXISTS ratings (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            UUID         REFERENCES trips(id) ON DELETE SET NULL,
  service_request_id UUID         REFERENCES service_requests(id) ON DELETE SET NULL,
  rater_id           UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rated_id           UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating             DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment            TEXT,
  created_at         TIMESTAMPTZ  DEFAULT now(),

  CONSTRAINT chk_rating_reference CHECK (
    (trip_id IS NOT NULL AND service_request_id IS NULL) OR
    (trip_id IS NULL AND service_request_id IS NOT NULL)
  )
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- provider_category_services
CREATE TABLE IF NOT EXISTS provider_category_services (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID        NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_category_id UUID        NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  is_primary          BOOLEAN     DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_provider_category UNIQUE (provider_profile_id, service_category_id)
);

ALTER TABLE provider_category_services ENABLE ROW LEVEL SECURITY;

-- system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,
  value       JSONB        NOT NULL,
  description TEXT,
  updated_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- trip_driver_candidates
-- status usa o enum trip_status_candidate (20260424100002)
-- offered_price adicionado em 20260520120000
CREATE TABLE IF NOT EXISTS trip_driver_candidates (
  id                UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           UUID                   NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  driver_profile_id UUID                   NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  status            trip_status_candidate  NOT NULL DEFAULT 'pending',
  invited_at        TIMESTAMPTZ            DEFAULT now(),
  responded_at      TIMESTAMPTZ,
  observations      TEXT,
  offered_price     DECIMAL(10,2),
  created_at        TIMESTAMPTZ            DEFAULT now(),

  UNIQUE(trip_id, driver_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_trip_id           ON trip_driver_candidates(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_driver_profile_id ON trip_driver_candidates(driver_profile_id);

ALTER TABLE trip_driver_candidates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Seção 04: Funções
-- ============================================================================

-- Helper: retorna o role do usuário autenticado (usado nas RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: checa se auth.uid() é candidato a uma trip (quebra recursão em RLS)
CREATE OR REPLACE FUNCTION public.is_trip_candidate_for_current_user(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_driver_candidates tdc
    JOIN public.driver_profiles dp ON dp.id = tdc.driver_profile_id
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
    WHERE tdc.trip_id = p_trip_id
      AND pp.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_candidate_for_current_user(uuid) TO authenticated;

-- Trigger: popula addresses.location a partir de lat/lng (null-safe)
CREATE OR REPLACE FUNCTION set_address_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: popula driver_locations.location a partir de lat/lng
CREATE OR REPLACE FUNCTION set_driver_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: registra histórico de status de trips com observação opcional via session config
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

-- Trigger: registra histórico de status de service_requests
CREATE OR REPLACE FUNCTION log_service_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO service_request_status_history (service_request_id, from_status, to_status, changed_by)
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

-- Trigger: recalcula average_rating e total_ratings do provider após nova avaliação
CREATE OR REPLACE FUNCTION recalculate_provider_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_profile_id UUID;
  v_avg                 DECIMAL(3,2);
  v_total               INTEGER;
BEGIN
  SELECT id INTO v_provider_profile_id
  FROM provider_profiles
  WHERE user_id = NEW.rated_id;

  IF v_provider_profile_id IS NOT NULL THEN
    SELECT COALESCE(AVG(r.rating), 0), COUNT(r.id)
    INTO v_avg, v_total
    FROM ratings r
    WHERE r.rated_id = NEW.rated_id;

    UPDATE provider_profiles
    SET average_rating = v_avg,
        total_ratings  = v_total
    WHERE id = v_provider_profile_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: cria public.users automaticamente após signup no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone, role, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'client',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: rejeita viagem em "under_review" registrando observação em uma única transação
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

-- RPC: seleciona motorista vencedor de forma atômica
CREATE OR REPLACE FUNCTION select_trip_driver(
  p_trip_id         UUID,
  p_candidate_id    UUID,
  p_driver_profile_id UUID,
  p_offered_price   DECIMAL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE trips
  SET driver_profile_id = p_driver_profile_id,
      final_price       = p_offered_price,
      status            = 'awaiting_driver_confirmation'
  WHERE id = p_trip_id
    AND status = 'searching_drivers';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip % is not in searching_drivers status', p_trip_id;
  END IF;

  UPDATE trip_driver_candidates
  SET status       = 'accepted',
      responded_at = NOW()
  WHERE id = p_candidate_id;

  UPDATE trip_driver_candidates
  SET status       = 'rejected',
      responded_at = NOW()
  WHERE trip_id = p_trip_id
    AND id != p_candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION select_trip_driver(UUID, UUID, UUID, DECIMAL) TO authenticated;

-- Trigger helper: impede que a escolha do passageiro pule o re-check do motorista
CREATE OR REPLACE FUNCTION require_driver_recheck_before_scheduled()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'scheduled'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status IN ('searching_drivers', 'awaiting_client_confirmation')
     AND NEW.driver_profile_id IS NOT NULL THEN
    NEW.status := 'awaiting_driver_confirmation';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger helper: ao cancelar uma corrida, remove convites/candidaturas ativas
-- dos apps de motorista imediatamente via realtime em trip_driver_candidates.
CREATE OR REPLACE FUNCTION reject_trip_candidates_when_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE trip_driver_candidates
    SET status = 'rejected',
        responded_at = COALESCE(responded_at, NOW()),
        observations = COALESCE(observations, 'Corrida cancelada pela KZ')
    WHERE trip_id = NEW.id
      AND status IN ('pending', 'accepted');
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Seção 05: Triggers
-- ============================================================================

-- addresses: popula location
DROP TRIGGER IF EXISTS trg_set_address_location ON addresses;
CREATE TRIGGER trg_set_address_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION set_address_location();

-- driver_locations: popula location
DROP TRIGGER IF EXISTS trg_set_driver_location ON driver_locations;
CREATE TRIGGER trg_set_driver_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION set_driver_location();

-- updated_at automático
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_profiles_updated_at ON provider_profiles;
CREATE TRIGGER trg_provider_profiles_updated_at
  BEFORE UPDATE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_driver_profiles_updated_at ON driver_profiles;
CREATE TRIGGER trg_driver_profiles_updated_at
  BEFORE UPDATE ON driver_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_require_driver_recheck_before_scheduled ON trips;
CREATE TRIGGER trg_require_driver_recheck_before_scheduled
  BEFORE UPDATE OF status, driver_profile_id ON trips
  FOR EACH ROW
  EXECUTE FUNCTION require_driver_recheck_before_scheduled();

DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON service_requests;
CREATE TRIGGER trg_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_driver_locations_updated_at ON driver_locations;
CREATE TRIGGER trg_driver_locations_updated_at
  BEFORE UPDATE ON driver_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- histórico de status
DROP TRIGGER IF EXISTS trg_log_trip_status_change ON trips;
CREATE TRIGGER trg_log_trip_status_change
  AFTER UPDATE OF status ON trips
  FOR EACH ROW
  EXECUTE FUNCTION log_trip_status_change();

DROP TRIGGER IF EXISTS trg_reject_trip_candidates_when_cancelled ON trips;
CREATE TRIGGER trg_reject_trip_candidates_when_cancelled
  AFTER UPDATE OF status ON trips
  FOR EACH ROW
  EXECUTE FUNCTION reject_trip_candidates_when_cancelled();

DROP TRIGGER IF EXISTS trg_log_service_request_status_change ON service_requests;
CREATE TRIGGER trg_log_service_request_status_change
  AFTER UPDATE OF status ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_service_request_status_change();

-- recalcula rating do provider
DROP TRIGGER IF EXISTS trg_recalculate_provider_rating ON ratings;
CREATE TRIGGER trg_recalculate_provider_rating
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_provider_rating();

-- cria public.users após signup
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Seção 06: RLS Policies
-- ============================================================================

-- -------------------------------------------------------------------------
-- users
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated
  USING (is_active = true OR id = auth.uid() OR public.get_user_role() = 'admin');

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS users_update_admin ON users;
CREATE POLICY users_update_admin ON users
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.get_user_role() = 'admin');

-- -------------------------------------------------------------------------
-- service_categories
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS service_categories_select ON service_categories;
CREATE POLICY service_categories_select ON service_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS service_categories_admin ON service_categories;
CREATE POLICY service_categories_admin ON service_categories
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- -------------------------------------------------------------------------
-- provider_profiles
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS provider_profiles_select ON provider_profiles;
CREATE POLICY provider_profiles_select ON provider_profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS provider_profiles_insert ON provider_profiles;
CREATE POLICY provider_profiles_insert ON provider_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.get_user_role() = 'admin');

DROP POLICY IF EXISTS provider_profiles_update_own ON provider_profiles;
CREATE POLICY provider_profiles_update_own ON provider_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS provider_profiles_update_admin ON provider_profiles;
CREATE POLICY provider_profiles_update_admin ON provider_profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- -------------------------------------------------------------------------
-- driver_profiles
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS driver_profiles_select ON driver_profiles;
CREATE POLICY driver_profiles_select ON driver_profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS driver_profiles_insert ON driver_profiles;
CREATE POLICY driver_profiles_insert ON driver_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS driver_profiles_update ON driver_profiles;
CREATE POLICY driver_profiles_update ON driver_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- vehicles
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS vehicles_select ON vehicles;
CREATE POLICY vehicles_select ON vehicles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS vehicles_insert ON vehicles;
CREATE POLICY vehicles_insert ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS vehicles_update ON vehicles;
CREATE POLICY vehicles_update ON vehicles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS vehicles_delete ON vehicles;
CREATE POLICY vehicles_delete ON vehicles
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- vehicle_photos
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS vehicle_photos_select ON vehicle_photos;
CREATE POLICY vehicle_photos_select ON vehicle_photos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS vehicle_photos_insert ON vehicle_photos;
CREATE POLICY vehicle_photos_insert ON vehicle_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles v
      JOIN driver_profiles dp ON dp.id = v.driver_profile_id
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE v.id = vehicle_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS vehicle_photos_update ON vehicle_photos;
CREATE POLICY vehicle_photos_update ON vehicle_photos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles v
      JOIN driver_profiles dp ON dp.id = v.driver_profile_id
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE v.id = vehicle_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS vehicle_photos_delete ON vehicle_photos;
CREATE POLICY vehicle_photos_delete ON vehicle_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles v
      JOIN driver_profiles dp ON dp.id = v.driver_profile_id
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE v.id = vehicle_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- addresses
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS addresses_select ON addresses;
CREATE POLICY addresses_select ON addresses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS addresses_insert ON addresses;
CREATE POLICY addresses_insert ON addresses
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- trips
-- trips_select: versão final (20260424100001) — usa is_trip_candidate_for_current_user
-- trips_insert: versão final (20260514120001) — admin também pode inserir
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS trips_select ON trips;
CREATE POLICY trips_select ON trips
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.driver_profiles dp
      JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = trips.driver_profile_id
        AND pp.user_id = auth.uid()
    )
    OR public.is_trip_candidate_for_current_user(trips.id)
    OR public.get_user_role() = 'admin'::user_role
  );

DROP POLICY IF EXISTS trips_insert ON trips;
CREATE POLICY trips_insert ON trips
  FOR INSERT TO authenticated
  WITH CHECK (
    (client_id = auth.uid() AND public.get_user_role() = 'client')
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS trips_update ON trips;
CREATE POLICY trips_update ON trips
  FOR UPDATE TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- trip_children
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_children_select ON trip_children;
CREATE POLICY trip_children_select ON trip_children
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM driver_profiles dp
          JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
          WHERE dp.id = t.driver_profile_id AND pp.user_id = auth.uid()
        )
        OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS trip_children_insert ON trip_children;
CREATE POLICY trip_children_insert ON trip_children
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND t.client_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS trip_children_update ON trip_children;
CREATE POLICY trip_children_update ON trip_children
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid() OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS trip_children_delete ON trip_children;
CREATE POLICY trip_children_delete ON trip_children
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid() OR public.get_user_role() = 'admin'
      )
    )
  );

-- -------------------------------------------------------------------------
-- trip_luggage
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_luggage_select ON trip_luggage;
CREATE POLICY trip_luggage_select ON trip_luggage
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM driver_profiles dp
          JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
          WHERE dp.id = t.driver_profile_id AND pp.user_id = auth.uid()
        )
        OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS trip_luggage_insert ON trip_luggage;
CREATE POLICY trip_luggage_insert ON trip_luggage
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND t.client_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS trip_luggage_update ON trip_luggage;
CREATE POLICY trip_luggage_update ON trip_luggage
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid() OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS trip_luggage_delete ON trip_luggage;
CREATE POLICY trip_luggage_delete ON trip_luggage
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid() OR public.get_user_role() = 'admin'
      )
    )
  );

-- -------------------------------------------------------------------------
-- trip_status_history
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_status_history_select ON trip_status_history;
CREATE POLICY trip_status_history_select ON trip_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND (
        t.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM driver_profiles dp
          JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
          WHERE dp.id = t.driver_profile_id AND pp.user_id = auth.uid()
        )
        OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS trip_status_history_insert ON trip_status_history;
CREATE POLICY trip_status_history_insert ON trip_status_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- service_requests
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS service_requests_select ON service_requests;
CREATE POLICY service_requests_select ON service_requests
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS service_requests_insert ON service_requests;
CREATE POLICY service_requests_insert ON service_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

DROP POLICY IF EXISTS service_requests_update ON service_requests;
CREATE POLICY service_requests_update ON service_requests
  FOR UPDATE TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- service_request_status_history
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS sr_status_history_select ON service_request_status_history;
CREATE POLICY sr_status_history_select ON service_request_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_requests sr
      WHERE sr.id = service_request_id AND (
        sr.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM provider_profiles pp
          WHERE pp.id = sr.provider_profile_id AND pp.user_id = auth.uid()
        )
        OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS sr_status_history_insert ON service_request_status_history;
CREATE POLICY sr_status_history_insert ON service_request_status_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- chat_rooms
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS chat_rooms_select ON chat_rooms;
CREATE POLICY chat_rooms_select ON chat_rooms
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS chat_rooms_insert ON chat_rooms;
CREATE POLICY chat_rooms_insert ON chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- chat_messages
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = chat_room_id AND (
        cr.client_id = auth.uid()
        OR cr.provider_id = auth.uid()
        OR public.get_user_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = chat_room_id AND (
        cr.client_id = auth.uid()
        OR cr.provider_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = chat_room_id AND (
        cr.client_id = auth.uid()
        OR cr.provider_id = auth.uid()
      )
    )
  );

-- -------------------------------------------------------------------------
-- notifications
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- user_devices
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS user_devices_all ON user_devices;
CREATE POLICY user_devices_all ON user_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- driver_locations
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS driver_locations_select ON driver_locations;
CREATE POLICY driver_locations_select ON driver_locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id
        AND t.client_id = auth.uid()
        AND t.status IN ('scheduled', 'started')
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS driver_locations_insert ON driver_locations;
CREATE POLICY driver_locations_insert ON driver_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS driver_locations_update ON driver_locations;
CREATE POLICY driver_locations_update ON driver_locations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------------------
-- private_comments
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS private_comments_select ON private_comments;
CREATE POLICY private_comments_select ON private_comments
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS private_comments_insert ON private_comments;
CREATE POLICY private_comments_insert ON private_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_user_role() = 'provider'
  );

DROP POLICY IF EXISTS private_comments_update_admin ON private_comments;
CREATE POLICY private_comments_update_admin ON private_comments
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- -------------------------------------------------------------------------
-- ratings
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS ratings_select ON ratings;
CREATE POLICY ratings_select ON ratings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ratings_insert ON ratings;
CREATE POLICY ratings_insert ON ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND (
      (trip_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM trips t
        WHERE t.id = trip_id AND (
          t.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM driver_profiles dp
            JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
            WHERE dp.id = t.driver_profile_id AND pp.user_id = auth.uid()
          )
        )
      ))
      OR
      (service_request_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM service_requests sr
        WHERE sr.id = service_request_id AND (
          sr.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM provider_profiles pp
            WHERE pp.id = sr.provider_profile_id AND pp.user_id = auth.uid()
          )
        )
      ))
    )
  );

-- -------------------------------------------------------------------------
-- provider_category_services
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS provider_category_services_select ON provider_category_services;
CREATE POLICY provider_category_services_select ON provider_category_services
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS provider_category_services_insert ON provider_category_services;
CREATE POLICY provider_category_services_insert ON provider_category_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS provider_category_services_delete ON provider_category_services;
CREATE POLICY provider_category_services_delete ON provider_category_services
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- -------------------------------------------------------------------------
-- system_settings
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS system_settings_select ON system_settings;
CREATE POLICY system_settings_select ON system_settings
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS system_settings_admin ON system_settings;
CREATE POLICY system_settings_admin ON system_settings
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- -------------------------------------------------------------------------
-- trip_driver_candidates
-- select: versão final (20260424100001)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_driver_candidates_select ON trip_driver_candidates;
CREATE POLICY trip_driver_candidates_select ON trip_driver_candidates
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'::user_role
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_driver_candidates.trip_id
        AND (
          t.client_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.driver_profiles dp
            JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
            WHERE dp.id = t.driver_profile_id
              AND pp.user_id = auth.uid()
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.driver_profiles dp
      JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = trip_driver_candidates.driver_profile_id
        AND pp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS trip_driver_candidates_insert ON trip_driver_candidates;
CREATE POLICY trip_driver_candidates_insert ON trip_driver_candidates
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS trip_driver_candidates_update ON trip_driver_candidates;
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

DROP POLICY IF EXISTS trip_driver_candidates_delete ON trip_driver_candidates;
CREATE POLICY trip_driver_candidates_delete ON trip_driver_candidates
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================================
-- Seção 07: Realtime Publications
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trips;
  END IF;
END $$;

-- ============================================================================
-- Seção 08: Seed Data
-- ============================================================================

INSERT INTO service_categories (name, slug, description, service_type, is_active) VALUES
  ('Motorista',           'driver',              'Serviço de transporte de passageiros',          'trip',          true),
  ('Diarista',            'housekeeper',         'Serviço de limpeza',                            'other_service', true),
  ('Eletricista',         'electrician',         'Serviço elétrico',                              'other_service', true),
  ('Encanador',           'plumber',             'Serviços de encanamento e hidráulica',          'other_service', true),
  ('Pintor',              'painter',             'Serviços de pintura residencial e comercial',   'other_service', true),
  ('Faxineira',           'cleaner',             'Serviços de limpeza e faxina',                  'other_service', true),
  ('Montador de Móveis',  'furniture_assembler', 'Montagem e desmontagem de móveis',              'other_service', true),
  ('Técnico de Informática', 'it_technician',    'Suporte técnico e manutenção de computadores',  'other_service', true),
  ('Jardineiro',          'gardener',            'Serviços de jardinagem e paisagismo',           'other_service', true),
  ('Pedreiro',            'mason',               'Serviços de alvenaria e construção',            'other_service', true),
  ('Chaveiro',            'locksmith',           'Serviços de chaveiro e fechaduras',             'other_service', true),
  ('Ar-condicionado',     'ac_technician',       'Instalação e manutenção de ar-condicionado',   'other_service', true),
  ('Marceneiro',          'carpenter',           'Serviços de marcenaria sob medida',             'other_service', true),
  ('Vidraceiro',          'glazier',             'Serviços de vidraçaria e espelhos',             'other_service', true),
  ('Serralheiro',         'welder',              'Serviços de serralheria e soldagem',            'other_service', true),
  ('Dedetizador',         'pest_control',        'Controle de pragas e dedetização',              'other_service', true)
ON CONFLICT (slug) DO NOTHING;

-- +goose Down
-- Este arquivo representa o schema completo consolidado.
-- Para rollback, remova todas as tabelas, funções, triggers e publicações na ordem inversa.
