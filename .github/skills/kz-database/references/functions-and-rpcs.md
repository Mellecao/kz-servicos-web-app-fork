# Funções e RPCs

> Gerado em 2026-11-05 a partir de dumps do banco real (projeto `mtsqeomctrqfyekyzapc`, schema `public`). Não editar à mão as tabelas: atualizar com a nova introspeção do banco, ou acrescentar a alteração da migration nova (ver regra no SKILL.md).

Só funções da aplicação (as 756 de extensões PostGIS e pg_trgm ficam de fora). Os dumps só têm assinaturas, sem corpo: ver `supabase/migrations/`. `SECURITY DEFINER` = corre com os direitos do dono (ignora a RLS), por isso valida o papel lá dentro.

## RPCs (chamáveis com `supabase.rpc(nome, { parâmetros })`)

| Função | Parâmetros | Devolve | Security definer | Descrição |
|---|---|---|---|---|
| `add_all_approved_trip_candidates` | `p_trip_id uuid` | `integer` | sim |  |
| `advance_trip_execution` | `p_trip_id uuid` | `trip_execution_stage` | sim |  |
| `cancel_flash_trip` | `p_trip_id uuid, p_reason text` | `void` | sim |  |
| `cancel_product_order` | `p_order_id uuid, p_reason text` | `void` | sim | Cliente cancela o seu pedido (só em `pending`) com motivo. |
| `cancel_scheduled_choose_driver_trip` | `p_trip_id uuid, p_reason text` | `void` | sim |  |
| `client_accept_flash_proposal` | `p_candidate_id uuid` | `void` | sim |  |
| `client_accept_scheduled_price` | `trip_id_input uuid` | `void` | sim |  |
| `client_reject_scheduled_price` | `trip_id_input uuid` | `void` | sim |  |
| `client_send_scheduled_direct_request` | `driver_profile_id_input uuid, pickup_address_id_input uuid, dropoff_address_id_input uuid, service_category_id_input uuid, passenger_count_input integer, observation_input text, scheduled_datetime_input timestamp with time zone, is_round_trip_input boolean, return_datetime_input timestamp with time zone, return_pickup_address_id_input uuid, return_dropoff_address_id_input uuid` | `uuid` | sim |  |
| `create_flash_trip` | `p_pickup_address_id uuid, p_dropoff_address_id uuid, p_service_category_id uuid, p_passenger_count integer, p_children_count integer, p_luggage_count integer, p_observations text` | `uuid` | sim |  |
| `create_product_order` | `p_items jsonb, p_delivery_address text, p_delivery_reference text, p_delivery_lat double precision, p_delivery_lng double precision, p_contact_phone text, p_notes text, p_payment_method payment_method` | `uuid` | sim | Cliente cria um pedido de produtos: valida itens, calcula preços e totais no servidor e devolve o `uuid` do pedido. `p_items = [{"product_id":"<uuid>","quantity":2}]`. |
| `driver_accept_scheduled_direct` | `trip_id_input uuid, offered_price_input numeric` | `void` | sim |  |
| `driver_flash_recheck_confirm` | `p_trip_id uuid` | `void` | sim |  |
| `driver_flash_recheck_reject` | `p_trip_id uuid` | `void` | sim |  |
| `driver_reject_scheduled_direct` | `trip_id_input uuid` | `void` | sim |  |
| `driver_send_flash_proposal` | `p_trip_id uuid, p_price numeric` | `void` | sim |  |
| `get_user_role` | — | `user_role` | sim | Papel do utilizador autenticado (`client`/`provider`/`admin`); base das políticas RLS. |
| `insert_trip_stop_address` | `p_trip_id uuid, p_stop_order integer, p_address jsonb` | `uuid` | sim |  |
| `is_service_request_provider_candidate_for_current_user` | `p_service_request_id uuid` | `boolean` | sim |  |
| `is_trip_candidate_for_current_user` | `p_trip_id uuid` | `boolean` | sim |  |
| `nearby_trip_drivers` | `p_trip_id uuid, p_radius_meters integer` | `TABLE(driver_profile_id uuid, distance_meters double precision, vehicle_category vehicle_category, regions text[])` | sim |  |
| `notify_admins_for_trip_action` | `p_type text, p_title text, p_body text, p_trip_id uuid` | `void` | sim |  |
| `redispatch_flash_trip` | `p_trip_id uuid` | `integer` | sim |  |
| `reject_flash_call` | `p_trip_id uuid` | `void` | sim |  |
| `reject_service_request` | `p_service_request_id uuid, p_reason text` | `void` | sim | Admin rejeita um pedido em `under_review` (→ `review_rejected`); o motivo vai para `service_request_status_history.observations`. Só admin. |
| `reject_trip` | `p_trip_id uuid, p_reason text` | `void` | não | Admin recusa uma viagem em análise, com motivo opcional. |
| `rollback_failed_trip_creation` | `p_trip_id uuid` | `void` | sim |  |
| `select_service_request_provider` | `p_service_request_id uuid, p_provider_profile_id uuid, p_offered_price numeric` | `void` | sim | Admin escolhe o prestador: o pedido (em `searching_provider`) passa a `awaiting_client_confirmation` com `final_price = p_offered_price`; o candidato fica `accepted` e os outros `rejected`. |
| `select_trip_driver` | `p_trip_id uuid, p_candidate_id uuid, p_driver_profile_id uuid, p_offered_price numeric` | `void` | sim |  |
| `set_scheduled_quote_override` | `new_value text` | `void` | sim |  |

## Funções de trigger

| Função | Security definer | Usada em | Descrição |
|---|---|---|---|
| `apply_trip_cancellation_request_review` | sim | `trip_cancellation_requests` |  |
| `guard_service_candidate_provider_columns` | não | `service_request_provider_candidates` |  |
| `handle_new_user` | sim | — | Trigger em `auth.users`: cria a linha em `public.users` (sempre `client`; promover por UPDATE). |
| `log_service_request_status_change` | sim | `service_requests` | Grava uma linha em `service_request_status_history` a cada mudança de estado do pedido. |
| `log_trip_status_change` | sim | `trips` |  |
| `notify_admins_on_trip_cancellation_request` | sim | `trip_cancellation_requests` |  |
| `notify_support_message_recipient` | sim | `support_messages` |  |
| `product_orders_on_status_change` | sim | `product_orders` | Preenche `confirmed_at`/`delivered_at`/`cancelled_at` e notifica o cliente ao mudar o estado de um pedido de produtos. |
| `push_driver_trip_cancellation_rejection` | sim | `trip_cancellation_requests` |  |
| `recalculate_provider_rating` | sim | `ratings` |  |
| `reject_service_request_candidates_when_cancelled` | sim | `service_requests` | Ao cancelar o pedido, marca os candidatos `pending`/`accepted` como `rejected`. |
| `reject_trip_candidates_when_cancelled` | sim | `trips` |  |
| `require_driver_recheck_before_scheduled` | não | `trips` |  |
| `require_service_request_provider_recheck_before_assigned` | não | `service_requests` | Ao passar para `assigned` (a partir de `searching_provider`/`awaiting_client_confirmation`) com prestador definido, o estado fica `awaiting_provider_confirmation`. |
| `resolve_pending_request_on_trip_cancelled` | sim | `trips` |  |
| `set_address_location` | não | `addresses` |  |
| `set_driver_location` | não | `driver_locations` |  |
| `sync_support_conversation_on_message` | sim | `support_messages` |  |
| `sync_support_conversation_on_read` | sim | `support_messages` |  |
| `trigger_admin_notification_on_candidate_update` | sim | `trip_driver_candidates` |  |
| `trigger_admin_notification_on_trip_insert` | sim | `trips` |  |
| `trigger_admin_notification_on_trip_status` | sim | `trips` |  |
| `trigger_push_admin_notification_onesignal` | sim | `notifications` |  |
| `trigger_push_on_candidate_insert` | sim | `trip_driver_candidates` |  |
| `trigger_push_on_chat_message_insert` | sim | `chat_messages` |  |
| `trigger_push_on_service_request_status_change` | sim | `service_requests` |  |
| `trigger_push_on_trip_status_change` | sim | `trips` |  |
| `update_updated_at_column` | não | `driver_locations`, `driver_profiles`, `product_orders`, `products`, `provider_profiles`, `service_request_provider_candidates`, `service_requests`, `support_conversations`, `trip_cancellation_requests`, `trips`, `user_saved_addresses`, `users`, `vehicles` | Mantém `updated_at` em dia (BEFORE UPDATE). |
| `validate_support_message_read_update` | não | `support_messages` |  |
| `validate_trip_cancellation_request_review` | não | `trip_cancellation_requests` |  |
