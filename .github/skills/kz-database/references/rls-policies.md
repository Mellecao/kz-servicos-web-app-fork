# Políticas RLS

> Gerado em 2026-11-05 a partir de dumps do banco real (projeto `mtsqeomctrqfyekyzapc`, schema `public`). Não editar à mão as tabelas: atualizar com a nova introspeção do banco, ou acrescentar a alteração da migration nova (ver regra no SKILL.md).

Papel do utilizador: `get_user_role()` devolve `client`, `provider` ou `admin` (usado nas políticas). `USING` filtra linhas existentes (SELECT/UPDATE/DELETE); `WITH CHECK` valida as gravadas (INSERT/UPDATE).

## users

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `users_insert` | INSERT | authenticated | — | `((id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` |
| `users_select` | SELECT | authenticated | `((is_active = true) OR (id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` | — |
| `users_update_admin` | UPDATE | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `users_update_own` | UPDATE | authenticated | `(id = auth.uid())` | `(id = auth.uid())` |

## provider_profiles

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `provider_profiles_insert` | INSERT | authenticated | — | `((user_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` |
| `provider_profiles_select` | SELECT | authenticated | `true` | — |
| `provider_profiles_update_admin` | UPDATE | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `provider_profiles_update_own` | UPDATE | authenticated | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

## provider_category_services

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `provider_category_services_delete` | DELETE | authenticated | `((EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = provider_category_services.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |
| `provider_category_services_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = provider_category_services.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `provider_category_services_select` | SELECT | authenticated | `true` | — |

## service_categories

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `service_categories_admin` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `service_categories_select` | SELECT | authenticated | `true` | — |

## service_requests

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `service_requests_insert` | INSERT | authenticated | — | `(((client_id = auth.uid()) AND (get_user_role() = 'client'::user_role)) OR (get_user_role() = 'admin'::user_role))` |
| `service_requests_select` | SELECT | authenticated | `((client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = service_requests.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |
| `service_requests_select_invited_provider` | SELECT | authenticated | `is_service_request_provider_candidate_for_current_user(id)` | — |
| `service_requests_update` | UPDATE | authenticated | `((client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = service_requests.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |

## service_request_provider_candidates

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `service_request_provider_candidates_delete` | DELETE | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = service_request_provider_candidates.provider_profile_id) AND (pp.user_id = auth.uid())))))` | — |
| `service_request_provider_candidates_insert` | INSERT | authenticated | — | `(get_user_role() = 'admin'::user_role)` |
| `service_request_provider_candidates_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM service_requests sr WHERE ((sr.id = service_request_provider_candidates.service_request_id) AND (sr.client_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = service_request_provider_candidates.provider_profile_id) AND (pp.user_id = auth.uid())))))` | — |
| `service_request_provider_candidates_update` | UPDATE | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = service_request_provider_candidates.provider_profile_id) AND (pp.user_id = auth.uid())))))` | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = service_request_provider_candidates.provider_profile_id) AND (pp.user_id = auth.uid())))))` |

## service_request_status_history

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `sr_status_history_insert` | INSERT | authenticated | — | `true` |
| `sr_status_history_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM service_requests sr WHERE ((sr.id = service_request_status_history.service_request_id) AND ((sr.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = sr.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role)))))` | — |

## trips

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trips_insert` | INSERT | authenticated | — | `(((client_id = auth.uid()) AND (get_user_role() = 'client'::user_role)) OR (get_user_role() = 'admin'::user_role))` |
| `trips_select` | SELECT | authenticated | `((client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = trips.driver_profile_id) AND (pp.user_id = auth.uid())))) OR is_trip_candidate_for_current_user(id) OR (get_user_role() = 'admin'::user_role))` | — |
| `trips_update` | UPDATE | authenticated | `((client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = trips.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |

## trip_driver_candidates

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_driver_candidates_delete` | DELETE | authenticated | `(get_user_role() = 'admin'::user_role)` | — |
| `trip_driver_candidates_insert` | INSERT | authenticated | — | `(get_user_role() = 'admin'::user_role)` |
| `trip_driver_candidates_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_driver_candidates.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = t.driver_profile_id) AND (pp.user_id = auth.uid())))))))) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = trip_driver_candidates.driver_profile_id) AND (pp.user_id = auth.uid())))))` | — |
| `trip_driver_candidates_update` | UPDATE | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = trip_driver_candidates.driver_profile_id) AND (pp.user_id = auth.uid())))))` | — |

## products

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `products_admin_write` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `products_select` | SELECT | authenticated | `(is_active OR (get_user_role() = 'admin'::user_role))` | — |

## product_orders

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `product_orders_admin_write` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `product_orders_select` | SELECT | authenticated | `((client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` | — |

## product_order_items

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `product_order_items_admin_write` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `product_order_items_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM product_orders o WHERE ((o.id = product_order_items.order_id) AND (o.client_id = auth.uid())))))` | — |

## notifications

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `notifications_insert` | INSERT | authenticated | — | `true` |
| `notifications_select` | SELECT | authenticated | `(user_id = auth.uid())` | — |
| `notifications_update` | UPDATE | authenticated | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

## system_settings

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `authenticated_read_product_delivery_fee` | SELECT | authenticated | `((key)::text = 'product_delivery_fee'::text)` | — |
| `authenticated_read_scheduled_quote_override` | SELECT | authenticated | `((key)::text = 'scheduled_quote_admin_override'::text)` | — |
| `system_settings_admin` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `system_settings_select` | SELECT | authenticated | `(get_user_role() = 'admin'::user_role)` | — |

## driver_regions

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `driver_regions_admin_all` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `driver_regions_authenticated_read` | SELECT | authenticated | `true` | — |

## chat_rooms

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `chat_rooms_insert` | INSERT | authenticated | — | `((client_id = auth.uid()) OR (provider_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` |
| `chat_rooms_select` | SELECT | authenticated | `((client_id = auth.uid()) OR (provider_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` | — |

## chat_messages

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `chat_messages_insert` | INSERT | authenticated | — | `((sender_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = chat_messages.chat_room_id) AND ((cr.client_id = auth.uid()) OR (cr.provider_id = auth.uid()))))))` |
| `chat_messages_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = chat_messages.chat_room_id) AND ((cr.client_id = auth.uid()) OR (cr.provider_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `chat_messages_update` | UPDATE | authenticated | `(EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = chat_messages.chat_room_id) AND ((cr.client_id = auth.uid()) OR (cr.provider_id = auth.uid())))))` | — |

## addresses

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `addresses_insert` | INSERT | authenticated | — | `true` |
| `addresses_select` | SELECT | authenticated | `true` | — |

## admin_logs

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `admin_logs_insert` | INSERT | authenticated | — | `(get_user_role() = 'admin'::user_role)` |
| `admin_logs_select` | SELECT | authenticated | `(get_user_role() = 'admin'::user_role)` | — |

## driver_locations

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `driver_locations_insert` | INSERT | authenticated | — | `(EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_locations.driver_profile_id) AND (pp.user_id = auth.uid()))))` |
| `driver_locations_select` | SELECT | authenticated | `((EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_locations.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = driver_locations.trip_id) AND (t.client_id = auth.uid()) AND (t.status = ANY (ARRAY['scheduled'::trip_status, 'started'::trip_status]))))) OR (get_user_role() = 'admin'::user_role))` | — |
| `driver_locations_update` | UPDATE | authenticated | `(EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_locations.driver_profile_id) AND (pp.user_id = auth.uid()))))` | — |

## driver_profile_photos

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `driver_profile_photos_delete` | DELETE | public | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_profile_photos.driver_profile_id) AND (pp.user_id = auth.uid())))))` | — |
| `driver_profile_photos_insert` | INSERT | public | — | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_profile_photos.driver_profile_id) AND (pp.user_id = auth.uid())))))` |
| `driver_profile_photos_insert_owner` | INSERT | public | — | `(EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_profile_photos.driver_profile_id) AND (pp.user_id = auth.uid()))))` |
| `driver_profile_photos_select` | SELECT | public | `true` | — |
| `driver_profile_photos_select_all` | SELECT | public | `true` | — |

## driver_profile_regions

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `driver_profile_regions_admin_all` | ALL | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |
| `driver_profile_regions_driver_read` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = driver_profile_regions.driver_profile_id) AND (pp.user_id = auth.uid()))))` | — |

## driver_profiles

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `driver_profiles_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = driver_profiles.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `driver_profiles_select` | SELECT | authenticated | `true` | — |
| `driver_profiles_update` | UPDATE | authenticated | `((EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = driver_profiles.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | `((EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = driver_profiles.provider_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |

## private_comments

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `private_comments_insert` | INSERT | authenticated | — | `((author_id = auth.uid()) AND (get_user_role() = 'provider'::user_role))` |
| `private_comments_select` | SELECT | authenticated | `((author_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` | — |
| `private_comments_update_admin` | UPDATE | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |

## ratings

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `ratings_insert` | INSERT | authenticated | — | `((rater_id = auth.uid()) AND (((trip_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = ratings.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = t.driver_profile_id) AND (pp.user_id = auth.uid()))))))))) OR ((service_request_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM service_requests sr WHERE ((sr.id = ratings.service_request_id) AND ((sr.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = sr.provider_profile_id) AND (pp.user_id = auth.uid())))))))))))` |
| `ratings_select` | SELECT | authenticated | `true` | — |

## service_request_photos

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `service_request_photos_delete` | DELETE | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM service_requests sr WHERE ((sr.id = service_request_photos.service_request_id) AND (sr.client_id = auth.uid())))))` | — |
| `service_request_photos_insert` | INSERT | authenticated | — | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM service_requests sr WHERE ((sr.id = service_request_photos.service_request_id) AND (sr.client_id = auth.uid())))))` |
| `service_request_photos_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM service_requests sr WHERE ((sr.id = service_request_photos.service_request_id) AND ((sr.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM provider_profiles pp WHERE ((pp.id = sr.provider_profile_id) AND (pp.user_id = auth.uid())))))))))` | — |

## support_conversations

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `support_conversations_insert_provider` | INSERT | authenticated | — | `((provider_user_id = auth.uid()) AND (get_user_role() = 'provider'::user_role))` |
| `support_conversations_select` | SELECT | authenticated | `((provider_user_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))` | — |

## support_messages

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `support_messages_insert_participant` | INSERT | authenticated | — | `((sender_id = auth.uid()) AND (is_read = false) AND (read_at IS NULL) AND (EXISTS ( SELECT 1 FROM support_conversations sc WHERE ((sc.id = support_messages.conversation_id) AND ((sc.provider_user_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))))))` |
| `support_messages_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM support_conversations sc WHERE ((sc.id = support_messages.conversation_id) AND ((sc.provider_user_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `support_messages_update_recipient` | UPDATE | authenticated | `(EXISTS ( SELECT 1 FROM support_conversations sc WHERE ((sc.id = support_messages.conversation_id) AND (((get_user_role() = 'admin'::user_role) AND (support_messages.sender_id = sc.provider_user_id)) OR ((sc.provider_user_id = auth.uid()) AND (support_messages.sender_id <> sc.provider_user_id))))))` | `(EXISTS ( SELECT 1 FROM support_conversations sc WHERE ((sc.id = support_messages.conversation_id) AND (((get_user_role() = 'admin'::user_role) AND (support_messages.sender_id = sc.provider_user_id)) OR ((sc.provider_user_id = auth.uid()) AND (support_messages.sender_id <> sc.provider_user_id))))))` |

## trip_cancellation_requests

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_cancellation_requests_insert_driver` | INSERT | authenticated | — | `((requested_by = auth.uid()) AND (status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (EXISTS ( SELECT 1 FROM ((trips t JOIN driver_profiles dp ON ((dp.id = t.driver_profile_id))) JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((t.id = trip_cancellation_requests.trip_id) AND (pp.user_id = auth.uid()) AND ((t.status)::text = ANY (ARRAY['scheduled'::text, 'started'::text]))))))` |
| `trip_cancellation_requests_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (requested_by = auth.uid()))` | — |
| `trip_cancellation_requests_update_admin` | UPDATE | authenticated | `(get_user_role() = 'admin'::user_role)` | `(get_user_role() = 'admin'::user_role)` |

## trip_children

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_children_delete` | DELETE | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_children.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `trip_children_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_children.trip_id) AND (t.client_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `trip_children_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_children.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = t.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `trip_children_update` | UPDATE | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_children.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |

## trip_luggage

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_luggage_delete` | DELETE | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_luggage.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `trip_luggage_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_luggage.trip_id) AND (t.client_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `trip_luggage_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_luggage.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((pp.user_id = auth.uid()) AND ((dp.id = t.driver_profile_id) OR (EXISTS ( SELECT 1 FROM trip_driver_candidates tdc WHERE ((tdc.trip_id = t.id) AND (tdc.driver_profile_id = dp.id)))))))) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `trip_luggage_update` | UPDATE | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_luggage.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |

## trip_passengers

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_passengers_delete` | DELETE | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_passengers.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `trip_passengers_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_passengers.trip_id) AND (t.client_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `trip_passengers_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_passengers.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((pp.user_id = auth.uid()) AND ((dp.id = t.driver_profile_id) OR (EXISTS ( SELECT 1 FROM trip_driver_candidates tdc WHERE ((tdc.trip_id = t.id) AND (tdc.driver_profile_id = dp.id)))))))) OR (get_user_role() = 'admin'::user_role)))))` | — |
| `trip_passengers_update` | UPDATE | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_passengers.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_passengers.trip_id) AND ((t.client_id = auth.uid()) OR (get_user_role() = 'admin'::user_role)))))` |

## trip_status_history

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_status_history_insert` | INSERT | authenticated | — | `true` |
| `trip_status_history_select` | SELECT | authenticated | `(EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_status_history.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = t.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role)))))` | — |

## trip_stops

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `trip_stops_insert` | INSERT | authenticated | — | `(get_user_role() = 'admin'::user_role)` |
| `trip_stops_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (EXISTS ( SELECT 1 FROM trips t WHERE ((t.id = trip_stops.trip_id) AND ((t.client_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = t.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM ((trip_driver_candidates tdc JOIN driver_profiles dp ON ((dp.id = tdc.driver_profile_id))) JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((tdc.trip_id = t.id) AND (pp.user_id = auth.uid())))))))))` | — |

## user_devices

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `user_devices_all` | ALL | authenticated | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

## user_saved_addresses

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `user_saved_addresses_delete` | DELETE | authenticated | `((get_user_role() = 'admin'::user_role) OR (user_id = auth.uid()))` | — |
| `user_saved_addresses_insert` | INSERT | authenticated | — | `((get_user_role() = 'admin'::user_role) OR (user_id = auth.uid()))` |
| `user_saved_addresses_select` | SELECT | authenticated | `((get_user_role() = 'admin'::user_role) OR (user_id = auth.uid()))` | — |
| `user_saved_addresses_update` | UPDATE | authenticated | `((get_user_role() = 'admin'::user_role) OR (user_id = auth.uid()))` | `((get_user_role() = 'admin'::user_role) OR (user_id = auth.uid()))` |

## vehicle_photos

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `vehicle_photos_delete` | DELETE | authenticated | `((EXISTS ( SELECT 1 FROM ((vehicles v JOIN driver_profiles dp ON ((dp.id = v.driver_profile_id))) JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((v.id = vehicle_photos.vehicle_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |
| `vehicle_photos_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM ((vehicles v JOIN driver_profiles dp ON ((dp.id = v.driver_profile_id))) JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((v.id = vehicle_photos.vehicle_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `vehicle_photos_insert_owner` | INSERT | public | — | `(EXISTS ( SELECT 1 FROM ((vehicles v JOIN driver_profiles dp ON ((dp.id = v.driver_profile_id))) JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((v.id = vehicle_photos.vehicle_id) AND (pp.user_id = auth.uid()))))` |
| `vehicle_photos_select` | SELECT | authenticated | `true` | — |
| `vehicle_photos_select_all` | SELECT | public | `true` | — |
| `vehicle_photos_update` | UPDATE | authenticated | `((EXISTS ( SELECT 1 FROM ((vehicles v JOIN driver_profiles dp ON ((dp.id = v.driver_profile_id))) JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((v.id = vehicle_photos.vehicle_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |

## vehicles

| Política | Comando | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `vehicles_delete` | DELETE | authenticated | `((EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = vehicles.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |
| `vehicles_insert` | INSERT | authenticated | — | `((EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = vehicles.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` |
| `vehicles_select` | SELECT | authenticated | `true` | — |
| `vehicles_update` | UPDATE | authenticated | `((EXISTS ( SELECT 1 FROM (driver_profiles dp JOIN provider_profiles pp ON ((pp.id = dp.provider_profile_id))) WHERE ((dp.id = vehicles.driver_profile_id) AND (pp.user_id = auth.uid())))) OR (get_user_role() = 'admin'::user_role))` | — |

## Tabelas sem políticas listadas

`spatial_ref_sys`
