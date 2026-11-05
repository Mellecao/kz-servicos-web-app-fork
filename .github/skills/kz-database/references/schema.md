# Esquema do banco (public)

> Gerado em 2026-11-05 a partir de dumps do banco real (projeto `mtsqeomctrqfyekyzapc`, schema `public`). Não editar à mão as tabelas: atualizar com a nova introspeção do banco, ou acrescentar a alteração da migration nova (ver regra no SKILL.md).

Tabelas: 39. Colunas 387. Relações com `auth.users` passam por `users(id)`.

## Enums

| Enum | Valores |
|---|---|
| `bank_account_type` | `checking`, `savings` |
| `luggage_size` | `small`, `medium`, `large`, `extra_large` |
| `message_type` | `text`, `image`, `audio`, `file`, `location` |
| `payment_method` | `pix`, `debit`, `credit`, `cash`, `billing` |
| `photo_type` | `front`, `back`, `interior`, `side_left`, `side_right` |
| `platform_type` | `android`, `ios`, `web` |
| `product_order_status` | `pending`, `confirmed`, `out_for_delivery`, `delivered`, `cancelled` |
| `provider_status` | `pending`, `approved`, `rejected`, `suspended` |
| `service_request_provider_candidate_status` | `pending`, `accepted`, `rejected` |
| `service_request_status` | `open`, `under_review`, `review_rejected`, `searching_provider`, `assigned`, `in_progress`, `finished`, `cancelled`, `awaiting_client_confirmation`, `awaiting_provider_confirmation` |
| `service_type_enum` | `trip`, `other_service` |
| `trip_execution_stage` | `to_pickup`, `to_stop`, `waiting_at_stop`, `to_destination`, `waiting_for_return`, `returning`, `finished` |
| `trip_status` | `open`, `under_review`, `review_rejected`, `searching_drivers`, `awaiting_client_confirmation`, `awaiting_driver_confirmation`, `scheduled`, `started`, `finished`, `cancelled` |
| `trip_status_candidate` | `pending`, `accepted`, `rejected` |
| `trip_type` | `standard`, `flash`, `scheduled_quote`, `scheduled_choose_driver` |
| `user_role` | `client`, `provider`, `admin` |
| `vehicle_category` | `simple`, `popular`, `luxury` |

## Tabelas do domínio

### users

Perfis (1:1 com auth.users). `role`: client | provider | admin. `cpf` é legado (rótulo "BI / NIF"); `phone` guarda-se em E.164.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | — | PK |
| `role` | user_role | não | `'client'::user_role` |  |
| `full_name` | varchar | não | — |  |
| `email` | varchar | não | — |  |
| `phone` | varchar | sim | — |  |
| `cpf` | varchar | sim | — |  |
| `avatar_url` | text | sim | — |  |
| `date_of_birth` | date | sim | — |  |
| `is_active` | boolean | sim | `true` |  |
| `auth_provider` | varchar | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `updated_at` | timestamptz | sim | `now()` |  |
| `deleted_at` | timestamptz | sim | — |  |
| `fcm_token` | text | sim | — |  |
| `fcm_token_updated_at` | timestamptz | sim | — |  |

- **PK** `users_pkey`: (id)
- **FK** `users_id_fkey`: (id) REFERENCES auth.users(id) ON DELETE CASCADE
- **UNIQUE** `users_cpf_key`: (cpf)
- **UNIQUE** `users_email_key`: (email)

### provider_profiles

Prestadores (inclui motoristas via driver_profiles). `status`: provider_status; `service_category_id` é a categoria principal.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `user_id` | uuid | não | — | → users(id) ON DELETE CASCADE |
| `service_category_id` | uuid | não | — | → service_categories(id) ON DELETE RESTRICT |
| `status` | provider_status | sim | `'pending'::provider_status` |  |
| `rg_document_url` | text | sim | — |  |
| `cnh_document_url` | text | sim | — |  |
| `proof_of_address_url` | text | sim | — |  |
| `has_card_machine` | boolean | sim | `false` |  |
| `has_tap_payment` | boolean | sim | `false` |  |
| `issues_invoice` | boolean | sim | `false` |  |
| `issues_receipt` | boolean | sim | `false` |  |
| `bank_name` | varchar | sim | — |  |
| `bank_agency` | varchar | sim | — |  |
| `bank_account` | varchar | sim | — |  |
| `bank_account_type` | bank_account_type | sim | — |  |
| `bank_pix_key` | varchar | sim | — |  |
| `average_rating` | numeric | sim | `0` |  |
| `total_ratings` | integer | sim | `0` |  |
| `bio` | text | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `updated_at` | timestamptz | sim | `now()` |  |
| `price_min` | numeric(12,2) | sim | — | Faixa de preço mostrada no cartão do mapa (Kz) |
| `price_max` | numeric(12,2) | sim | — | Faixa de preço mostrada no cartão do mapa (Kz) |
| `avg_response_minutes` | integer | sim | — | Tempo médio de resposta (minutos) |
| `is_demo` | boolean | não | `false` | Prestador fictício de demonstração: `search_service_providers` simula-lhe a posição |

- **PK** `provider_profiles_pkey`: (id)
- **FK** `provider_profiles_service_category_id_fkey`: (service_category_id) REFERENCES service_categories(id) ON DELETE RESTRICT
- **FK** `provider_profiles_user_id_fkey`: (user_id) REFERENCES users(id) ON DELETE CASCADE
- **UNIQUE** `provider_profiles_user_id_key`: (user_id)
- **CHECK** `provider_profiles_price_range_chk`: `price_min IS NULL OR price_max IS NULL OR price_min <= price_max`

Os prestadores `is_demo = true` (75, e-mails `demo.*@demo.so-servicos.test`) são figurantes: só a conta real `miguelm@prestador.com` responde a pedidos. Nunca os apagar; o painel marca-os com o selo «Demo».

### provider_category_services

Categorias extra que um prestador cobre (além da principal).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `provider_profile_id` | uuid | não | — | → provider_profiles(id) ON DELETE CASCADE |
| `service_category_id` | uuid | não | — | → service_categories(id) ON DELETE RESTRICT |
| `is_primary` | boolean | sim | `false` |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `provider_category_services_pkey`: (id)
- **FK** `provider_category_services_provider_profile_id_fkey`: (provider_profile_id) REFERENCES provider_profiles(id) ON DELETE CASCADE
- **FK** `provider_category_services_service_category_id_fkey`: (service_category_id) REFERENCES service_categories(id) ON DELETE RESTRICT
- **UNIQUE** `uq_provider_category`: (provider_profile_id, service_category_id)

### service_categories

Catálogo de categorias de serviço (slug estável, nome em pt-AO).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `name` | varchar | não | — |  |
| `slug` | varchar | não | — |  |
| `description` | text | sim | — |  |
| `service_type` | service_type_enum | não | — |  |
| `is_active` | boolean | sim | `true` |  |
| `icon_url` | text | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `service_categories_pkey`: (id)
- **UNIQUE** `service_categories_name_key`: (name)
- **UNIQUE** `service_categories_slug_key`: (slug)

### service_requests

Pedidos de serviço. Estados: enum `service_request_status`.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `client_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `provider_profile_id` | uuid | sim | — | → provider_profiles(id) ON DELETE SET NULL |
| `service_category_id` | uuid | sim | — | → service_categories(id) ON DELETE RESTRICT |
| `service_date` | timestamptz | não | — |  |
| `description` | text | não | — |  |
| `status` | service_request_status | sim | `'open'::service_request_status` |  |
| `address_id` | uuid | sim | — | → addresses(id) ON DELETE SET NULL |
| `estimated_price` | numeric | sim | — |  |
| `final_price` | numeric | sim | — |  |
| `is_paid` | boolean | sim | `false` |  |
| `payment_method` | payment_method | sim | — |  |
| `observations` | text | sim | — |  |
| `provider_observations` | text | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `updated_at` | timestamptz | sim | `now()` |  |
| `is_provider_paied` | boolean | sim | `false` |  |
| `freeform_profession` | text | sim | — |  |

- **PK** `service_requests_pkey`: (id)
- **FK** `service_requests_address_id_fkey`: (address_id) REFERENCES addresses(id) ON DELETE SET NULL
- **FK** `service_requests_client_id_fkey`: (client_id) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `service_requests_provider_profile_id_fkey`: (provider_profile_id) REFERENCES provider_profiles(id) ON DELETE SET NULL
- **FK** `service_requests_service_category_id_fkey`: (service_category_id) REFERENCES service_categories(id) ON DELETE RESTRICT

### service_request_provider_candidates

Convites do admin a prestadores para um pedido (UNIQUE pedido+prestador). Colunas de preço: `offered_price`, `kz_proposed_price`.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `service_request_id` | uuid | não | — | → service_requests(id) ON DELETE CASCADE |
| `provider_profile_id` | uuid | não | — | → provider_profiles(id) ON DELETE CASCADE |
| `status` | service_request_provider_candidate_status | não | `'pending'::service_request_provider_candidate_status` |  |
| `offered_price` | numeric | sim | — |  |
| `admin_approved` | boolean | não | `false` |  |
| `price_rejection_reason` | text | sim | — |  |
| `price_rejected_at` | timestamptz | sim | — |  |
| `kz_proposed_price` | numeric | sim | — |  |
| `kz_proposed_at` | timestamptz | sim | — |  |
| `kz_proposal_locked` | boolean | não | `false` |  |
| `invited_at` | timestamptz | não | `now()` |  |
| `responded_at` | timestamptz | sim | — |  |
| `observations` | text | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |
| `updated_at` | timestamptz | não | `now()` |  |

- **PK** `service_request_provider_candidates_pkey`: (id)
- **FK** `service_request_provider_candidates_provider_profile_id_fkey`: (provider_profile_id) REFERENCES provider_profiles(id) ON DELETE CASCADE
- **FK** `service_request_provider_candidates_service_request_id_fkey`: (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
- **UNIQUE** `service_request_provider_cand_service_request_id_provider_p_key`: (service_request_id, provider_profile_id)

### service_request_status_history

Histórico de estados do pedido (trigger); `observations` guarda o motivo da rejeição.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `service_request_id` | uuid | não | — | → service_requests(id) ON DELETE CASCADE |
| `from_status` | varchar | sim | — |  |
| `to_status` | varchar | não | — |  |
| `changed_by` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `observations` | text | sim | — |  |
| `metadata` | jsonb | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `service_request_status_history_pkey`: (id)
- **FK** `service_request_status_history_changed_by_fkey`: (changed_by) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `service_request_status_history_service_request_id_fkey`: (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE

### trips

Viagens. `trip_type`: standard | flash | scheduled_quote | scheduled_choose_driver. Estados: enum `trip_status`.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `client_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `driver_profile_id` | uuid | sim | — | → driver_profiles(id) ON DELETE SET NULL |
| `vehicle_id` | uuid | sim | — | → vehicles(id) ON DELETE SET NULL |
| `service_category_id` | uuid | não | — | → service_categories(id) ON DELETE RESTRICT |
| `pickup_address_id` | uuid | não | — | → addresses(id) ON DELETE RESTRICT |
| `dropoff_address_id` | uuid | não | — | → addresses(id) ON DELETE RESTRICT |
| `scheduled_datetime` | timestamptz | não | — |  |
| `is_round_trip` | boolean | sim | `false` |  |
| `return_datetime` | timestamptz | sim | — |  |
| `passenger_count` | integer | não | — |  |
| `children_count` | integer | sim | `0` |  |
| `observations` | text | sim | — |  |
| `driver_observations` | text | sim | — |  |
| `luggage_count` | integer | sim | `0` |  |
| `status` | trip_status | sim | `'open'::trip_status` |  |
| `estimated_price` | numeric | sim | — |  |
| `final_price` | numeric | sim | — |  |
| `is_paid` | boolean | sim | `false` |  |
| `payment_method` | payment_method | sim | — |  |
| `payment_date` | timestamptz | sim | — |  |
| `started_at` | timestamptz | sim | — |  |
| `finished_at` | timestamptz | sim | — |  |
| `cancelled_at` | timestamptz | sim | — |  |
| `cancellation_reason` | text | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `updated_at` | timestamptz | sim | `now()` |  |
| `is_driver_paied` | boolean | sim | `false` |  |
| `driver_arrived_at` | timestamptz | sim | — |  |
| `execution_stage` | trip_execution_stage | sim | — |  |
| `current_stop_order` | integer | sim | — |  |
| `return_started_at` | timestamptz | sim | — |  |
| `return_arrived_at` | timestamptz | sim | — |  |
| `trip_type` | trip_type | não | `'standard'::trip_type` |  |
| `return_pickup_address_id` | uuid | sim | — | → addresses(id) ON DELETE RESTRICT |
| `return_dropoff_address_id` | uuid | sim | — | → addresses(id) ON DELETE RESTRICT |

- **PK** `trips_pkey`: (id)
- **FK** `trips_client_id_fkey`: (client_id) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `trips_driver_profile_id_fkey`: (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE SET NULL
- **FK** `trips_dropoff_address_id_fkey`: (dropoff_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
- **FK** `trips_pickup_address_id_fkey`: (pickup_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
- **FK** `trips_return_dropoff_address_id_fkey`: (return_dropoff_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
- **FK** `trips_return_pickup_address_id_fkey`: (return_pickup_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
- **FK** `trips_service_category_id_fkey`: (service_category_id) REFERENCES service_categories(id) ON DELETE RESTRICT
- **FK** `trips_vehicle_id_fkey`: (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
- **CHECK** `trips_flash_no_scheduling`: (((trip_type = 'standard'::trip_type) OR ((is_round_trip = false) AND (return_datetime IS NULL))))

### trip_driver_candidates

Candidatos/propostas de motoristas a uma viagem (ou a um pedido de serviço, ver CHECK).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `driver_profile_id` | uuid | não | — | → driver_profiles(id) ON DELETE CASCADE |
| `status` | trip_status_candidate | não | `'pending'::trip_status_candidate` |  |
| `invited_at` | timestamptz | sim | `now()` |  |
| `responded_at` | timestamptz | sim | — |  |
| `observations` | text | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `offered_price` | numeric | sim | — |  |
| `admin_approved` | boolean | não | `false` |  |
| `price_rejection_reason` | text | sim | — |  |
| `price_rejected_at` | timestamptz | sim | — |  |
| `kz_proposed_price` | numeric | sim | — |  |
| `kz_proposed_at` | timestamptz | sim | — |  |
| `kz_proposal_locked` | boolean | não | `false` |  |
| `last_push_at` | timestamptz | sim | — |  |

- **PK** `trip_driver_candidates_pkey`: (id)
- **FK** `trip_driver_candidates_driver_profile_id_fkey`: (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE CASCADE
- **FK** `trip_driver_candidates_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE
- **UNIQUE** `trip_driver_candidates_trip_id_driver_profile_id_key`: (trip_id, driver_profile_id)

### products

Catálogo de produtos (não se elimina: `is_active`).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `slug` | text | não | — |  |
| `name` | text | não | — |  |
| `description` | text | sim | — |  |
| `unit_label` | text | não | `'unidade'::text` |  |
| `price` | numeric | não | — |  |
| `image_url` | text | sim | — |  |
| `is_active` | boolean | não | `true` |  |
| `sort_order` | integer | não | `0` |  |
| `created_at` | timestamptz | não | `now()` |  |
| `updated_at` | timestamptz | não | `now()` |  |

- **PK** `products_pkey`: (id)
- **UNIQUE** `products_slug_key`: (slug)
- **CHECK** `products_price_check`: ((price >= (0)::numeric))

### product_orders

Pedidos de produtos. Estados: enum `product_order_status`. Criados só pela RPC `create_product_order`.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `client_id` | uuid | não | — | → users(id) |
| `status` | product_order_status | não | `'pending'::product_order_status` |  |
| `delivery_address` | text | não | — |  |
| `delivery_reference` | text | sim | — |  |
| `delivery_lat` | float8 | sim | — |  |
| `delivery_lng` | float8 | sim | — |  |
| `contact_phone` | text | sim | — |  |
| `notes` | text | sim | — |  |
| `payment_method` | payment_method | não | `'cash'::payment_method` |  |
| `subtotal` | numeric | não | `0` |  |
| `delivery_fee` | numeric | não | `0` |  |
| `total` | numeric | não | `0` |  |
| `cancel_reason` | text | sim | — |  |
| `confirmed_at` | timestamptz | sim | — |  |
| `delivered_at` | timestamptz | sim | — |  |
| `cancelled_at` | timestamptz | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |
| `updated_at` | timestamptz | não | `now()` |  |

- **PK** `product_orders_pkey`: (id)
- **FK** `product_orders_client_id_fkey`: (client_id) REFERENCES users(id)

### product_order_items

Linhas de um pedido de produtos (preços copiados do catálogo no servidor).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `order_id` | uuid | não | — | → product_orders(id) ON DELETE CASCADE |
| `product_id` | uuid | não | — | → products(id) |
| `product_name` | text | não | — |  |
| `unit_price` | numeric | não | — |  |
| `quantity` | integer | não | — |  |
| `line_total` | numeric | sim | — |  |

- **PK** `product_order_items_pkey`: (id)
- **FK** `product_order_items_order_id_fkey`: (order_id) REFERENCES product_orders(id) ON DELETE CASCADE
- **FK** `product_order_items_product_id_fkey`: (product_id) REFERENCES products(id)
- **CHECK** `product_order_items_quantity_check`: (((quantity > 0) AND (quantity <= 99)))
- **CHECK** `product_order_items_unit_price_check`: ((unit_price >= (0)::numeric))

### notifications

Notificações in-app (e base do push).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `user_id` | uuid | não | — | → users(id) ON DELETE CASCADE |
| `title` | varchar | não | — |  |
| `body` | text | não | — |  |
| `type` | varchar | não | — |  |
| `reference_type` | varchar | sim | — |  |
| `reference_id` | uuid | sim | — |  |
| `link` | text | sim | — |  |
| `is_read` | boolean | sim | `false` |  |
| `read_at` | timestamptz | sim | — |  |
| `is_pushed` | boolean | sim | `false` |  |
| `pushed_at` | timestamptz | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `notifications_pkey`: (id)
- **FK** `notifications_user_id_fkey`: (user_id) REFERENCES users(id) ON DELETE CASCADE

### system_settings

Definições chave/valor (`value` jsonb), p.ex. `product_delivery_fee`. `trips_enabled` (jsonb boolean, hoje `false`) é o interruptor das caronas: com `false` o app Cliente abre em «Buscar prestadores» e o painel esconde Viagens, Mapa e Motoristas (nada é apagado). Qualquer utilizador autenticado lê só essa chave; só o admin escreve.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `key` | varchar | não | — |  |
| `value` | jsonb | não | — |  |
| `description` | text | sim | — |  |
| `updated_by` | uuid | sim | — | → users(id) ON DELETE SET NULL |
| `updated_at` | timestamptz | sim | `now()` |  |

- **PK** `system_settings_pkey`: (id)
- **FK** `system_settings_updated_by_fkey`: (updated_by) REFERENCES users(id) ON DELETE SET NULL
- **UNIQUE** `system_settings_key_key`: (key)

### driver_regions

Regiões de atuação de motoristas (8 regiões de Luanda + legadas).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `name` | text | não | — |  |
| `normalized_name` | text | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `driver_regions_pkey`: (id)
- **UNIQUE** `driver_regions_normalized_name_key`: (normalized_name)
- **CHECK** `driver_regions_name_check`: (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 120)))

### chat_rooms

Salas de chat (cliente ↔ prestador/motorista).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | sim | — | → trips(id) ON DELETE SET NULL |
| `service_request_id` | uuid | sim | — | → service_requests(id) ON DELETE SET NULL |
| `client_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `provider_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `is_active` | boolean | sim | `true` |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `chat_rooms_pkey`: (id)
- **FK** `chat_rooms_client_id_fkey`: (client_id) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `chat_rooms_provider_id_fkey`: (provider_id) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `chat_rooms_service_request_id_fkey`: (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL
- **FK** `chat_rooms_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE SET NULL
- **CHECK** `chk_chat_room_reference`: ((((trip_id IS NOT NULL) AND (service_request_id IS NULL)) OR ((trip_id IS NULL) AND (service_request_id IS NOT NULL))))

### chat_messages

Mensagens do chat.

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `chat_room_id` | uuid | não | — | → chat_rooms(id) ON DELETE CASCADE |
| `sender_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `message` | text | não | — |  |
| `message_type` | message_type | sim | `'text'::message_type` |  |
| `attachment_url` | text | sim | — |  |
| `is_read` | boolean | sim | `false` |  |
| `read_at` | timestamptz | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `chat_messages_pkey`: (id)
- **FK** `chat_messages_chat_room_id_fkey`: (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
- **FK** `chat_messages_sender_id_fkey`: (sender_id) REFERENCES users(id) ON DELETE RESTRICT

## Outras tabelas

### addresses

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `google_place_id` | varchar | sim | — |  |
| `formatted_address` | text | não | — |  |
| `street` | varchar | sim | — |  |
| `number` | varchar | sim | — |  |
| `complement` | varchar | sim | — |  |
| `neighborhood` | varchar | sim | — |  |
| `city` | varchar | sim | — |  |
| `state` | varchar | sim | — |  |
| `zip_code` | varchar | sim | — |  |
| `latitude` | numeric | sim | — |  |
| `longitude` | numeric | sim | — |  |
| `location` | geography | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `addresses_pkey`: (id)

### admin_logs

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `admin_id` | uuid | não | `auth.uid()` | → users(id) |
| `action` | text | não | — |  |
| `entity_type` | text | não | `'trip'::text` |  |
| `entity_id` | uuid | sim | — |  |
| `details` | jsonb | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `admin_logs_pkey`: (id)
- **FK** `admin_logs_admin_id_fkey`: (admin_id) REFERENCES users(id)

### driver_locations

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `driver_profile_id` | uuid | não | — | → driver_profiles(id) ON DELETE CASCADE |
| `trip_id` | uuid | sim | — | → trips(id) ON DELETE SET NULL |
| `latitude` | numeric | não | — |  |
| `longitude` | numeric | não | — |  |
| `location` | geography | sim | — |  |
| `heading` | numeric | sim | — |  |
| `speed` | numeric | sim | — |  |
| `updated_at` | timestamptz | sim | `now()` |  |

- **PK** `driver_locations_pkey`: (id)
- **FK** `driver_locations_driver_profile_id_fkey`: (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE CASCADE
- **FK** `driver_locations_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE SET NULL
- **UNIQUE** `driver_locations_driver_profile_id_key`: (driver_profile_id)

### driver_profile_photos

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `driver_profile_id` | uuid | não | — | → driver_profiles(id) ON DELETE CASCADE |
| `photo_url` | text | não | — |  |
| `sort_order` | integer | não | `0` |  |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `driver_profile_photos_pkey`: (id)
- **FK** `driver_profile_photos_driver_profile_id_fkey`: (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE CASCADE

### driver_profile_regions

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `driver_profile_id` | uuid | não | — | → driver_profiles(id) ON DELETE CASCADE |
| `region_id` | uuid | não | — | → driver_regions(id) ON DELETE CASCADE |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `driver_profile_regions_pkey`: (driver_profile_id, region_id)
- **FK** `driver_profile_regions_driver_profile_id_fkey`: (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE CASCADE
- **FK** `driver_profile_regions_region_id_fkey`: (region_id) REFERENCES driver_regions(id) ON DELETE CASCADE

### driver_profiles

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `provider_profile_id` | uuid | não | — | → provider_profiles(id) ON DELETE CASCADE |
| `cnh_category` | varchar | sim | — |  |
| `cnh_expiration_date` | date | sim | — |  |
| `cnh_number` | varchar | sim | — |  |
| `is_available` | boolean | sim | `false` |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `updated_at` | timestamptz | sim | `now()` |  |
| `fcm_token` | text | sim | — |  |
| `fcm_token_updated_at` | timestamptz | sim | — |  |

- **PK** `driver_profiles_pkey`: (id)
- **FK** `driver_profiles_provider_profile_id_fkey`: (provider_profile_id) REFERENCES provider_profiles(id) ON DELETE CASCADE
- **UNIQUE** `driver_profiles_cnh_number_key`: (cnh_number)
- **UNIQUE** `driver_profiles_provider_profile_id_key`: (provider_profile_id)

### private_comments

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `author_id` | uuid | não | — | → users(id) ON DELETE CASCADE |
| `reference_type` | varchar | não | — |  |
| `reference_id` | uuid | sim | — |  |
| `comment` | text | não | — |  |
| `admin_response` | text | sim | — |  |
| `responded_by` | uuid | sim | — | → users(id) ON DELETE SET NULL |
| `responded_at` | timestamptz | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `private_comments_pkey`: (id)
- **FK** `private_comments_author_id_fkey`: (author_id) REFERENCES users(id) ON DELETE CASCADE
- **FK** `private_comments_responded_by_fkey`: (responded_by) REFERENCES users(id) ON DELETE SET NULL

### ratings

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | sim | — | → trips(id) ON DELETE SET NULL |
| `service_request_id` | uuid | sim | — | → service_requests(id) ON DELETE SET NULL |
| `rater_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `rated_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `rating` | numeric | não | — |  |
| `comment` | text | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `ratings_pkey`: (id)
- **FK** `ratings_rated_id_fkey`: (rated_id) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `ratings_rater_id_fkey`: (rater_id) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `ratings_service_request_id_fkey`: (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL
- **FK** `ratings_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE SET NULL
- **CHECK** `chk_rating_reference`: ((((trip_id IS NOT NULL) AND (service_request_id IS NULL)) OR ((trip_id IS NULL) AND (service_request_id IS NOT NULL))))
- **CHECK** `ratings_rating_check`: (((rating >= (1)::numeric) AND (rating <= (5)::numeric)))

### service_request_photos

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `service_request_id` | uuid | não | — | → service_requests(id) ON DELETE CASCADE |
| `photo_url` | text | não | — |  |
| `sort_order` | integer | não | `0` |  |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `service_request_photos_pkey`: (id)
- **FK** `service_request_photos_service_request_id_fkey`: (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
- **CHECK** `service_request_photos_sort_order_check`: ((sort_order >= 0))

### spatial_ref_sys

Tabela de sistema da extensão PostGIS (não usar).

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `srid` | integer | não | — | PK |
| `auth_name` | varchar | sim | — |  |
| `auth_srid` | integer | sim | — |  |
| `srtext` | varchar | sim | — |  |
| `proj4text` | varchar | sim | — |  |

- **PK** `spatial_ref_sys_pkey`: (srid)
- **CHECK** `spatial_ref_sys_srid_check`: (((srid > 0) AND (srid <= 998999)))

### support_conversations

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `provider_user_id` | uuid | não | — | → users(id) ON DELETE CASCADE |
| `last_message_at` | timestamptz | sim | — |  |
| `last_message_preview` | text | sim | — |  |
| `last_sender_id` | uuid | sim | — | → users(id) ON DELETE SET NULL |
| `unread_admin_count` | integer | não | `0` |  |
| `unread_provider_count` | integer | não | `0` |  |
| `created_at` | timestamptz | não | `now()` |  |
| `updated_at` | timestamptz | não | `now()` |  |

- **PK** `support_conversations_pkey`: (id)
- **FK** `support_conversations_last_sender_id_fkey`: (last_sender_id) REFERENCES users(id) ON DELETE SET NULL
- **FK** `support_conversations_provider_user_id_fkey`: (provider_user_id) REFERENCES users(id) ON DELETE CASCADE
- **UNIQUE** `support_conversations_provider_user_id_key`: (provider_user_id)
- **CHECK** `support_conversations_preview_length`: (((last_message_preview IS NULL) OR (char_length(last_message_preview) <= 240)))
- **CHECK** `support_conversations_unread_admin_count_check`: ((unread_admin_count >= 0))
- **CHECK** `support_conversations_unread_provider_count_check`: ((unread_provider_count >= 0))

### support_messages

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `conversation_id` | uuid | não | — | → support_conversations(id) ON DELETE CASCADE |
| `sender_id` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `message` | text | não | — |  |
| `is_read` | boolean | não | `false` |  |
| `read_at` | timestamptz | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `support_messages_pkey`: (id)
- **FK** `support_messages_conversation_id_fkey`: (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE
- **FK** `support_messages_sender_id_fkey`: (sender_id) REFERENCES users(id) ON DELETE RESTRICT
- **CHECK** `support_messages_message_check`: (((char_length(btrim(message)) >= 1) AND (char_length(btrim(message)) <= 4000)))
- **CHECK** `support_messages_read_state`: ((((is_read = false) AND (read_at IS NULL)) OR ((is_read = true) AND (read_at IS NOT NULL))))

### trip_cancellation_requests

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `requested_by` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `reason` | text | não | — |  |
| `status` | text | não | `'pending'::text` |  |
| `reviewed_by` | uuid | sim | — | → users(id) ON DELETE SET NULL |
| `reviewed_at` | timestamptz | sim | — |  |
| `review_reason` | text | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |
| `updated_at` | timestamptz | não | `now()` |  |

- **PK** `trip_cancellation_requests_pkey`: (id)
- **FK** `trip_cancellation_requests_requested_by_fkey`: (requested_by) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `trip_cancellation_requests_reviewed_by_fkey`: (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
- **FK** `trip_cancellation_requests_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE
- **CHECK** `trip_cancellation_requests_reason_check`: ((char_length(btrim(reason)) >= 10))
- **CHECK** `trip_cancellation_requests_review_reason_check`: (((status <> 'rejected'::text) OR (char_length(btrim(COALESCE(review_reason, ''::text))) >= 3)))
- **CHECK** `trip_cancellation_requests_review_state_check`: ((((status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_reason IS NULL)) OR ((status = 'approved'::text) AND (reviewed_at IS NOT NULL) AND (review_reason IS NULL)) OR ((status = 'rejected'::text) AND (reviewed_at IS NOT NULL))))
- **CHECK** `trip_cancellation_requests_status_check`: ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))

### trip_children

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `age` | integer | não | — |  |
| `needs_car_seat` | boolean | sim | `false` |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `trip_children_pkey`: (id)
- **FK** `trip_children_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE

### trip_luggage

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `size` | luggage_size | não | — |  |
| `quantity` | integer | sim | `1` |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `type` | text | não | `'unspecified'::text` |  |
| `weight_kg` | numeric | sim | — |  |
| `sort_order` | integer | não | `0` |  |

- **PK** `trip_luggage_pkey`: (id)
- **FK** `trip_luggage_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE
- **CHECK** `trip_luggage_quantity_positive`: ((quantity > 0))
- **CHECK** `trip_luggage_sort_order_nonnegative`: ((sort_order >= 0))
- **CHECK** `trip_luggage_type_not_blank`: ((length(btrim(type)) > 0))
- **CHECK** `trip_luggage_weight_kg_positive`: (((weight_kg IS NULL) OR (weight_kg > (0)::numeric)))

### trip_passengers

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `name` | text | não | — |  |
| `age` | integer | não | — |  |
| `needs_car_seat` | boolean | sim | — |  |
| `sort_order` | integer | não | `0` |  |
| `created_at` | timestamptz | não | `now()` |  |

- **PK** `trip_passengers_pkey`: (id)
- **FK** `trip_passengers_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE
- **UNIQUE** `trip_passengers_trip_id_sort_order_key`: (trip_id, sort_order)
- **CHECK** `trip_passengers_age_check`: (((age >= 0) AND (age <= 120)))
- **CHECK** `trip_passengers_name_check`: ((length(btrim(name)) > 0))
- **CHECK** `trip_passengers_sort_order_check`: ((sort_order >= 0))

### trip_status_history

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `from_status` | varchar | sim | — |  |
| `to_status` | varchar | não | — |  |
| `changed_by` | uuid | não | — | → users(id) ON DELETE RESTRICT |
| `observations` | text | sim | — |  |
| `metadata` | jsonb | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `trip_status_history_pkey`: (id)
- **FK** `trip_status_history_changed_by_fkey`: (changed_by) REFERENCES users(id) ON DELETE RESTRICT
- **FK** `trip_status_history_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE

### trip_stops

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `trip_id` | uuid | não | — | → trips(id) ON DELETE CASCADE |
| `address_id` | uuid | não | — | → addresses(id) ON DELETE RESTRICT |
| `stop_order` | integer | não | — |  |
| `created_at` | timestamptz | não | `now()` |  |
| `arrived_at` | timestamptz | sim | — |  |
| `resumed_at` | timestamptz | sim | — |  |

- **PK** `trip_stops_pkey`: (id)
- **FK** `trip_stops_address_id_fkey`: (address_id) REFERENCES addresses(id) ON DELETE RESTRICT
- **FK** `trip_stops_trip_id_fkey`: (trip_id) REFERENCES trips(id) ON DELETE CASCADE
- **UNIQUE** `trip_stops_trip_id_stop_order_key`: (trip_id, stop_order)
- **CHECK** `trip_stops_stop_order_check`: ((stop_order >= 1))

### user_devices

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `user_id` | uuid | não | — | → users(id) ON DELETE CASCADE |
| `device_token` | text | não | — |  |
| `platform` | platform_type | não | — |  |
| `is_active` | boolean | sim | `true` |  |
| `last_used_at` | timestamptz | sim | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `user_devices_pkey`: (id)
- **FK** `user_devices_user_id_fkey`: (user_id) REFERENCES users(id) ON DELETE CASCADE
- **UNIQUE** `uq_user_device_token`: (user_id, device_token)

### user_saved_addresses

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `user_id` | uuid | não | — | → users(id) ON DELETE CASCADE |
| `address_id` | uuid | não | — | → addresses(id) ON DELETE RESTRICT |
| `label` | text | não | — |  |
| `custom_label` | text | sim | — |  |
| `created_at` | timestamptz | não | `now()` |  |
| `updated_at` | timestamptz | não | `now()` |  |

- **PK** `user_saved_addresses_pkey`: (id)
- **FK** `user_saved_addresses_address_id_fkey`: (address_id) REFERENCES addresses(id) ON DELETE RESTRICT
- **FK** `user_saved_addresses_user_id_fkey`: (user_id) REFERENCES users(id) ON DELETE CASCADE
- **CHECK** `user_saved_addresses_label_check`: ((label = ANY (ARRAY['home'::text, 'work'::text, 'custom'::text])))

### vehicle_photos

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `vehicle_id` | uuid | não | — | → vehicles(id) ON DELETE CASCADE |
| `photo_url` | text | não | — |  |
| `photo_type` | photo_type | não | — |  |
| `created_at` | timestamptz | sim | `now()` |  |

- **PK** `vehicle_photos_pkey`: (id)
- **FK** `vehicle_photos_vehicle_id_fkey`: (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE

### vehicles

| Coluna | Tipo | Nulo | Default | Chave / Ref |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `driver_profile_id` | uuid | não | — | → driver_profiles(id) ON DELETE CASCADE |
| `brand` | varchar | não | — |  |
| `model` | varchar | não | — |  |
| `year` | integer | não | — |  |
| `color` | varchar | não | — |  |
| `license_plate` | varchar | não | — |  |
| `vehicle_document_url` | text | não | — |  |
| `passenger_capacity` | integer | sim | `4` |  |
| `is_active` | boolean | sim | `true` |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `updated_at` | timestamptz | sim | `now()` |  |
| `category` | vehicle_category | sim | — |  |

- **PK** `vehicles_pkey`: (id)
- **FK** `vehicles_driver_profile_id_fkey`: (driver_profile_id) REFERENCES driver_profiles(id) ON DELETE CASCADE
- **UNIQUE** `vehicles_license_plate_key`: (license_plate)

## Realtime (publicação `supabase_realtime`)

- `chat_messages`
- `driver_locations`
- `notifications`
- `product_orders`
- `service_request_provider_candidates`
- `service_requests`
- `support_conversations`
- `support_messages`
- `trip_cancellation_requests`
- `trip_driver_candidates`
- `trips`
