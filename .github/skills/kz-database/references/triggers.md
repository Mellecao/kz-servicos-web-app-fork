# Triggers

> Gerado em 2026-11-05 a partir de dumps do banco real (projeto `mtsqeomctrqfyekyzapc`, schema `public`). Não editar à mão as tabelas: atualizar com a nova introspeção do banco, ou acrescentar a alteração da migration nova (ver regra no SKILL.md).

Total: 41. Os corpos das funções não estão nos dumps: ver `supabase/migrations/`. Detalhes de funções em functions-and-rpcs.md.

## users

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_users_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## provider_profiles

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_provider_profiles_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## service_requests

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_log_service_request_status_change` | AFTER | UPDATE OF status | ROW | — | `log_service_request_status_change` |
| `trg_push_on_service_request_status_change` | AFTER | UPDATE OF status | ROW | — | `trigger_push_on_service_request_status_change` |
| `trg_reject_service_request_candidates_when_cancelled` | AFTER | UPDATE OF status | ROW | — | `reject_service_request_candidates_when_cancelled` |
| `trg_require_service_request_provider_recheck_before_assigned` | BEFORE | UPDATE OF status, provider_profile_id | ROW | — | `require_service_request_provider_recheck_before_assigned` |
| `trg_service_requests_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## service_request_provider_candidates

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_guard_service_candidate_provider_columns` | BEFORE | UPDATE | ROW | — | `guard_service_candidate_provider_columns` |
| `trg_service_request_provider_candidates_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## trips

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_admin_notification_on_trip_insert` | AFTER | INSERT | ROW | — | `trigger_admin_notification_on_trip_insert` |
| `trg_admin_notification_on_trip_status` | AFTER | UPDATE OF status | ROW | — | `trigger_admin_notification_on_trip_status` |
| `trg_log_trip_status_change` | AFTER | UPDATE OF status | ROW | — | `log_trip_status_change` |
| `trg_push_on_trip_status_change` | AFTER | UPDATE OF status | ROW | — | `trigger_push_on_trip_status_change` |
| `trg_reject_trip_candidates_when_cancelled` | AFTER | UPDATE OF status | ROW | — | `reject_trip_candidates_when_cancelled` |
| `trg_require_driver_recheck_before_scheduled` | BEFORE | UPDATE OF status, driver_profile_id | ROW | — | `require_driver_recheck_before_scheduled` |
| `trg_resolve_pending_request_on_trip_cancelled` | AFTER | UPDATE OF status | ROW | — | `resolve_pending_request_on_trip_cancelled` |
| `trg_trips_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## trip_driver_candidates

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_admin_notification_on_candidate_update` | AFTER | UPDATE OF status, offered_price | ROW | — | `trigger_admin_notification_on_candidate_update` |
| `trg_push_on_candidate_insert` | AFTER | INSERT | ROW | — | `trigger_push_on_candidate_insert` |

## products

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_products_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## product_orders

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_product_orders_status_change` | BEFORE | UPDATE | ROW | — | `product_orders_on_status_change` |
| `trg_product_orders_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## notifications

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_push_admin_notification_onesignal` | AFTER | INSERT | ROW | — | `trigger_push_admin_notification_onesignal` |

## chat_messages

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_push_on_chat_message_insert` | AFTER | INSERT | ROW | — | `trigger_push_on_chat_message_insert` |

## addresses

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_set_address_location` | BEFORE | INSERT OR UPDATE OF latitude, longitude | ROW | — | `set_address_location` |

## driver_locations

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_driver_locations_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |
| `trg_set_driver_location` | BEFORE | INSERT OR UPDATE OF latitude, longitude | ROW | — | `set_driver_location` |

## driver_profiles

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_driver_profiles_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## ratings

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_recalculate_provider_rating` | AFTER | INSERT | ROW | — | `recalculate_provider_rating` |

## support_conversations

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_support_conversations_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## support_messages

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_notify_support_message_recipient` | AFTER | INSERT | ROW | — | `notify_support_message_recipient` |
| `trg_sync_support_conversation_on_message` | AFTER | INSERT | ROW | — | `sync_support_conversation_on_message` |
| `trg_sync_support_conversation_on_read` | AFTER | UPDATE OF is_read | ROW | — | `sync_support_conversation_on_read` |
| `trg_validate_support_message_read_update` | BEFORE | UPDATE | ROW | — | `validate_support_message_read_update` |

## trip_cancellation_requests

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_apply_trip_cancellation_request_review` | AFTER | UPDATE OF status | ROW | — | `apply_trip_cancellation_request_review` |
| `trg_notify_admins_on_trip_cancellation_request` | AFTER | INSERT | ROW | — | `notify_admins_on_trip_cancellation_request` |
| `trg_push_driver_trip_cancellation_rejection` | AFTER | UPDATE OF status | ROW | — | `push_driver_trip_cancellation_rejection` |
| `trg_trip_cancellation_requests_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |
| `trg_validate_trip_cancellation_request_review` | BEFORE | UPDATE | ROW | — | `validate_trip_cancellation_request_review` |

## user_saved_addresses

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_user_saved_addresses_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

## vehicles

| Trigger | Quando | Eventos | Nível | Condição (WHEN) | Função |
|---|---|---|---|---|---|
| `trg_vehicles_updated_at` | BEFORE | UPDATE | ROW | — | `update_updated_at_column` |

