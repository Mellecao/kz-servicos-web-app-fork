# Endpoints (Supabase REST / RPC / Realtime) e rotas do painel

> Gerado em 2026-11-05 a partir de dumps do banco real (projeto `mtsqeomctrqfyekyzapc`, schema `public`). Não editar à mão as tabelas: atualizar com a nova introspeção do banco, ou acrescentar a alteração da migration nova (ver regra no SKILL.md).

Base: `https://mtsqeomctrqfyekyzapc.supabase.co`

- **Tabelas** (PostgREST): `GET|POST|PATCH|DELETE /rest/v1/<tabela>`; filtros `?col=eq.valor`, embeds `?select=*,tabela_ligada(*)`.
- **RPC**: `POST /rest/v1/rpc/<função>` com corpo JSON `{ "p_param": valor }`.
- **Auth**: `/auth/v1`. **Realtime**: `wss://mtsqeomctrqfyekyzapc.supabase.co/realtime/v1/websocket`.
- Cabeçalhos: `apikey` (chave publicável do projeto, nunca no git) e `Authorization: Bearer <JWT do utilizador>`. A RLS decide o que cada papel vê e altera (rls-policies.md).
- No painel use sempre o cliente `supabase` de `src/lib/supabase.ts`; a chave de serviço só existe no servidor (`src/lib/supabase-admin.ts`, rotas `app/api/*`).

## Operações com política RLS por tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE | Realtime |
|---|---|---|---|---|---|
| `users` | ✓ | ✓ | ✓ | — | — |
| `provider_profiles` | ✓ | ✓ | ✓ | — | — |
| `provider_category_services` | ✓ | ✓ | — | ✓ | — |
| `service_categories` | ✓ | ✓ | ✓ | ✓ | — |
| `service_requests` | ✓ | ✓ | ✓ | — | ✓ |
| `service_request_provider_candidates` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `service_request_status_history` | ✓ | ✓ | — | — | — |
| `trips` | ✓ | ✓ | ✓ | — | ✓ |
| `trip_driver_candidates` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `products` | ✓ | ✓ | ✓ | ✓ | — |
| `product_orders` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `product_order_items` | ✓ | ✓ | ✓ | ✓ | — |
| `notifications` | ✓ | ✓ | ✓ | — | ✓ |
| `system_settings` | ✓ | ✓ | ✓ | ✓ | — |
| `driver_regions` | ✓ | ✓ | ✓ | ✓ | — |
| `chat_rooms` | ✓ | ✓ | — | — | — |
| `chat_messages` | ✓ | ✓ | ✓ | — | ✓ |
| `addresses` | ✓ | ✓ | — | — | — |
| `admin_logs` | ✓ | ✓ | — | — | — |
| `driver_locations` | ✓ | ✓ | ✓ | — | ✓ |
| `driver_profile_photos` | ✓ | ✓ | — | ✓ | — |
| `driver_profile_regions` | ✓ | ✓ | ✓ | ✓ | — |
| `driver_profiles` | ✓ | ✓ | ✓ | — | — |
| `private_comments` | ✓ | ✓ | ✓ | — | — |
| `ratings` | ✓ | ✓ | — | — | — |
| `service_request_photos` | ✓ | ✓ | — | ✓ | — |
| `support_conversations` | ✓ | ✓ | — | — | ✓ |
| `support_messages` | ✓ | ✓ | ✓ | — | ✓ |
| `trip_cancellation_requests` | ✓ | ✓ | ✓ | — | ✓ |
| `trip_children` | ✓ | ✓ | ✓ | ✓ | — |
| `trip_luggage` | ✓ | ✓ | ✓ | ✓ | — |
| `trip_passengers` | ✓ | ✓ | ✓ | ✓ | — |
| `trip_status_history` | ✓ | ✓ | — | — | — |
| `trip_stops` | ✓ | ✓ | — | — | — |
| `user_devices` | ✓ | ✓ | ✓ | ✓ | — |
| `user_saved_addresses` | ✓ | ✓ | ✓ | ✓ | — |
| `vehicle_photos` | ✓ | ✓ | ✓ | ✓ | — |
| `vehicles` | ✓ | ✓ | ✓ | ✓ | — |

"✓" = existe pelo menos uma política para esse comando (quem pode: ver rls-policies.md). "—" = sem política, logo o comando é negado.

## RPCs: exemplos de chamada

- `cancel_product_order`: `supabase.rpc('cancel_product_order', { p_order_id, p_reason })` → `void`. Cliente cancela o seu pedido (só em `pending`) com motivo.
- `create_product_order`: `supabase.rpc('create_product_order', { p_items, p_delivery_address, p_delivery_reference, p_delivery_lat, p_delivery_lng, p_contact_phone, p_notes, p_payment_method })` → `uuid`. Cliente cria um pedido de produtos: valida itens, calcula preços e totais no servidor e devolve o `uuid` do pedido. `p_items = [{"product_id":"<uuid>","quantity":2}]`.
- `client_request_service_from_provider`: `supabase.rpc('client_request_service_from_provider', { p_provider_profile_id, p_service_category_id, p_description, p_service_date, p_address_id, p_observations })` → `uuid`. Pedido direto a um prestador escolhido no mapa (entra em `searching_provider` com um só convite). Só `client`. No painel reconhece-se por `isDirectRequest` (`src/lib/service-requests.ts`), porque o banco não deixa marca.
- `search_service_providers`: `supabase.rpc('search_service_providers', { p_category_id, p_lat, p_lng, p_limit })` → linhas `{ provider_profile_id, full_name, avatar_url, bio, category_id, category_name, average_rating, total_ratings, price_min, price_max, avg_response_minutes, is_demo, lat, lng, distance_m }`. Usada pelo app Cliente (o painel não a chama).
- Interruptor das caronas: `supabase.from('system_settings').select('value').eq('key', 'trips_enabled').maybeSingle()` (qualquer autenticado lê); o admin grava em `/configuracoes` (`src/lib/trips-enabled-api.ts`).
- `reject_service_request`: `supabase.rpc('reject_service_request', { p_service_request_id, p_reason })` → `void`. Admin rejeita um pedido em `under_review` (→ `review_rejected`); o motivo vai para `service_request_status_history.observations`. Só admin.
- `reject_trip`: `supabase.rpc('reject_trip', { p_trip_id, p_reason })` → `void`. Admin recusa uma viagem em análise, com motivo opcional.
- `select_service_request_provider`: `supabase.rpc('select_service_request_provider', { p_service_request_id, p_provider_profile_id, p_offered_price })` → `void`. Admin escolhe o prestador: o pedido (em `searching_provider`) passa a `awaiting_client_confirmation` com `final_price = p_offered_price`; o candidato fica `accepted` e os outros `rejected`.

## Consultas usadas no painel (embeds)

```ts
// Serviços (src/lib/api.ts)
supabase.from('service_requests').select('*, service_categories(*), addresses(*), users!client_id(*), provider_profiles(*, users(*))')

// Convites de um serviço (src/lib/service-flow-api.ts)
supabase.from('service_request_provider_candidates').select('*, provider_profiles(id, users(full_name, phone))').eq('service_request_id', id)

// Prestadores convidáveis
supabase.from('provider_profiles').select('id, status, service_category_id, average_rating, users(full_name, phone), provider_category_services(service_category_id)').eq('status', 'approved')

// Pedidos de produtos (src/lib/products-api.ts)
supabase.from('product_orders').select('*, users!client_id(id, full_name, email, phone), product_order_items(*)')
```

## Rotas Next do painel (`src/app/api`)

| Rota | Métodos | Nota |
|---|---|---|
| `/api/drivers/:id` | PATCH | usa a chave de serviço no servidor |
| `/api/places/autocomplete` | POST | — |
| `/api/places/details` | GET | — |
| `/api/trips` | POST | usa a chave de serviço no servidor |
| `/api/users/:id` | PATCH, DELETE | usa a chave de serviço no servidor |
| `/api/users` | POST | usa a chave de serviço no servidor |
