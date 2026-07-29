# Corrida Flash — Design Spec

**Data:** 2026-07-29
**Subprojeto:** 1 de 6 (do escopo maior de mudanças cliente + admin + prestador)
**Status:** Draft para revisão

## Objetivo

Introduzir um novo tipo de corrida — **Corrida Flash** — em que o cliente solicita uma viagem para o momento atual, o dispatch vai automaticamente para todos os motoristas aprovados (sem aprovação prévia da KZ Serviços), motoristas enviam propostas com preço livre, o cliente escolhe uma proposta e o motorista confirma um re-check antes da corrida iniciar.

## Não-goals

- Modos de agendamento ("Cotação" e "Escolha seu motorista") — são o subprojeto 2.
- Mapa admin em tempo real de motoristas — subprojeto 3.
- Localização do motorista visível ao cliente durante a corrida — subprojeto 4. (O reuso da tela de corrida em andamento cobre isso quando aquele subprojeto entrar.)
- Notificações admin de padrões suspeitos (múltiplos re-check rejects) — phase 2.
- Estimativa/faixa de preço apresentada ao cliente antes de solicitar — decisão explícita de não implementar nesta fase.

## Codebases envolvidos

- `C:\Projetos\kz-servicos-web-app-fork` — painel admin (Next.js). Leitura + badge FLASH.
- `C:\Projetos\kz-servicos-app-cliente` — Flutter. Novo fluxo Flash.
- `C:\Projetos\kz-servicos-app-prestador` — Flutter. Recebimento, proposta, re-check.
- Supabase — enum novo, RPCs, ajustes de trigger.

---

## 1. Modelo de dados

### Novo enum

```sql
CREATE TYPE public.trip_type AS ENUM ('standard', 'flash');
-- deixa espaço para 'scheduled_choose_driver' e 'scheduled_quote' no subprojeto 2
```

### Alterações em `trips`

```sql
ALTER TABLE public.trips
  ADD COLUMN trip_type public.trip_type NOT NULL DEFAULT 'standard';
CREATE INDEX idx_trips_type_status ON public.trips(trip_type, status);
```

Convenções específicas de Flash:
- `scheduled_datetime = now()` no momento da criação (mantém a coluna NOT NULL, evita migração destrutiva).
- Nenhum campo de rota derivado (paradas, ida-e-volta) é permitido para `trip_type='flash'` — enforçado por CHECK constraint + guardas nas RPCs.

```sql
ALTER TABLE public.trips
  ADD CONSTRAINT trips_flash_no_scheduling CHECK (
    trip_type = 'standard' OR (
      is_round_trip = false
      AND return_datetime IS NULL
    )
  );
```

`trip_stops` fica vazio para Flash (guarda na RPC de criação).

### Ajustes de RLS

Não há novas policies. As policies atuais de `trips`, `trip_driver_candidates`, `chat_rooms`, `chat_messages` já cobrem cliente/motorista/admin. A distinção Flash/Standard é visual/lógica no cliente, não a nível de RLS.

---

## 2. RPCs novas (SECURITY DEFINER, `search_path = public, pg_temp`)

Todas retornam erro tratável (`RAISE EXCEPTION` com mensagem em pt-BR).

### `create_flash_trip`

```
Assinatura:
create_flash_trip(
  p_pickup_address_id uuid,
  p_dropoff_address_id uuid,
  p_service_category_id uuid,
  p_passenger_count int,
  p_children_count int,
  p_luggage_count int,
  p_observations text
) RETURNS uuid
```

Comportamento (transacional):
1. Valida `auth.uid()` é `client`.
2. `INSERT INTO trips (..., trip_type='flash', status='searching_drivers', scheduled_datetime=now())`.
3. Chama `add_all_approved_trip_candidates(new_id)` — insere candidatos para TODOS motoristas aprovados.
4. Retorna `new_id`.

Erros: pickup/dropoff inexistentes; categoria inválida; cliente com trip Flash já ativa (rejeita nova).

### `driver_send_flash_proposal`

```
driver_send_flash_proposal(p_trip_id uuid, p_price numeric) RETURNS void
```

- Valida: motorista tem candidato em `trip_driver_candidates` com `trip_id=p_trip_id`, e trip é `trip_type='flash'` e `status='searching_drivers'`.
- Atualiza candidato: `status='accepted'`, `offered_price=p_price`, `updated_at=now()`.
- Rejeita se candidato já está `accepted` ou `rejected` (proposta é compromisso: motorista não pode alterar preço nem retirar depois — só sai via re-check reject).
- Bloqueia se `p_price <= 0` ou > R$ 10.000 (sanity).
- Erros: candidato inexistente, trip não é Flash, trip não está buscando, preço inválido, candidato já respondeu.

### `reject_flash_call`

```
reject_flash_call(p_trip_id uuid) RETURNS void
```

- Motorista rejeita a chamada antes de propor.
- Atualiza candidato: `status='rejected'`. Fica excluído de futuros redispatches.

### `client_accept_flash_proposal`

```
client_accept_flash_proposal(p_candidate_id uuid) RETURNS void
```

- `pg_advisory_xact_lock(hashtext(trip_id::text))` para resolver corrida concorrente.
- Valida: candidato pertence à trip do cliente; trip é `flash`; candidato está `accepted` com `offered_price NOT NULL`.
- Atualiza trip: `status='awaiting_driver_confirmation'`, `driver_profile_id=candidate.driver`, `vehicle_id` (do motorista escolhido), `final_price=candidate.offered_price`.
- Marca outros candidatos accepted da mesma trip como `rejected`? **Não** — mantidos, mas não usáveis para aceite (idempotência de fluxo).
  Decisão: outros candidatos `accepted` ficam suspensos; a UI cliente esconde eles enquanto `status='awaiting_driver_confirmation'`.

### `driver_flash_recheck_confirm`

```
driver_flash_recheck_confirm(p_trip_id uuid) RETURNS void
```

- Valida: motorista é o `driver_profile_id` da trip, `status='awaiting_driver_confirmation'`, `trip_type='flash'`.
- Atualiza trip: `status='scheduled'`.
- Chama `advance_trip_execution(p_trip_id)` que muda para `execution_stage='to_pickup'` e `status='started'` (comportamento existente).

### `driver_flash_recheck_reject`

```
driver_flash_recheck_reject(p_trip_id uuid) RETURNS void
```

- Valida idem.
- Marca candidato do motorista atual como `status='rejected'`.
- Reverte trip: `status='searching_drivers'`, `driver_profile_id=NULL`, `vehicle_id=NULL`, `final_price=NULL`.
- Chama `redispatch_flash_trip(p_trip_id)`.

### `redispatch_flash_trip`

```
redispatch_flash_trip(p_trip_id uuid) RETURNS integer  -- nº pushes disparados
```

- Chama `add_all_approved_trip_candidates(p_trip_id)` — insere candidates para novos aprovados (idempotente via `NOT EXISTS`).
- Para candidatos `status='pending'` desta trip, envia nova push via `pg_net` p/ edge function OneSignal, com throttle: só se `last_push_at IS NULL OR last_push_at < now() - interval '30 seconds'`.
- Nova coluna: `trip_driver_candidates.last_push_at timestamptz` (default null; trigger de INSERT preenche com now()).

```sql
ALTER TABLE public.trip_driver_candidates
  ADD COLUMN last_push_at timestamptz;
CREATE INDEX idx_tdc_pending_last_push
  ON public.trip_driver_candidates(trip_id, last_push_at)
  WHERE status = 'pending';
```

### `cancel_flash_trip`

```
cancel_flash_trip(p_trip_id uuid, p_reason text) RETURNS void
```

- Valida: cliente é dono da trip, trip é `flash`, `status IN ('searching_drivers','awaiting_driver_confirmation','scheduled')` (não permite cancelar após `started`).
- Atualiza trip: `status='cancelled'`, `cancelled_at=now()`, `cancellation_reason=p_reason`.
- Se havia `driver_profile_id != NULL`, dispara push ao motorista via webhook: "Cliente cancelou a corrida Flash".
- Existing trigger `reject_candidates_when_trip_cancelled` já lida com candidatos.

---

## 3. Ajustes no push trigger existente

`push_on_candidate_insert` (webhook OneSignal) — estender p/ ler `trips.trip_type`:

- Se `trip_type='flash'`:
  - Título: `⚡ CORRIDA FLASH!`
  - Body: `[Nome cliente] pediu uma corrida agora — toque para ver`
  - Data payload: `{ trip_id, trip_type: 'flash', route: '/flash/incoming' }`
- Caso contrário: comportamento atual (standard).

Nova edge function OneSignal para re-push do redispatch (`send_flash_repush`), chamada apenas por `redispatch_flash_trip` via `pg_net` + service role key. Payload igual ao acima.

---

## 4. App cliente (Flutter)

### Ponto de entrada

Na home de solicitar corrida, ao tocar no campo de endereço, abre `BottomSheet` com dois `Card` grandes:

- **⚡ Preciso de uma viagem agora** (Flash)
- **📅 Quero agendar uma viagem** (Agendamento — stub até subprojeto 2)

### Telas Flash em sequência

1. **`FlashAddressesScreen`** — pickup + dropoff (reusa componente de endereço atual, se existir).
2. **`FlashDetailsScreen`** — categoria de veículo (chips), nº passageiros (stepper), crianças (switch + stepper cadeirinha), bagagem (stepper), observações (textarea). **Sem campo de data/horário. Sem paradas. Sem ida-e-volta.**
3. **Confirmação** — botão "Solicitar Flash" chama `create_flash_trip` → navega para `FlashSearchingScreen`.
4. **`FlashSearchingScreen`** (tela principal):
   - Header sticky: spinner + "Buscando motoristas..." + botão "Cancelar".
   - Body: `ListView` de `FlashProposalCard` ordenada por `created_at DESC` do candidate.
   - Cada card: foto motorista, nome, veículo (modelo + cor), ETA em minutos, valor proposto grande.
   - ETA calculado no cliente: haversine entre `driver_locations.location` (última atualização) e `pickup.location`, / velocidade média (aprox 30 km/h) → minutos. Se `driver_locations.updated_at` > 10 min, exibir "ETA indisponível".
   - Tap no card → abre `FlashDriverProfileModal`.
   - Realtime: subscrição em `trip_driver_candidates` filtrada por `trip_id` e `status='accepted' AND offered_price IS NOT NULL`.
5. **`FlashDriverProfileModal`**:
   - Foto grande + nome + rating (⭐ estrelas + nº de avaliações).
   - Nº corridas realizadas (contador de `trips` finalizadas do motorista).
   - Grid de fotos adicionadas (`driver_profile_photos`).
   - Grid de fotos do carro (`vehicle_photos`).
   - ETA em minutos.
   - Preço em destaque.
   - Botões: **[Aceitar proposta]** / **[Voltar]**.
   - Aceitar → `client_accept_flash_proposal(candidate_id)` → navega para `FlashAwaitingDriverScreen`.
6. **`FlashAwaitingDriverScreen`**:
   - "Aguardando [Nome] confirmar..."
   - Realtime em `trips.status`. Se muda para:
     - `scheduled` / `started` → navega para tela de corrida em andamento (tilt view existente, reusa fluxo standard).
     - `searching_drivers` → volta para `FlashSearchingScreen` com snackbar "O motorista desistiu, buscando novamente...".
     - `cancelled` → home com aviso.
7. **Cancelar** — botão no topo de `FlashSearchingScreen` e `FlashAwaitingDriverScreen` → `cancel_flash_trip`.

### Retomada de estado

Ao abrir o app, `ActiveFlashTripGate` verifica se o usuário tem trip com `trip_type='flash'` e `status IN ('searching_drivers','awaiting_driver_confirmation','scheduled','started')` e navega para a tela correspondente (usando o `status`).

### Estados de erro

- Sem conexão: banner "Sem internet, tentando reconectar..." + realtime tenta reconectar automaticamente.
- RPC falha: SnackBar com `error.message`. Não retentar cria/aceita automaticamente.

---

## 5. App motorista (Flutter)

### Recebimento da chamada

Push OneSignal chega com `trip_type='flash'` no data payload → app roteia para `FlashIncomingCallScreen`.

### `FlashIncomingCallScreen`

- Mini-mapa com origem/destino e rota.
- Distância + ETA até pickup (localização atual do motorista → pickup).
- Distância + duração estimada da viagem (pickup → dropoff).
- Cliente: primeiro nome + foto.
- Categoria de veículo, passageiros, bagagem, crianças, observações.
- Rodapé fixo:
  - Input `R$ ___,__` (formatação de moeda pt-BR).
  - Botão principal **[Enviar proposta]** → `driver_send_flash_proposal(trip_id, price)`.
  - Link secundário **[Recusar]** → `reject_flash_call(trip_id)`.
- Voltar sem ação (botão do sistema) → mantém candidato `pending` (motorista pode voltar depois).

### `FlashAwaitingClientScreen`

- Após enviar proposta: "Proposta enviada, aguardando cliente escolher..."
- Realtime em `trips.status`.
  - Se muda para `awaiting_driver_confirmation` E `trip.driver_profile_id = motorista atual` → navega para `FlashRecheckScreen` + push.
  - Se muda para `awaiting_driver_confirmation` mas driver é outro → tela fecha "Cliente escolheu outro motorista".
  - Se `cancelled` → tela fecha "Cliente cancelou a Flash".

### `FlashRecheckScreen`

- Push nova: `✅ Cliente aceitou sua proposta!` / `Deseja iniciar a corrida?`
- Tela mostra detalhes finais (endereços, valor confirmado, cliente).
- Botões: **[Iniciar corrida]** → `driver_flash_recheck_confirm` → navega para tela de corrida em andamento (reusa fluxo standard, `advance_trip_execution` cuida do resto).
- **[Desistir]** → `driver_flash_recheck_reject`. Volta para tela inicial. Snackbar "Você desistiu desta corrida".

### Retomada de estado

`ActiveFlashCandidateGate` — se motorista tem candidato ativo em trip Flash, roteia direto (respeitando `trips.status` e `candidate.status`).

---

## 6. Painel admin (Next.js)

### Lista de corridas

- Nova coluna/badge `⚡ FLASH` quando `trip_type='flash'`.
- Filtro no topo: "Todos / Padrão / Flash".

### Detalhe de trip Flash

Mesmo layout atual, com ajustes:
- **Ocultar** botões: "Aprovar", "Rejeitar", "Selecionar motorista", "Editar horário/rota", "Editar detalhes".
- **Manter** botões: "Ver logs", "Cancelar (emergência)".
- Cancelamento emergência: escreve em `admin_logs` com `action_type='admin_cancel_flash_emergency'`.

### Dashboard (opcional / phase 2 se demorar)

- Métricas separadas Flash x Standard: contagem, ticket médio, tempo médio de match, taxa de abandono. Se não tiver bandwidth agora, deixa pra phase 2.

---

## 7. Semântica de "recusou" (crítica p/ redispatch)

| Estado candidate | Significado | Recebe redispatch? |
|---|---|---|
| `pending` | Motorista ignorou / não respondeu ao push | **Sim**, recebe re-push com throttle 30s |
| `accepted` (com `offered_price`) | Proposta ativa aguardando cliente | Não (já ativo) |
| `rejected` | Motorista tocou "Recusar" na chamada ou "Desistir" no re-check | **Não**, permanentemente excluído desta trip |

Base do redispatch:
1. `add_all_approved_trip_candidates(trip_id)` insere apenas aprovados sem candidato — motoristas que entraram como aprovados após o dispatch original.
2. Loop pelos candidatos `pending` da trip → verifica `last_push_at + 30s < now()` → envia re-push via `pg_net` + edge function OneSignal → atualiza `last_push_at`.

---

## 8. Tratamento de erros e edge cases

- **RPC atômica falha** → transação faz rollback, cliente vê erro. Não deixa trip órfã.
- **OneSignal fora do ar** → trip existe e é visível no realtime; motoristas com app aberto podem ver mesmo sem push (se houver listagem de chamadas ativas — se não, aceita degradação).
- **Cliente aceita 2 propostas quase simultaneamente** → `pg_advisory_xact_lock` na trip: apenas a primeira ganha.
- **Cliente cancela enquanto motorista faz re-check** → cancel wins; ao terminar re-check confirm, motorista vê erro "Corrida cancelada pelo cliente".
- **Motorista com localização desatualizada (`driver_locations.updated_at > 10min`)** → card mostra "ETA indisponível". Motorista ainda pode receber chamada (dispatch é global).
- **Cliente já tem outra Flash ativa** → `create_flash_trip` rejeita nova.

---

## 9. Testes (TDD)

### Supabase (pgTAP ou testes de RPC via supabase-js)

Cada RPC ganha ao menos os testes abaixo, escritos ANTES da implementação:

1. `create_flash_trip` cria com `trip_type='flash'`, `status='searching_drivers'`, `scheduled_datetime≈now()`.
2. `create_flash_trip` insere candidato para TODOS motoristas com `provider_profiles.status='approved'` e nenhum a mais.
3. `create_flash_trip` rejeita se cliente já tem outra Flash ativa.
4. `driver_send_flash_proposal` bloqueia quando `trip_type='standard'`.
5. `driver_send_flash_proposal` rejeita preço ≤ 0 ou > 10.000.
6. `client_accept_flash_proposal` sob concorrência: 2 aceites simultâneos → só 1 vence.
7. `driver_flash_recheck_reject` marca candidato como `rejected` E dispara `redispatch_flash_trip`.
8. `redispatch_flash_trip` NÃO reinsere candidato `rejected`.
9. `redispatch_flash_trip` respeita throttle de 30s no `last_push_at`.
10. `cancel_flash_trip` só permite ao dono; escreve `cancelled_at` e `cancellation_reason`.

### App cliente (flutter_test + integration_test)

- BottomSheet de escolha Flash/Agendamento navega corretamente.
- `FlashSearchingScreen` lista propostas em ordem cronológica; tap abre modal.
- `FlashDriverProfileModal` renderiza rating, contador de corridas, grids de foto, botão aceitar.
- `ActiveFlashTripGate` roteia corretamente conforme `status`.
- Cancelamento chama RPC e navega para home.

### App motorista (flutter_test + integration_test)

- `FlashIncomingCallScreen` valida preço obrigatório e > 0.
- Enviar proposta chama `driver_send_flash_proposal` e navega para awaiting.
- Recusar chama `reject_flash_call` e volta pro home.
- Re-check confirm/reject navega corretamente.

### Painel admin (Jest + React Testing Library)

- Lista mostra badge `⚡ FLASH` quando `trip_type='flash'`.
- Filtro "Flash" filtra corretamente.
- Detalhe de Flash não renderiza botões de ação de standard.
- Cancelamento emergência escreve em `admin_logs`.

---

## 10. Ordem de implementação sugerida (para o writing-plans)

1. Migrations Supabase: enum, coluna `trip_type`, `last_push_at`, CHECK constraint.
2. RPCs Supabase (com testes pgTAP antes).
3. Extensão do trigger `push_on_candidate_insert` + nova edge function `send_flash_repush`.
4. Painel admin: badge FLASH + filtro + guarda dos botões de ação.
5. App cliente: BottomSheet de escolha + telas Flash + realtime + gate.
6. App motorista: telas Flash + realtime + gate.
7. Testes de integração end-to-end (uma Flash completa em ambiente local).

---

## Riscos e mitigações

- **Migração `trip_type` sem default** quebra INSERTs existentes — mitigado por `DEFAULT 'standard'`.
- **CHECK constraint `trips_flash_no_scheduling`** pode falhar em dados legados — deixamos só p/ novos (trip_type='standard' passa livre).
- **Push spam via redispatch** — throttle 30s + candidate.status='pending' filter.
- **Cliente sem localização compartilhada do motorista → ETA nulo** — UI degradada, mas fluxo não quebra.
- **Tabela `trip_driver_candidates` cresce muito** — já tem índices; se performance cair, considerar arquivamento periódico (fora do escopo).

## Aprovação

Assinado após brainstorming em 2026-07-29 com Guilherme.
