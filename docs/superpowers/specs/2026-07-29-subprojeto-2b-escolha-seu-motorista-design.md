# Subprojeto 2B — Escolha seu Motorista (design)

**Data:** 2026-07-29
**Codebases:**
- Cliente Flutter: `C:\Projetos\kz-servicos-app-cliente` (BLoC/Cubit)
- Prestador Flutter: `C:\Projetos\kz-servicos-app-prestador` (StatefulWidget + services)
- Admin Next.js: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`
- Migrations Supabase: `supabase/migrations/` no admin repo

**Backlog referência:** `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md` §Subprojeto 2
**Depende de:** Subprojeto 2A (`docs/superpowers/specs/2026-07-29-subprojeto-2a-corrida-agendada-fundacao-design.md`) — enum `trip_type='scheduled_choose_driver'` e `ScheduledModeChoiceSheet` já existem.

---

## 1. Objetivo

Cliente escolhe manualmente qual motorista quer para uma corrida agendada. Ao invés de dispatch a todos motoristas (Flash) ou aprovação admin (standard), o cliente vê lista de motoristas aprovados, escolhe um específico, e envia solicitação direta. Motorista aceita propondo um preço; cliente confirma ou volta pra lista.

Objetivo estratégico: dar poder de escolha ao cliente, reduzir fricção de aprovação admin, e conectar clientes com motoristas favoritos.

## 2. Escopo

**Dentro:**
- Cliente: novo módulo `scheduled_choose_driver` com 3 páginas (`DriverSelectionPage`, `AwaitingDriverResponsePage`, `PriceOfferReviewPage`)
- Cliente: `ScheduledModeChoiceSheet` (do 2A) ativa a opção "Escolha seu motorista"
- Cliente: banner discreto no home mostrando solicitação pendente
- Prestador: `schedules_page.dart` ganha handler para `scheduled_choose_driver` requests com badge "NOVA" + botões Aceitar/Recusar
- Prestador: `push_notification_service.dart` rota push type `scheduled_direct_request` → `/schedules?tripId=<uuid>`
- Prestador: dialog de proposta de preço no aceite (mesma UX do Flash mas para 1 motorista)
- Admin: badge 👤 ESCOLHA MOTORISTA + filtro no Kanban `/viagens`
- Admin: TripDetailModal mostra motorista escolhido + status candidate + preço proposto
- Admin: botão "Cancelar (emergência)" no modal
- 6 RPCs SECURITY DEFINER: `client_send_scheduled_direct_request`, `driver_accept_scheduled_direct`, `driver_reject_scheduled_direct`, `client_accept_scheduled_price`, `client_reject_scheduled_price`, `cancel_scheduled_direct_request` (cancelamento pelo cliente pendente — necessário; cancelamento admin emergência reusa mesma RPC ou dedicada, decisão no plan)
- Estender trigger push existente para reconhecer `trip_type='scheduled_choose_driver'`
- Testes puros: parsers/status mappers no cliente, prestador e admin

**Fora (backlog):**
- **Chat prévio** antes de solicitar (decisão consciente — chat só após aceite via `chat_rooms` que já existe)
- Timeout automático server-side para solicitação pendente
- Múltiplas solicitações paralelas (V1: só 1 pendente por vez)
- Contra-proposta de preço pelo cliente
- Ranking da lista (rating desc, proximidade, etc.) — V1 sem ordenação específica
- Filtro por categoria de veículo
- Ocultação persistente de motoristas que já recusaram
- Notif automático de "nenhum motorista respondeu em X min"
- Métrica "tempo médio de resposta" no card

## 3. Decisões de design

| Decisão | Valor | Razão |
|---|---|---|
| Timing da lista | Após picker de endereços + detalhes | Cliente escolhe motorista já com contexto completo |
| Filtro da lista | `provider_profiles.status='approved'` (sem `is_available`) | Simplicidade; motorista sempre pode recusar |
| Conteúdo do card | Foto + nome + rating + veículo | Info essencial pra decisão sem overload |
| Ação do card | Só "Solicitar" (sem chat prévio) | Chat pós-aceite via `chat_rooms` existente |
| Pós-Solicitar | Tela de espera + botão "Continuar navegando" + banner home | Não prende cliente na tela |
| Multiplicidade | 1 pendente por vez | Simplifica dispatch e evita spam |
| Prestador view | Push + card em Agendamentos existente | Reusa `schedules_page.dart`; padrão "discreto" pedido no backlog |
| Recusa | Volta à lista com corrida preservada | Sem timeout, sem ocultação de motoristas |
| Preço | Motorista propõe ao aceitar; cliente confirma/recusa | Padrão Flash aplicado a 1 candidato |
| Admin | Badge + filtro + modal + botão cancelar emergência | Mesma paridade do filtro Cotação (2A) e Flash |

## 4. Arquitetura

### 4.1 Ciclo de vida da trip

| Momento | `trips.status` | `trips.driver_profile_id` | Candidate |
|---|---|---|---|
| Cliente Solicita | `awaiting_driver_confirmation` | motorista escolhido | 1 candidate `pending` |
| Motorista Recusa | `searching_drivers` | `NULL` | candidate `rejected` |
| Motorista Aceita c/ preço | `awaiting_client_confirmation` | permanece | candidate `accepted`, `offered_price` populado |
| Cliente Confirma preço | `scheduled` | permanece | candidate permanece `accepted` |
| Cliente Recusa preço | `searching_drivers` | `NULL` | candidate `rejected` |
| Cliente Cancela pendente | `cancelled` | preservado p/ auditoria | candidate `rejected` |

### 4.2 Reuso de schema

**Nenhuma coluna nova em `trips` ou `trip_driver_candidates`.** Todo o fluxo usa:
- `trips.trip_type = 'scheduled_choose_driver'` (adicionado no 2A)
- `trips.status` — todos os estados usados (`awaiting_driver_confirmation`, `awaiting_client_confirmation`, `searching_drivers`, `scheduled`, `cancelled`) já existem
- `trips.driver_profile_id`, `trips.final_price`
- `trip_driver_candidates.status`, `.offered_price`, `.last_push_at`

### 4.3 Guard "só 1 pendente"

**Query cliente (antes de mostrar `DriverSelectionPage`):**

```sql
SELECT id, driver_profile_id
  FROM trips
 WHERE client_id = auth.uid()
   AND trip_type = 'scheduled_choose_driver'
   AND status IN ('awaiting_driver_confirmation', 'awaiting_client_confirmation')
 LIMIT 1;
```

Se retornar linha → redireciona pra `AwaitingDriverResponsePage` da trip existente em vez de mostrar a lista.

**Enforcement duplicado dentro da RPC** `client_send_scheduled_direct_request` (RAISE EXCEPTION se houver pendente + advisory lock por `client_id`).

### 4.4 Realtime

**Cliente:** canal único `client-scheduled-direct-${clientId}` inscrito em `postgres_changes` de `trips` filtrado por `client_id`. Usado por `AwaitingDriverResponsePage` e pelo banner do home.

**Prestador:** canal já existente em `schedules_page.dart` filtrado por `driver_profile_id` — ganha branch para reagir a `trip_type='scheduled_choose_driver'` recém-inserida ou atualizada.

**Admin:** Kanban existente em `/viagens` já subscreve `trips` — badge/filtro renderiza naturalmente.

### 4.5 Estrutura de arquivos

**Cliente Flutter:**

```
lib/features/scheduled_choose_driver/                         # NEW
  domain/entities/
    available_driver.dart
    scheduled_direct_request.dart
  data/repositories/
    available_drivers_repository.dart
    scheduled_direct_request_repository.dart
  presentation/pages/
    driver_selection_page.dart
    awaiting_driver_response_page.dart
    price_offer_review_page.dart
  presentation/widgets/
    driver_card.dart
    active_request_banner.dart
  presentation/cubits/
    driver_selection_cubit.dart
    awaiting_response_cubit.dart

lib/features/trip/presentation/widgets/
  scheduled_mode_choice_sheet.dart                            # MODIFY: ativa opção "Escolha seu motorista"

lib/features/trip/presentation/pages/
  trip_home_page.dart                                         # MODIFY: cascade + renderiza banner
```

**Prestador Flutter:**

```
lib/features/schedules/data/repositories/
  scheduled_direct_repository.dart                            # NEW: acceptWithPrice, reject

lib/features/schedules/presentation/pages/
  schedules_page.dart                                         # MODIFY: novo tipo de card

lib/features/schedules/presentation/widgets/
  scheduled_direct_request_card.dart                          # NEW

lib/features/schedules/presentation/dialogs/
  price_offer_dialog.dart                                     # NEW

lib/core/services/
  push_notification_service.dart                              # MODIFY: rota scheduled_direct_request
```

**Admin Next.js:**

```
src/lib/
  trip-status.ts                                              # MODIFY: +isChooseDriverTrip + teste
  scheduled-direct.ts                                         # NEW: cancelSchedulesDirectByAdmin (RPC helper)

src/app/(dashboard)/viagens/
  page.tsx                                                    # MODIFY: filtro + badge (padrão do 2A Cotação)

src/components/
  TripDetailModal.tsx (ou onde vive)                          # MODIFY: seção choose_driver
```

**Supabase migrations:**

```
NNNNNNNNNNNN_scheduled_direct_rpcs.sql                        # 5 RPCs (client_send, driver_accept, driver_reject, client_accept_price, client_reject_price)
NNNNNNNNNNNN_scheduled_direct_cancel_rpc.sql                  # opcional: reusar cancel_flash_trip se possível
NNNNNNNNNNNN_push_trigger_include_scheduled_direct.sql        # atualiza trigger push_on_candidate_insert
NNNNNNNNNNNN_scheduled_direct_status_push_triggers.sql        # triggers de status change específicos
```

### 4.6 Interfaces principais

**Dart `AvailableDriver`:**
```dart
class AvailableDriver {
  final String driverProfileId;
  final String fullName;
  final String? avatarUrl;
  final double? averageRating;      // null → "Sem avaliações"
  final int totalRatings;
  final Vehicle? vehicle;           // {brand, model, licensePlate, color}
}
```

**Dart `ScheduledDirectRequest`:**
```dart
class ScheduledDirectRequest {
  final String tripId;
  final String driverProfileId;
  final ScheduledDirectStatus status; // awaitingDriver, priceOffered, rejected, confirmed, cancelled
  final double? offeredPrice;
  final String driverName;
  final String? driverAvatarUrl;
}

enum ScheduledDirectStatus { awaitingDriver, priceOffered, rejected, confirmed, cancelled }
```

**TS `isChooseDriverTrip`:**
```typescript
export function isChooseDriverTrip(trip: { trip_type?: string | null } | null | undefined): boolean {
  return trip?.trip_type === "scheduled_choose_driver";
}
```

## 5. RPCs

Todas com `SECURITY DEFINER`, `SET search_path = public`, `REVOKE EXECUTE ... FROM PUBLIC, anon`, `GRANT EXECUTE ... TO authenticated`. Guards inline por `auth.uid()`.

### 5.1 `client_send_scheduled_direct_request`

```sql
CREATE OR REPLACE FUNCTION public.client_send_scheduled_direct_request(
  driver_profile_id_input uuid,
  pickup_address_id_input uuid,
  dropoff_address_id_input uuid,
  service_category_id_input uuid,
  passenger_count_input int,
  observation_input text
) RETURNS uuid
```

Ações inline (mesma transação, com `pg_advisory_xact_lock(hashtext(auth.uid()::text))` pra prevenir dupla submissão):
- Verifica motorista existe + `provider_profiles.status='approved'`
- Verifica cliente NÃO tem outra `scheduled_choose_driver` pendente
- INSERT em `trips` com `trip_type='scheduled_choose_driver'`, `status='awaiting_driver_confirmation'`, `driver_profile_id=driver_profile_id_input`, `client_id=auth.uid()`
- INSERT em `trip_driver_candidates` com `status='pending'`, `last_push_at=now()`
- Trigger `trigger_push_on_candidate_insert` (adaptado) dispara push ao motorista

Retorna `trip_id`.

### 5.2 `driver_accept_scheduled_direct`

```sql
CREATE OR REPLACE FUNCTION public.driver_accept_scheduled_direct(
  trip_id_input uuid,
  offered_price_input numeric
) RETURNS void
```

Guards: `offered_price_input > 0 AND offered_price_input <= 10000`; motorista dono do candidate; trip é `scheduled_choose_driver` e `status='awaiting_driver_confirmation'`; candidate é `pending`.

Ações:
- UPDATE candidate → `status='accepted'`, `offered_price=offered_price_input`
- UPDATE trip → `status='awaiting_client_confirmation'`
- Trigger de status change dispara push ao cliente

### 5.3 `driver_reject_scheduled_direct`

Ações:
- UPDATE candidate → `status='rejected'`
- UPDATE trip → `status='searching_drivers'`, `driver_profile_id=NULL`
- Trigger push ao cliente

### 5.4 `client_accept_scheduled_price`

Ações:
- UPDATE trip → `status='scheduled'`, `final_price=candidate.offered_price`
- Push ao motorista "Cliente confirmou"

### 5.5 `client_reject_scheduled_price`

Ações: mesma dinâmica de `driver_reject` — candidate `rejected`, trip volta a `searching_drivers` + `driver_profile_id=NULL`.

### 5.6 `cancel_scheduled_direct_request`

**Cliente cancela solicitação pendente OU admin cancela emergência.**

Guards: cliente dono da trip OU `get_user_role()='admin'`; trip é `scheduled_choose_driver`; status ∈ `{awaiting_driver_confirmation, awaiting_client_confirmation, searching_drivers}`.

Ações: UPDATE trip → `status='cancelled'`, UPDATE candidate → `status='rejected'`, push ao motorista notificando cancelamento.

**Nota de reuso:** verificar durante writing-plans se `cancel_flash_trip` cobre semanticamente (mesmo padrão de ações). Se sim, reusar; se não, criar dedicada.

## 6. Push notifications

### 6.1 Trigger de push

`trigger_push_on_candidate_insert` (aplicado no Flash) reconhece `trip_type`. Adicionar caso `'scheduled_choose_driver'` → `type='scheduled_direct_request'`.

### 6.2 Payloads

**Ao motorista (novo candidate):**
```json
{
  "type": "scheduled_direct_request",
  "title": "📅 NOVA SOLICITAÇÃO DE AGENDAMENTO",
  "body": "<nomeCliente> solicitou uma corrida agendada",
  "data": { "type": "scheduled_direct_request", "tripId": "<uuid>", "route": "/schedules?tripId=<uuid>" }
}
```

**Ao cliente (motorista aceitou):**
```json
{
  "type": "scheduled_direct_price_offered",
  "title": "Motorista aceitou! Confirme o valor",
  "body": "<motorista> propôs R$ <valor>",
  "data": { "type": "scheduled_direct_price_offered", "tripId": "<uuid>" }
}
```

**Ao cliente (motorista recusou):**
```json
{
  "type": "scheduled_direct_rejected",
  "title": "Motorista indisponível",
  "body": "<motorista> não pode aceitar. Escolha outro.",
  "data": { "type": "scheduled_direct_rejected", "tripId": "<uuid>" }
}
```

**Ao motorista (cliente confirmou preço):**
```json
{
  "type": "scheduled_direct_confirmed",
  "title": "Corrida agendada!",
  "body": "Cliente confirmou o valor R$ <valor>",
  "data": { "type": "scheduled_direct_confirmed", "tripId": "<uuid>" }
}
```

### 6.3 Deep links (push_notification_service.dart)

**Prestador:**
- `scheduled_direct_request` → `/schedules?tripId=<uuid>`
- `scheduled_direct_confirmed` → `/schedules?tripId=<uuid>` (trip agora aparece agendada)

**Cliente:**
- `scheduled_direct_price_offered` → `/scheduled-choose-driver/awaiting?tripId=<uuid>` (ou rota final decidida no writing-plans)
- `scheduled_direct_rejected` → `/scheduled-choose-driver/select` com corrida preservada
- `scheduled_direct_confirmed` → `/active-trip?tripId=<uuid>`

Rotas exatas conforme `go_router` do cliente — nomes finais entram no plan.

## 7. Testes automatizados

**Cliente Dart:**
- `available_driver_test.dart` — parse row Supabase → `AvailableDriver` (avatar/rating null, vehicle null)
- `scheduled_direct_status_test.dart` — mapper `(trip_status + candidate_status) → ScheduledDirectStatus` (5 transições)

**Prestador Dart:**
- `scheduled_direct_card_state_test.dart` — mapper pending/accepted/rejected → estado do card

**Admin TS:**
- `trip-status.test.ts` — 2 testes de `isChooseDriverTrip`

**Fora do escopo automatizado:** RPCs, push, widgets, cascade e2e (cobertura via checklist manual).

## 8. Segurança

| Concern | Mitigação |
|---|---|
| RPCs abertas | SECURITY DEFINER + REVOKE anon + guards por `auth.uid()` |
| Cliente forjar `driver_profile_id` | Verifica `driver.status='approved'` |
| Motorista aceitar trip de outro | `auth.uid()` bate com provider→driver do candidate |
| Spam de requests | Guard "só 1 pendente" (RAISE EXCEPTION) + advisory lock por client_id |
| Preço absurdo | Validação `0 < price <= 10000` na RPC + limite visível no front |
| Race cliente-aceita vs motorista-cancela | Advisory lock por trip_id na RPC |
| Push spoof | Payloads gerados via trigger no banco |
| RLS `driver_profiles.SELECT` | Já permitida a qualquer autenticado |

**Advisor Supabase** pós-migrations: WARN esperado sobre "SECURITY DEFINER callable by authenticated" — mesma exceção aceita nos Subprojetos Flash e 2A.

## 9. Rollout

1. Aplicar 3-4 migrations em dev → staging → prod (via MCP)
2. Rodar advisors
3. Merge do PR admin (badge/filtro/modal) — isolado
4. Rollout coordenado cliente + prestador (mesmo dia idealmente; prestador antes)
5. Sem feature flag: descomentar TODO em `scheduled_mode_choice_sheet.dart` ativa. Rollback = revert do commit da UI cliente

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Motorista aceita mas cliente demora dias pra confirmar preço | Sem timeout server-side — trip fica `awaiting_client_confirmation`. Aceitável V1; monitorar. Futuro: cron que expira após N horas |
| Cliente com 1 solicitação pendente ficar preso (motorista offline) | Botão "Cancelar solicitação" na `AwaitingDriverResponsePage` sempre disponível → chama `cancel_scheduled_direct_request` → volta à lista |
| Push perdido no prestador | Realtime channel em `schedules_page` atualiza mesmo sem push; cliente vê no banner que continua pendente |
| Trip órfã se app crashar no meio | Guard "só 1 pendente" bloqueia nova requisição até a antiga ser cancelada explicitamente ou aceita — cliente vê a antiga ao voltar |
| Dispatch a motorista que não usa `is_available` | Filtro é só `provider_profiles.status='approved'` (decisão consciente); motorista sempre pode Recusar |
| Preço proposto absurdamente alto | Validação inline na RPC (`0 < price <= 10000`); frontend adiciona limite visível também |
| Push com type novo não roteado em app antigo | Cliente/prestador antigo em prod ignora tipos desconhecidos silenciosamente; upgrade forçado via app stores para tipos novos |
| Race cliente-confirma vs motorista-recusa | Advisory lock por `trip_id` nas RPCs `client_accept_scheduled_price` e `driver_reject_scheduled_direct` |

## 11. Fora de escopo (backlog)

- Chat prévio antes de solicitar (chat só após aceite)
- Timeout server-side para requests pendentes
- Múltiplas solicitações paralelas
- Contra-proposta de preço
- Ranking/ordenação da lista
- Filtro por categoria de veículo
- Ocultação persistente de motoristas que recusaram
- Notif de "ninguém aceitou em X min"
- Tempo médio de resposta no card

## 12. Sinais de done

- 3-4 migrations aplicadas + advisors validados
- Cliente: `DriverSelectionPage` → Solicitar → `AwaitingDriverResponsePage` (com "Continuar navegando" + banner home)
- Cliente: recebe proposta de preço, confirma ou recusa
- Prestador: recebe push AGENDAMENTO, aceita com preço ou recusa
- Recusa em qualquer lado retorna à lista com corrida preservada
- Admin: badge + filtro + modal + botão cancelar emergência
- Suite de testes puros verde (Dart cliente + Dart prestador + TS admin)
- Checklist e2e 100% executado (7-9 cenários)

## 13. Referências

- Backlog: `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md`
- Spec do 2A (fundação): `docs/superpowers/specs/2026-07-29-subprojeto-2a-corrida-agendada-fundacao-design.md`
- Padrão RPCs Flash: `supabase/migrations/20260729120010+` (Flash)
- `TripTypeChoiceSheet` cliente: `lib/features/trip/presentation/widgets/trip_type_choice_sheet.dart`
- `ScheduledModeChoiceSheet` cliente (2A): `lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart`
- `schedules_page.dart` prestador: `lib/features/schedules/presentation/pages/schedules_page.dart`
- `push_notification_service.dart` prestador: `lib/core/services/push_notification_service.dart:172-372`
- Padrão realtime admin: `src/app/(dashboard)/viagens/page.tsx`
- Schema `chat_rooms`: `supabase/migrations/20260410120015_create_chat_rooms_table.sql`
- Schema `trip_driver_candidates`: `supabase/migrations/20260424000000_create_trip_driver_candidates.sql`
