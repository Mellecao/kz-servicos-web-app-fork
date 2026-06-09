-- ============================================================================
-- Migration 25: Create RLS Policies
-- Description: Políticas de Row Level Security para TODAS as tabelas do sistema.
--   Define quem pode ler, inserir, atualizar e deletar dados em cada tabela.
-- ============================================================================

-- +goose Up

-- =========================================================================
-- Helper function: verifica o role do usuário autenticado
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =========================================================================
-- USERS
-- =========================================================================
-- SELECT: qualquer autenticado pode ver usuários ativos
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated
  USING (is_active = true OR id = auth.uid() OR public.get_user_role() = 'admin');

-- UPDATE: usuário só edita o próprio perfil
CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: admin pode editar qualquer usuário
CREATE POLICY users_update_admin ON users
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- INSERT: permitido via trigger do auth (ou admin)
CREATE POLICY users_insert ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.get_user_role() = 'admin');

-- =========================================================================
-- SERVICE_CATEGORIES
-- =========================================================================
CREATE POLICY service_categories_select ON service_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY service_categories_admin ON service_categories
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- =========================================================================
-- PROVIDER_PROFILES
-- =========================================================================
-- SELECT: qualquer autenticado pode ler
CREATE POLICY provider_profiles_select ON provider_profiles
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: próprio provider
CREATE POLICY provider_profiles_insert ON provider_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.get_user_role() = 'admin');

-- UPDATE: próprio provider ou admin
CREATE POLICY provider_profiles_update_own ON provider_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY provider_profiles_update_admin ON provider_profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- =========================================================================
-- DRIVER_PROFILES
-- =========================================================================
-- SELECT: qualquer autenticado
CREATE POLICY driver_profiles_select ON driver_profiles
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: dono do provider_profile ou admin
CREATE POLICY driver_profiles_insert ON driver_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- UPDATE: dono do provider_profile ou admin
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

-- =========================================================================
-- VEHICLES
-- =========================================================================
-- SELECT: qualquer autenticado
CREATE POLICY vehicles_select ON vehicles
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: dono do driver_profile ou admin
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

-- UPDATE: dono do driver_profile ou admin
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

-- DELETE: dono do driver_profile ou admin
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

-- =========================================================================
-- VEHICLE_PHOTOS
-- =========================================================================
-- SELECT: qualquer autenticado
CREATE POLICY vehicle_photos_select ON vehicle_photos
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: dono do veículo ou admin
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

-- UPDATE: dono do veículo ou admin
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

-- DELETE: dono do veículo ou admin
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

-- =========================================================================
-- ADDRESSES
-- =========================================================================
-- SELECT: qualquer autenticado (endereços são dados públicos de referência)
CREATE POLICY addresses_select ON addresses
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: qualquer autenticado pode criar endereços
CREATE POLICY addresses_insert ON addresses
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================================
-- TRIPS
-- =========================================================================
-- SELECT: client_id, driver do driver_profile_id, ou admin
CREATE POLICY trips_select ON trips
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- INSERT: apenas clients
CREATE POLICY trips_insert ON trips
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

-- UPDATE: participantes da trip ou admin
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

-- =========================================================================
-- TRIP_CHILDREN (mesma política do trips via trip_id)
-- =========================================================================
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

CREATE POLICY trip_children_insert ON trip_children
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND t.client_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

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

-- =========================================================================
-- TRIP_LUGGAGE (mesma política do trips via trip_id)
-- =========================================================================
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

CREATE POLICY trip_luggage_insert ON trip_luggage
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id AND t.client_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

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

-- =========================================================================
-- TRIP_STATUS_HISTORY
-- =========================================================================
-- SELECT: participantes da trip ou admin
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

-- INSERT: via trigger (sistema) — policy permissiva para a function SECURITY DEFINER
CREATE POLICY trip_status_history_insert ON trip_status_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================================
-- SERVICE_REQUESTS
-- =========================================================================
-- SELECT: client_id, owner do provider_profile_id, ou admin
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

-- INSERT: apenas clients
CREATE POLICY service_requests_insert ON service_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

-- UPDATE: participantes ou admin
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

-- =========================================================================
-- SERVICE_REQUEST_STATUS_HISTORY
-- =========================================================================
-- SELECT: participantes ou admin
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

-- INSERT: via trigger (sistema)
CREATE POLICY sr_status_history_insert ON service_request_status_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================================
-- CHAT_ROOMS
-- =========================================================================
-- SELECT: client_id ou provider_id da room
CREATE POLICY chat_rooms_select ON chat_rooms
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- INSERT: participantes do serviço/viagem
CREATE POLICY chat_rooms_insert ON chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- =========================================================================
-- CHAT_MESSAGES
-- =========================================================================
-- SELECT: participantes do chat_room
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

-- INSERT: participantes do chat_room
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

-- UPDATE: apenas para marcar como lido
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

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
-- SELECT: apenas o próprio user_id
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- UPDATE: apenas o próprio user_id (marcar como lido)
CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT: sistema (via service role ou functions)
CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================================
-- USER_DEVICES
-- =========================================================================
-- ALL: apenas o próprio user_id
CREATE POLICY user_devices_all ON user_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- DRIVER_LOCATIONS
-- =========================================================================
-- SELECT: motorista dono, cliente da viagem ativa, ou admin
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

-- INSERT: apenas o motorista dono
CREATE POLICY driver_locations_insert ON driver_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
  );

-- UPDATE: apenas o motorista dono
CREATE POLICY driver_locations_update ON driver_locations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_profiles dp
      JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
      WHERE dp.id = driver_profile_id AND pp.user_id = auth.uid()
    )
  );

-- =========================================================================
-- PRIVATE_COMMENTS
-- =========================================================================
-- SELECT: author_id ou admin
CREATE POLICY private_comments_select ON private_comments
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- INSERT: role = 'provider'
CREATE POLICY private_comments_insert ON private_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_user_role() = 'provider'
  );

-- UPDATE (admin_response): role = 'admin'
CREATE POLICY private_comments_update_admin ON private_comments
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- =========================================================================
-- RATINGS
-- =========================================================================
-- SELECT: qualquer autenticado
CREATE POLICY ratings_select ON ratings
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: participantes do serviço/viagem
CREATE POLICY ratings_insert ON ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND (
      -- Para trips: o rater deve ser participante
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
      -- Para service_requests: o rater deve ser participante
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

-- =========================================================================
-- PROVIDER_CATEGORY_SERVICES
-- =========================================================================
-- SELECT: qualquer autenticado
CREATE POLICY provider_category_services_select ON provider_category_services
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: próprio provider ou admin
CREATE POLICY provider_category_services_insert ON provider_category_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- DELETE: próprio provider ou admin
CREATE POLICY provider_category_services_delete ON provider_category_services
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.id = provider_profile_id AND pp.user_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

-- =========================================================================
-- SYSTEM_SETTINGS
-- =========================================================================
-- SELECT: apenas admin
CREATE POLICY system_settings_select ON system_settings
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

-- ALL: apenas admin
CREATE POLICY system_settings_admin ON system_settings
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- +goose Down
-- (Drop all policies — in reverse order)
-- DROP POLICY IF EXISTS system_settings_admin ON system_settings;
-- DROP POLICY IF EXISTS system_settings_select ON system_settings;
-- ... (all other policies)
-- DROP FUNCTION IF EXISTS public.get_user_role();
