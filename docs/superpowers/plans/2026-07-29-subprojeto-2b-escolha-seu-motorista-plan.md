# Subprojeto 2B — Escolha seu Motorista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente escolhe motorista aprovado da lista, envia solicitação direta; motorista aceita propondo preço; cliente confirma → trip vira `scheduled` sem admin approval.

**Architecture:** 3 migrations Supabase (RPCs SECURITY DEFINER padrão Flash + trigger push) → cliente Flutter ganha módulo `scheduled_choose_driver/` (entities + repositories + 3 pages + cubits) → prestador ganha card + dialog de preço em `schedules_page` (existente) + rota push nova → admin ganha badge/filtro/branch no TripDetailModal (padrão do 2A Cotação). Nenhuma coluna nova em `trips` ou `trip_driver_candidates`.

**Tech Stack:** Supabase (Postgres + RLS + triggers), Flutter 3.11 + `flutter_bloc` + `supabase_flutter` + `go_router`, Next.js 16 App Router + React 19, `node:test` (admin) + `flutter_test` (apps).

**Pré-descobertas confirmadas antes deste plano:**

- **Cliente router** em `lib/routes/app_router.dart`. Pattern: `GoRoute(path, builder)` com `pathParameters['tripId']!`. Reference: rotas `/flash/searching/:tripId` linhas 145-158.
- **Admin `TripDetailModal.tsx`** existe como arquivo separado em `src/components/`, importado em `viagens/page.tsx:9`. Já tem condicional `isFlash` (linhas ~430-435) que serve de modelo pra `isScheduledChooseDriver`.
- **`cancel_flash_trip`** (migration `20260729120016`) é hardcoded para `trip_type='flash'` — precisa RPC nova dedicada.
- **`flash_price_input.dart`** no prestador é StatefulWidget com TextField + ElevatedButton + validação `0 < price <= 10000` e callback `onSubmit(double)`. Reusável via wrapper de dialog.
- **Padrão de trigger push** (Flash): `trigger_push_on_candidate_insert` já reconhece `trip_type` para variar `type`/`title`. Adicionar caso `scheduled_choose_driver`.
- **Padrão testes**: admin `npx tsx --test src/lib/<x>.test.ts`; cliente `flutter test test/<caminho>`; prestador `flutter test test/<caminho>`.
- **Padrão realtime** admin: `src/app/(dashboard)/viagens/page.tsx:148-198`.
- **Padrão realtime** prestador: `schedules_page.dart` linhas 47-91 (dois canais em trips + trip_driver_candidates filtrados por driver_profile_id).
- **Estado 2A entregue**: enum `trip_type` tem `scheduled_choose_driver`; `ScheduledModeChoiceSheet` tem TODO comentado para essa opção. `TripRequest.tripType` propagado até INSERT.
- **Package name cliente Flutter**: `kz_servicos_app` (confirmado no 2A). Path imports usam `package:kz_servicos_app/...`.
- **`Vehicle` no admin** (`src/types/database.ts:139`): `{brand, model, color, license_plate, ...}`. Cliente usa `licensePlate` camelCase (padrão do Subprojeto 3).

**Ordem das tasks (dependências):**
- Tasks 1-3 (migrations): antes de qualquer código que use novos artefatos DB
- Tasks 4-13 (cliente): dependem de 1-3
- Tasks 14-17 (prestador): dependem de 1-3
- Task 18 (admin): dependem de 1
- Task 19 (e2e + verify): última

---

## File Structure

**Supabase migrations** (`supabase/migrations/`):

```
NNNNNNNNNNNN_scheduled_choose_driver_rpcs.sql
NNNNNNNNNNNN_cancel_scheduled_choose_driver_trip_rpc.sql
NNNNNNNNNNNN_push_trigger_include_scheduled_choose_driver.sql
```

**Cliente Flutter** (`C:\Projetos\kz-servicos-app-cliente`):

```
lib/features/scheduled_choose_driver/                          # NEW module
  domain/entities/
    available_driver.dart
    scheduled_direct_request.dart                              # + enum ScheduledDirectStatus + mapper
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
  scheduled_mode_choice_sheet.dart                             # MODIFY: ativa opção "Escolha seu motorista"

lib/features/trip/presentation/pages/
  trip_home_page.dart                                          # MODIFY: cascade + renderiza ActiveRequestBanner

lib/routes/app_router.dart                                     # MODIFY: 3 GoRoute novas
```

**Testes cliente** (`C:\Projetos\kz-servicos-app-cliente\test\`):

```
features/scheduled_choose_driver/domain/entities/
  available_driver_test.dart
  scheduled_direct_request_test.dart
```

**Prestador Flutter** (`C:\Projetos\kz-servicos-app-prestador`):

```
lib/features/schedules/data/repositories/
  scheduled_direct_repository.dart                             # NEW

lib/features/schedules/presentation/widgets/
  scheduled_direct_request_card.dart                           # NEW

lib/features/schedules/presentation/dialogs/
  price_offer_dialog.dart                                      # NEW: wrapper de FlashPriceInput

lib/features/schedules/presentation/pages/
  schedules_page.dart                                          # MODIFY: renderizar novo card

lib/core/services/
  push_notification_service.dart                               # MODIFY: routing scheduled_direct_request
```

**Testes prestador** (`C:\Projetos\kz-servicos-app-prestador\test\`):

```
features/schedules/data/repositories/
  scheduled_direct_status_mapper_test.dart                     # pure function pra state do card
```

**Admin Next.js**:

```
src/lib/
  trip-status.ts                                               # MODIFY: +isChooseDriverTrip
  trip-status.test.ts                                          # MODIFY: +2 testes
  scheduled-direct.ts                                          # NEW: cancelSchedulesDirectByAdmin helper

src/app/(dashboard)/viagens/
  page.tsx                                                     # MODIFY: filtro + badge (padrão Cotação 2A)

src/components/
  TripDetailModal.tsx                                          # MODIFY: branch isScheduledChooseDriver
```

**Docs:**

```
docs/superpowers/plans/subprojeto-2b-e2e-checklist.md          # NEW
```

---

## Task 1: Migration — 5 RPCs de fluxo principal

**Files:**
- Create: `supabase/migrations/NNNNNNNNNNNN_scheduled_choose_driver_rpcs.sql` (timestamp posterior ao último — ver `mcp__supabase__list_migrations` pra saber)

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Descobrir timestamp**

Rodar `mcp__supabase__list_migrations` — pegar o último timestamp aplicado; usar +1 hora de folga (ex: se último foi `20260729150002`, usar `20260729160000`).

- [ ] **Step 2: Criar arquivo com o conteúdo EXATO**

```sql
-- ============================================================================
-- Migration: 5 RPCs de fluxo Escolha seu Motorista (Subprojeto 2B)
-- Padrão Flash: SECURITY DEFINER + revoke anon + guards inline + advisory lock.
-- ============================================================================

-- +goose Up

-- 1) Cliente envia solicitação direta a 1 motorista específico
CREATE OR REPLACE FUNCTION public.client_send_scheduled_direct_request(
  driver_profile_id_input uuid,
  pickup_address_id_input uuid,
  dropoff_address_id_input uuid,
  service_category_id_input uuid,
  passenger_count_input int,
  observation_input text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_trip_id uuid;
  v_provider_status text;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  -- Lock por cliente para evitar dupla submissao
  PERFORM pg_advisory_xact_lock(hashtextextended(v_client_id::text, 0));

  -- Motorista existe e aprovado
  SELECT pp.status INTO v_provider_status
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE dp.id = driver_profile_id_input;

  IF v_provider_status IS NULL THEN
    RAISE EXCEPTION 'Motorista nao encontrado';
  END IF;

  IF v_provider_status <> 'approved' THEN
    RAISE EXCEPTION 'Motorista nao aprovado';
  END IF;

  -- Guard: nao pode ter outra solicitacao Escolha pendente
  IF EXISTS (
    SELECT 1 FROM trips
     WHERE client_id = v_client_id
       AND trip_type = 'scheduled_choose_driver'
       AND status IN ('awaiting_driver_confirmation', 'awaiting_client_confirmation')
  ) THEN
    RAISE EXCEPTION 'Voce ja tem uma solicitacao pendente';
  END IF;

  -- Cria trip
  INSERT INTO trips (
    client_id, driver_profile_id, trip_type, status,
    pickup_address_id, dropoff_address_id, service_category_id,
    passenger_count, observation
  ) VALUES (
    v_client_id, driver_profile_id_input, 'scheduled_choose_driver', 'awaiting_driver_confirmation',
    pickup_address_id_input, dropoff_address_id_input, service_category_id_input,
    passenger_count_input, observation_input
  ) RETURNING id INTO v_trip_id;

  -- Insere candidato (trigger de push dispara automaticamente)
  INSERT INTO trip_driver_candidates (trip_id, driver_profile_id, status, last_push_at)
  VALUES (v_trip_id, driver_profile_id_input, 'pending', now());

  RETURN v_trip_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_send_scheduled_direct_request(uuid, uuid, uuid, uuid, int, text) TO authenticated;

-- 2) Motorista aceita com preco
CREATE OR REPLACE FUNCTION public.driver_accept_scheduled_direct(
  trip_id_input uuid,
  offered_price_input numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_driver_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF offered_price_input IS NULL OR offered_price_input <= 0 OR offered_price_input > 10000 THEN
    RAISE EXCEPTION 'Preco invalido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  -- Descobre driver_profile do usuario autenticado
  SELECT dp.id INTO v_driver_profile_id
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE pp.user_id = v_user_id;

  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao e motorista';
  END IF;

  -- Verifica que o candidato pendente e desse motorista
  IF NOT EXISTS (
    SELECT 1 FROM trip_driver_candidates
     WHERE trip_id = trip_id_input
       AND driver_profile_id = v_driver_profile_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Voce nao tem candidatura pendente nesta corrida';
  END IF;

  -- Verifica trip esta no estado certo
  IF NOT EXISTS (
    SELECT 1 FROM trips
     WHERE id = trip_id_input
       AND trip_type = 'scheduled_choose_driver'
       AND status = 'awaiting_driver_confirmation'
  ) THEN
    RAISE EXCEPTION 'Corrida nao esta aguardando resposta do motorista';
  END IF;

  UPDATE trip_driver_candidates
     SET status = 'accepted', offered_price = offered_price_input
   WHERE trip_id = trip_id_input
     AND driver_profile_id = v_driver_profile_id;

  UPDATE trips
     SET status = 'awaiting_client_confirmation', updated_at = now()
   WHERE id = trip_id_input;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_accept_scheduled_direct(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_scheduled_direct(uuid, numeric) TO authenticated;

-- 3) Motorista recusa
CREATE OR REPLACE FUNCTION public.driver_reject_scheduled_direct(trip_id_input uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_driver_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  SELECT dp.id INTO v_driver_profile_id
    FROM driver_profiles dp
    JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
   WHERE pp.user_id = v_user_id;

  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao e motorista';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trip_driver_candidates
     WHERE trip_id = trip_id_input
       AND driver_profile_id = v_driver_profile_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Voce nao tem candidatura pendente nesta corrida';
  END IF;

  UPDATE trip_driver_candidates
     SET status = 'rejected'
   WHERE trip_id = trip_id_input
     AND driver_profile_id = v_driver_profile_id;

  UPDATE trips
     SET status = 'searching_drivers', driver_profile_id = NULL, updated_at = now()
   WHERE id = trip_id_input
     AND trip_type = 'scheduled_choose_driver';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_reject_scheduled_direct(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_reject_scheduled_direct(uuid) TO authenticated;

-- 4) Cliente confirma preco proposto
CREATE OR REPLACE FUNCTION public.client_accept_scheduled_price(trip_id_input uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_offered_price numeric;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM trips
     WHERE id = trip_id_input
       AND client_id = v_client_id
       AND trip_type = 'scheduled_choose_driver'
       AND status = 'awaiting_client_confirmation'
  ) THEN
    RAISE EXCEPTION 'Corrida nao esta aguardando sua confirmacao';
  END IF;

  SELECT offered_price INTO v_offered_price
    FROM trip_driver_candidates
   WHERE trip_id = trip_id_input
     AND status = 'accepted';

  IF v_offered_price IS NULL THEN
    RAISE EXCEPTION 'Sem preco proposto para esta corrida';
  END IF;

  UPDATE trips
     SET status = 'scheduled', final_price = v_offered_price, updated_at = now()
   WHERE id = trip_id_input;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_accept_scheduled_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_accept_scheduled_price(uuid) TO authenticated;

-- 5) Cliente recusa preco proposto
CREATE OR REPLACE FUNCTION public.client_reject_scheduled_price(trip_id_input uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trip_id_input::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM trips
     WHERE id = trip_id_input
       AND client_id = v_client_id
       AND trip_type = 'scheduled_choose_driver'
       AND status = 'awaiting_client_confirmation'
  ) THEN
    RAISE EXCEPTION 'Corrida nao esta aguardando sua confirmacao';
  END IF;

  UPDATE trip_driver_candidates
     SET status = 'rejected'
   WHERE trip_id = trip_id_input
     AND status = 'accepted';

  UPDATE trips
     SET status = 'searching_drivers', driver_profile_id = NULL, updated_at = now()
   WHERE id = trip_id_input;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_reject_scheduled_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_reject_scheduled_price(uuid) TO authenticated;
```

- [ ] **Step 3: Aplicar via MCP**

`mcp__supabase__apply_migration` com nome `scheduled_choose_driver_rpcs` e o conteúdo (sem os headers de goose).

- [ ] **Step 4: Verificar RPCs criadas**

```sql
SELECT proname FROM pg_proc
 WHERE proname IN (
   'client_send_scheduled_direct_request',
   'driver_accept_scheduled_direct',
   'driver_reject_scheduled_direct',
   'client_accept_scheduled_price',
   'client_reject_scheduled_price'
 );
```

Esperado: 5 linhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/NNNNNNNNNNNN_scheduled_choose_driver_rpcs.sql
git commit -m "$(cat <<'EOF'
feat(scheduled-choose-driver): 5 RPCs SECURITY DEFINER fluxo principal

- client_send_scheduled_direct_request (cria trip + candidato pending)
- driver_accept_scheduled_direct (candidate accepted + trip awaiting_client_confirmation)
- driver_reject_scheduled_direct (candidate rejected + trip searching_drivers)
- client_accept_scheduled_price (trip scheduled + final_price)
- client_reject_scheduled_price (candidate rejected + trip searching_drivers)

Padrão Flash: revoke anon + guards inline + advisory lock por client/trip.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration — RPC de cancelamento

**Files:**
- Create: `supabase/migrations/NNNNNNNNNNNN_cancel_scheduled_choose_driver_trip_rpc.sql`

- [ ] **Step 1: Criar arquivo**

```sql
-- ============================================================================
-- Migration: cancel_scheduled_choose_driver_trip
-- Aceita cancelamento pelo cliente dono OU admin. Reject candidate + trip cancelled.
-- ============================================================================

-- +goose Up
CREATE OR REPLACE FUNCTION public.cancel_scheduled_choose_driver_trip(
  p_trip_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_trip_id::text, 0));

  SELECT client_id, status::text INTO v_client_id, v_status
    FROM trips
   WHERE id = p_trip_id
     AND trip_type = 'scheduled_choose_driver';

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Corrida nao encontrada';
  END IF;

  -- Cliente dono OU admin
  IF v_client_id <> v_user_id AND public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  IF v_status NOT IN ('awaiting_driver_confirmation', 'awaiting_client_confirmation', 'searching_drivers') THEN
    RAISE EXCEPTION 'Corrida nao pode ser cancelada no status %', v_status;
  END IF;

  UPDATE trips
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_at = now()
   WHERE id = p_trip_id;

  -- Trigger reject_candidates_when_trip_cancelled cuida do resto (existente)
  -- mas garantimos aqui tambem para candidatos pending/accepted:
  UPDATE trip_driver_candidates
     SET status = 'rejected'
   WHERE trip_id = p_trip_id
     AND status IN ('pending', 'accepted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_scheduled_choose_driver_trip(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_choose_driver_trip(uuid, text) TO authenticated;
```

- [ ] **Step 2: Aplicar via MCP**

`mcp__supabase__apply_migration` com nome `cancel_scheduled_choose_driver_trip_rpc`.

- [ ] **Step 3: Verificar**

```sql
SELECT proname FROM pg_proc WHERE proname = 'cancel_scheduled_choose_driver_trip';
```

Esperado: 1 linha.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/NNNNNNNNNNNN_cancel_scheduled_choose_driver_trip_rpc.sql
git commit -m "feat(scheduled-choose-driver): cancel_scheduled_choose_driver_trip RPC

Aceita cliente dono OU admin (padrao cancel_flash_trip mas com
trip_type='scheduled_choose_driver'). Reject candidates + status='cancelled'.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Migration — Trigger de push reconhece `scheduled_choose_driver`

**Files:**
- Create: `supabase/migrations/NNNNNNNNNNNN_push_trigger_include_scheduled_choose_driver.sql`

- [ ] **Step 1: Descobrir a função atual do trigger**

Antes de escrever a migration, ler a função existente que o trigger `trigger_push_on_candidate_insert` chama. Procurar arquivo:

Rodar via MCP:

```sql
SELECT prosrc FROM pg_proc
 WHERE proname LIKE '%push_on_candidate%' OR proname LIKE '%flash_push%'
 LIMIT 5;
```

Ou grep local: `grep -R "push_on_candidate_insert" supabase/migrations/`.

Documentar o corpo da função e adicionar branch `WHEN trip_type = 'scheduled_choose_driver' THEN ...` retornando `type='scheduled_direct_request'` e `title='📅 NOVA SOLICITAÇÃO DE AGENDAMENTO'`.

- [ ] **Step 2: Criar arquivo com CREATE OR REPLACE**

Substituir a função existente (via CREATE OR REPLACE) preservando os branches anteriores + adicionando o novo. Exemplo estrutural (adaptar ao corpo real):

```sql
-- +goose Up
CREATE OR REPLACE FUNCTION public.push_on_candidate_insert_fn()  -- nome real a descobrir no Step 1
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_type text;
  v_push_type text;
  v_push_title text;
  v_push_body text;
  v_client_name text;
BEGIN
  SELECT t.trip_type::text INTO v_trip_type FROM trips t WHERE t.id = NEW.trip_id;

  -- Descobre nome do cliente pra body
  SELECT u.full_name INTO v_client_name
    FROM trips t
    JOIN users u ON u.id = t.client_id
   WHERE t.id = NEW.trip_id;

  CASE v_trip_type
    WHEN 'flash' THEN
      v_push_type := 'flash';
      v_push_title := '⚡ CORRIDA FLASH!';
      v_push_body := COALESCE(v_client_name, 'Cliente') || ' precisa de uma viagem agora';
    WHEN 'scheduled_choose_driver' THEN
      v_push_type := 'scheduled_direct_request';
      v_push_title := '📅 NOVA SOLICITAÇÃO DE AGENDAMENTO';
      v_push_body := COALESCE(v_client_name, 'Cliente') || ' solicitou uma corrida agendada';
    ELSE
      v_push_type := 'trip_request';
      v_push_title := 'Nova solicitacao';
      v_push_body := COALESCE(v_client_name, 'Cliente') || ' criou uma corrida';
  END CASE;

  -- (chamada net.http_post ou insert em notifications — preservar do original)
  ...
  RETURN NEW;
END;
$$;
```

**IMPORTANTE:** o corpo real (chamada `net.http_post` ou `INSERT INTO notifications` ou trigger de webhook) deve ser copiado do original. Este arquivo só ADICIONA o branch `scheduled_choose_driver`. Não substituir a chamada externa.

Como o corpo depende da função existente que a migration original criou, o subagent deve:
1. Ler o corpo atual (Step 1)
2. Adicionar SÓ o branch novo, preservando o resto integralmente
3. Comitar como CREATE OR REPLACE

- [ ] **Step 3: Aplicar**

`mcp__supabase__apply_migration` com nome `push_trigger_include_scheduled_choose_driver`.

- [ ] **Step 4: Verificar via smoke**

Criar trip de teste (via UI ou SQL manual) do tipo `scheduled_choose_driver` → verificar log/notification enviado com type correto.

- [ ] **Step 5: Rodar advisors**

`mcp__supabase__get_advisors` type=security. Deve continuar sem alertas NOVOS (só o WARN existente sobre SECURITY DEFINER callable por authenticated, esperado).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/NNNNNNNNNNNN_push_trigger_include_scheduled_choose_driver.sql
git commit -m "feat(scheduled-choose-driver): trigger push reconhece novo trip_type

Adiciona branch 'scheduled_choose_driver' em push_on_candidate_insert
retornando type='scheduled_direct_request' + title AGENDAMENTO.
Preserva branches Flash e trip_request existentes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Cliente — `AvailableDriver` entity + parser + testes

**Files:**
- Create: `lib/features/scheduled_choose_driver/domain/entities/available_driver.dart`
- Create: `test/features/scheduled_choose_driver/domain/entities/available_driver_test.dart`

Working directory: `C:\Projetos\kz-servicos-app-cliente`

- [ ] **Step 1: Escrever teste**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app/features/scheduled_choose_driver/domain/entities/available_driver.dart';

void main() {
  group('AvailableDriver.fromMap', () {
    test('parseia row completo', () {
      final row = {
        'driver_profile_id': 'd1',
        'full_name': 'João Silva',
        'avatar_url': 'https://x.io/a.jpg',
        'average_rating': 4.8,
        'total_ratings': 127,
        'vehicles': [
          {
            'brand': 'Fiat',
            'model': 'Uno',
            'color': 'Prata',
            'license_plate': 'ABC1D23',
            'is_active': true,
          },
        ],
      };
      final d = AvailableDriver.fromMap(row);
      expect(d.driverProfileId, 'd1');
      expect(d.fullName, 'João Silva');
      expect(d.avatarUrl, 'https://x.io/a.jpg');
      expect(d.averageRating, 4.8);
      expect(d.totalRatings, 127);
      expect(d.vehicle?.brand, 'Fiat');
      expect(d.vehicle?.licensePlate, 'ABC1D23');
    });

    test('avatar_url null → propaga', () {
      final row = {
        'driver_profile_id': 'd1',
        'full_name': 'Maria',
        'avatar_url': null,
        'average_rating': null,
        'total_ratings': 0,
        'vehicles': [],
      };
      final d = AvailableDriver.fromMap(row);
      expect(d.avatarUrl, null);
      expect(d.averageRating, null);
      expect(d.vehicle, null);
    });

    test('vehicles vazio → vehicle null', () {
      final row = {
        'driver_profile_id': 'd1',
        'full_name': 'Ana',
        'avatar_url': null,
        'average_rating': null,
        'total_ratings': 0,
        'vehicles': [],
      };
      expect(AvailableDriver.fromMap(row).vehicle, null);
    });

    test('múltiplos vehicles → escolhe is_active=true', () {
      final row = {
        'driver_profile_id': 'd1',
        'full_name': 'N',
        'avatar_url': null,
        'average_rating': null,
        'total_ratings': 0,
        'vehicles': [
          {'brand': 'A', 'model': '1', 'color': '-', 'license_plate': 'A', 'is_active': false},
          {'brand': 'B', 'model': '2', 'color': '-', 'license_plate': 'B', 'is_active': true},
        ],
      };
      expect(AvailableDriver.fromMap(row).vehicle?.brand, 'B');
    });
  });
}
```

- [ ] **Step 2: Rodar teste (deve falhar)**

```bash
flutter test test/features/scheduled_choose_driver/domain/entities/available_driver_test.dart
```

Expected: FAIL (arquivo não encontrado).

- [ ] **Step 3: Implementar**

```dart
class DriverVehicle {
  final String brand;
  final String model;
  final String color;
  final String licensePlate;

  const DriverVehicle({
    required this.brand,
    required this.model,
    required this.color,
    required this.licensePlate,
  });
}

class AvailableDriver {
  final String driverProfileId;
  final String fullName;
  final String? avatarUrl;
  final double? averageRating;
  final int totalRatings;
  final DriverVehicle? vehicle;

  const AvailableDriver({
    required this.driverProfileId,
    required this.fullName,
    required this.avatarUrl,
    required this.averageRating,
    required this.totalRatings,
    required this.vehicle,
  });

  factory AvailableDriver.fromMap(Map<String, dynamic> row) {
    final vehiclesRaw = (row['vehicles'] as List?) ?? const [];
    final activeVehicles = vehiclesRaw
        .whereType<Map<String, dynamic>>()
        .where((v) => v['is_active'] == true)
        .toList();
    DriverVehicle? vehicle;
    if (activeVehicles.isNotEmpty) {
      final v = activeVehicles.first;
      vehicle = DriverVehicle(
        brand: v['brand'] as String? ?? '',
        model: v['model'] as String? ?? '',
        color: v['color'] as String? ?? '',
        licensePlate: v['license_plate'] as String? ?? '',
      );
    }

    return AvailableDriver(
      driverProfileId: row['driver_profile_id'] as String,
      fullName: row['full_name'] as String,
      avatarUrl: row['avatar_url'] as String?,
      averageRating: (row['average_rating'] as num?)?.toDouble(),
      totalRatings: (row['total_ratings'] as int?) ?? 0,
      vehicle: vehicle,
    );
  }
}
```

- [ ] **Step 4: Rodar teste (deve passar)**

```bash
flutter test test/features/scheduled_choose_driver/domain/entities/available_driver_test.dart
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit APENAS os 2 arquivos**

```bash
git add lib/features/scheduled_choose_driver/domain/entities/available_driver.dart test/features/scheduled_choose_driver/domain/entities/available_driver_test.dart
git commit -m "feat(scheduled-choose-driver): AvailableDriver entity + parser

Normaliza row do Supabase (snake_case + join vehicles) em modelo
camelCase. Escolhe vehicle is_active=true. Fallbacks pra avatar/rating null.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Cliente — `ScheduledDirectRequest` entity + status mapper + testes

**Files:**
- Create: `lib/features/scheduled_choose_driver/domain/entities/scheduled_direct_request.dart`
- Create: `test/features/scheduled_choose_driver/domain/entities/scheduled_direct_request_test.dart`

- [ ] **Step 1: Escrever teste**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app/features/scheduled_choose_driver/domain/entities/scheduled_direct_request.dart';

void main() {
  group('scheduledDirectStatusFrom', () {
    test('trip awaiting_driver_confirmation + candidate pending → awaitingDriver', () {
      expect(
        scheduledDirectStatusFrom(
          tripStatus: 'awaiting_driver_confirmation',
          candidateStatus: 'pending',
        ),
        ScheduledDirectStatus.awaitingDriver,
      );
    });

    test('trip awaiting_client_confirmation + candidate accepted → priceOffered', () {
      expect(
        scheduledDirectStatusFrom(
          tripStatus: 'awaiting_client_confirmation',
          candidateStatus: 'accepted',
        ),
        ScheduledDirectStatus.priceOffered,
      );
    });

    test('trip searching_drivers + candidate rejected → rejected', () {
      expect(
        scheduledDirectStatusFrom(
          tripStatus: 'searching_drivers',
          candidateStatus: 'rejected',
        ),
        ScheduledDirectStatus.rejected,
      );
    });

    test('trip scheduled → confirmed', () {
      expect(
        scheduledDirectStatusFrom(
          tripStatus: 'scheduled',
          candidateStatus: 'accepted',
        ),
        ScheduledDirectStatus.confirmed,
      );
    });

    test('trip cancelled → cancelled', () {
      expect(
        scheduledDirectStatusFrom(
          tripStatus: 'cancelled',
          candidateStatus: 'rejected',
        ),
        ScheduledDirectStatus.cancelled,
      );
    });

    test('valor desconhecido → awaitingDriver (defesa)', () {
      expect(
        scheduledDirectStatusFrom(
          tripStatus: 'unknown',
          candidateStatus: 'unknown',
        ),
        ScheduledDirectStatus.awaitingDriver,
      );
    });
  });
}
```

- [ ] **Step 2: Ver falhar**

```bash
flutter test test/features/scheduled_choose_driver/domain/entities/scheduled_direct_request_test.dart
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

```dart
enum ScheduledDirectStatus {
  awaitingDriver,
  priceOffered,
  rejected,
  confirmed,
  cancelled,
}

ScheduledDirectStatus scheduledDirectStatusFrom({
  required String tripStatus,
  required String candidateStatus,
}) {
  if (tripStatus == 'cancelled') return ScheduledDirectStatus.cancelled;
  if (tripStatus == 'scheduled') return ScheduledDirectStatus.confirmed;
  if (tripStatus == 'awaiting_client_confirmation' && candidateStatus == 'accepted') {
    return ScheduledDirectStatus.priceOffered;
  }
  if (tripStatus == 'searching_drivers' && candidateStatus == 'rejected') {
    return ScheduledDirectStatus.rejected;
  }
  if (tripStatus == 'awaiting_driver_confirmation' && candidateStatus == 'pending') {
    return ScheduledDirectStatus.awaitingDriver;
  }
  return ScheduledDirectStatus.awaitingDriver;
}

class ScheduledDirectRequest {
  final String tripId;
  final String driverProfileId;
  final ScheduledDirectStatus status;
  final double? offeredPrice;
  final String driverName;
  final String? driverAvatarUrl;

  const ScheduledDirectRequest({
    required this.tripId,
    required this.driverProfileId,
    required this.status,
    required this.offeredPrice,
    required this.driverName,
    required this.driverAvatarUrl,
  });
}
```

- [ ] **Step 4: Ver passar**

```bash
flutter test test/features/scheduled_choose_driver/domain/entities/scheduled_direct_request_test.dart
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/features/scheduled_choose_driver/domain/entities/scheduled_direct_request.dart test/features/scheduled_choose_driver/domain/entities/scheduled_direct_request_test.dart
git commit -m "feat(scheduled-choose-driver): ScheduledDirectRequest + status mapper

Enum ScheduledDirectStatus mapeia combinacoes (trip_status,
candidate_status) para 5 estados client-side.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Cliente — `AvailableDriversRepository`

**Files:**
- Create: `lib/features/scheduled_choose_driver/data/repositories/available_drivers_repository.dart`

Sem teste (fronteira Supabase — e2e cobre).

- [ ] **Step 1: Implementar**

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/available_driver.dart';

class AvailableDriversRepository {
  Future<List<AvailableDriver>> fetchApproved() async {
    final response = await Supabase.instance.client
        .from('driver_profiles')
        .select('''
          id,
          provider_profiles!inner (
            status,
            average_rating,
            total_ratings,
            users!inner ( full_name, avatar_url )
          ),
          vehicles ( brand, model, color, license_plate, is_active )
        ''')
        .eq('provider_profiles.status', 'approved');

    if (response is! List) return const [];

    return response
        .whereType<Map<String, dynamic>>()
        .map((row) {
          final providerRaw = row['provider_profiles'];
          final provider = providerRaw is Map<String, dynamic> ? providerRaw : null;
          if (provider == null) return null;
          final userRaw = provider['users'];
          final user = userRaw is Map<String, dynamic> ? userRaw : null;
          if (user == null) return null;

          final flatMap = <String, dynamic>{
            'driver_profile_id': row['id'],
            'full_name': user['full_name'],
            'avatar_url': user['avatar_url'],
            'average_rating': provider['average_rating'],
            'total_ratings': provider['total_ratings'] ?? 0,
            'vehicles': row['vehicles'] ?? const [],
          };
          return AvailableDriver.fromMap(flatMap);
        })
        .whereType<AvailableDriver>()
        .toList();
  }
}
```

- [ ] **Step 2: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/data/repositories/available_drivers_repository.dart
```

Expected: 0 issues.

- [ ] **Step 3: Commit**

```bash
git add lib/features/scheduled_choose_driver/data/repositories/available_drivers_repository.dart
git commit -m "feat(scheduled-choose-driver): AvailableDriversRepository (fetch approved)

Query com !inner join em provider_profiles + users, LEFT join vehicles.
Filtra status='approved'. Retorna List<AvailableDriver> normalizado.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Cliente — `ScheduledDirectRequestRepository` (RPC helpers)

**Files:**
- Create: `lib/features/scheduled_choose_driver/data/repositories/scheduled_direct_request_repository.dart`

Sem teste.

- [ ] **Step 1: Implementar**

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class ScheduledDirectRequestRepository {
  Future<String> sendRequest({
    required String driverProfileId,
    required String pickupAddressId,
    required String dropoffAddressId,
    required String serviceCategoryId,
    required int passengerCount,
    String? observation,
  }) async {
    final result = await Supabase.instance.client.rpc(
      'client_send_scheduled_direct_request',
      params: {
        'driver_profile_id_input': driverProfileId,
        'pickup_address_id_input': pickupAddressId,
        'dropoff_address_id_input': dropoffAddressId,
        'service_category_id_input': serviceCategoryId,
        'passenger_count_input': passengerCount,
        'observation_input': observation,
      },
    );
    return result as String;
  }

  Future<void> acceptPrice(String tripId) async {
    await Supabase.instance.client.rpc(
      'client_accept_scheduled_price',
      params: {'trip_id_input': tripId},
    );
  }

  Future<void> rejectPrice(String tripId) async {
    await Supabase.instance.client.rpc(
      'client_reject_scheduled_price',
      params: {'trip_id_input': tripId},
    );
  }

  Future<void> cancel(String tripId, String reason) async {
    await Supabase.instance.client.rpc(
      'cancel_scheduled_choose_driver_trip',
      params: {'p_trip_id': tripId, 'p_reason': reason},
    );
  }

  Future<Map<String, dynamic>?> fetchActiveRequest(String clientId) async {
    final response = await Supabase.instance.client
        .from('trips')
        .select('''
          id, driver_profile_id, status,
          driver_profiles ( provider_profiles ( users ( full_name, avatar_url ) ) ),
          trip_driver_candidates ( offered_price, status )
        ''')
        .eq('client_id', clientId)
        .eq('trip_type', 'scheduled_choose_driver')
        .inFilter('status', ['awaiting_driver_confirmation', 'awaiting_client_confirmation'])
        .limit(1)
        .maybeSingle();

    return response;
  }
}
```

- [ ] **Step 2: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/data/repositories/scheduled_direct_request_repository.dart
```

Expected: 0 issues.

- [ ] **Step 3: Commit**

```bash
git add lib/features/scheduled_choose_driver/data/repositories/scheduled_direct_request_repository.dart
git commit -m "feat(scheduled-choose-driver): ScheduledDirectRequestRepository (RPC calls)

send, acceptPrice, rejectPrice, cancel + fetchActiveRequest.
Todas chamam RPCs SECURITY DEFINER criadas nas migrations 1-2.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Cliente — `DriverCard` widget

**Files:**
- Create: `lib/features/scheduled_choose_driver/presentation/widgets/driver_card.dart`

Sem teste (widget presentational).

- [ ] **Step 1: Implementar**

```dart
import 'package:flutter/material.dart';

import '../../domain/entities/available_driver.dart';

class DriverCard extends StatelessWidget {
  const DriverCard({
    super.key,
    required this.driver,
    required this.onRequest,
    this.isLoading = false,
  });

  final AvailableDriver driver;
  final ValueChanged<String> onRequest;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final initial = driver.fullName.isEmpty ? '?' : driver.fullName[0].toUpperCase();

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundImage:
                  driver.avatarUrl != null ? NetworkImage(driver.avatarUrl!) : null,
              child: driver.avatarUrl == null ? Text(initial) : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(driver.fullName, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Row(children: [
                    const Icon(Icons.star, size: 14, color: Colors.amber),
                    const SizedBox(width: 4),
                    Text(
                      driver.averageRating == null
                          ? 'Sem avaliações'
                          : '${driver.averageRating!.toStringAsFixed(1)} (${driver.totalRatings})',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ]),
                  if (driver.vehicle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${driver.vehicle!.brand} ${driver.vehicle!.model} · ${driver.vehicle!.licensePlate}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: isLoading ? null : () => onRequest(driver.driverProfileId),
              child: const Text('Solicitar'),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/presentation/widgets/driver_card.dart
```

Expected: 0 issues.

- [ ] **Step 3: Commit**

```bash
git add lib/features/scheduled_choose_driver/presentation/widgets/driver_card.dart
git commit -m "feat(scheduled-choose-driver): DriverCard (avatar + nome + rating + veiculo + Solicitar)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Cliente — `DriverSelectionCubit` + `DriverSelectionPage`

**Files:**
- Create: `lib/features/scheduled_choose_driver/presentation/cubits/driver_selection_cubit.dart`
- Create: `lib/features/scheduled_choose_driver/presentation/pages/driver_selection_page.dart`

- [ ] **Step 1: Implementar Cubit**

```dart
// driver_selection_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/repositories/available_drivers_repository.dart';
import '../../data/repositories/scheduled_direct_request_repository.dart';
import '../../domain/entities/available_driver.dart';

sealed class DriverSelectionState {
  const DriverSelectionState();
}

class DriverSelectionInitial extends DriverSelectionState { const DriverSelectionInitial(); }
class DriverSelectionLoading extends DriverSelectionState { const DriverSelectionLoading(); }
class DriverSelectionLoaded extends DriverSelectionState {
  final List<AvailableDriver> drivers;
  final String? sendingDriverId;
  const DriverSelectionLoaded({required this.drivers, this.sendingDriverId});

  DriverSelectionLoaded copyWith({List<AvailableDriver>? drivers, String? sendingDriverId, bool clearSending = false}) {
    return DriverSelectionLoaded(
      drivers: drivers ?? this.drivers,
      sendingDriverId: clearSending ? null : (sendingDriverId ?? this.sendingDriverId),
    );
  }
}
class DriverSelectionError extends DriverSelectionState {
  final String message;
  const DriverSelectionError(this.message);
}
class DriverSelectionRequestSent extends DriverSelectionState {
  final String tripId;
  const DriverSelectionRequestSent(this.tripId);
}

class DriverSelectionCubit extends Cubit<DriverSelectionState> {
  DriverSelectionCubit({
    required AvailableDriversRepository driversRepo,
    required ScheduledDirectRequestRepository requestRepo,
    required this.pickupAddressId,
    required this.dropoffAddressId,
    required this.serviceCategoryId,
    required this.passengerCount,
    this.observation,
  })  : _driversRepo = driversRepo,
        _requestRepo = requestRepo,
        super(const DriverSelectionInitial());

  final AvailableDriversRepository _driversRepo;
  final ScheduledDirectRequestRepository _requestRepo;
  final String pickupAddressId;
  final String dropoffAddressId;
  final String serviceCategoryId;
  final int passengerCount;
  final String? observation;

  Future<void> load() async {
    emit(const DriverSelectionLoading());
    try {
      final drivers = await _driversRepo.fetchApproved();
      emit(DriverSelectionLoaded(drivers: drivers));
    } catch (e) {
      emit(DriverSelectionError(e.toString()));
    }
  }

  Future<void> request(String driverProfileId) async {
    final s = state;
    if (s is! DriverSelectionLoaded) return;
    emit(s.copyWith(sendingDriverId: driverProfileId));
    try {
      final tripId = await _requestRepo.sendRequest(
        driverProfileId: driverProfileId,
        pickupAddressId: pickupAddressId,
        dropoffAddressId: dropoffAddressId,
        serviceCategoryId: serviceCategoryId,
        passengerCount: passengerCount,
        observation: observation,
      );
      emit(DriverSelectionRequestSent(tripId));
    } catch (e) {
      emit(DriverSelectionError(e.toString()));
      emit(s.copyWith(clearSending: true));
    }
  }
}
```

- [ ] **Step 2: Implementar Page**

```dart
// driver_selection_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubits/driver_selection_cubit.dart';
import '../widgets/driver_card.dart';

class DriverSelectionPage extends StatelessWidget {
  const DriverSelectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escolha seu motorista')),
      body: BlocConsumer<DriverSelectionCubit, DriverSelectionState>(
        listener: (context, state) {
          if (state is DriverSelectionRequestSent) {
            context.go('/scheduled-choose-driver/awaiting/${state.tripId}');
          } else if (state is DriverSelectionError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Erro: ${state.message}')),
            );
          }
        },
        builder: (context, state) {
          if (state is DriverSelectionInitial) {
            context.read<DriverSelectionCubit>().load();
            return const Center(child: CircularProgressIndicator());
          }
          if (state is DriverSelectionLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is DriverSelectionLoaded) {
            if (state.drivers.isEmpty) {
              return const Center(child: Text('Nenhum motorista aprovado disponível.'));
            }
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: state.drivers.length,
              itemBuilder: (context, index) {
                final d = state.drivers[index];
                return DriverCard(
                  driver: d,
                  isLoading: state.sendingDriverId == d.driverProfileId,
                  onRequest: (id) => context.read<DriverSelectionCubit>().request(id),
                );
              },
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }
}
```

- [ ] **Step 3: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/presentation/
```

Expected: 0 issues.

- [ ] **Step 4: Commit**

```bash
git add lib/features/scheduled_choose_driver/presentation/cubits/driver_selection_cubit.dart lib/features/scheduled_choose_driver/presentation/pages/driver_selection_page.dart
git commit -m "feat(scheduled-choose-driver): DriverSelectionPage + Cubit

Lista motoristas aprovados, envia solicitacao ao selecionar,
navega para awaiting page.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Cliente — `AwaitingResponseCubit` + `AwaitingDriverResponsePage`

**Files:**
- Create: `lib/features/scheduled_choose_driver/presentation/cubits/awaiting_response_cubit.dart`
- Create: `lib/features/scheduled_choose_driver/presentation/pages/awaiting_driver_response_page.dart`

- [ ] **Step 1: Implementar Cubit**

```dart
// awaiting_response_cubit.dart
import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/repositories/scheduled_direct_request_repository.dart';
import '../../domain/entities/scheduled_direct_request.dart';

class AwaitingResponseState {
  final ScheduledDirectStatus status;
  final String driverName;
  final String? driverAvatarUrl;
  final double? offeredPrice;
  final bool cancelling;
  final String? error;

  const AwaitingResponseState({
    required this.status,
    required this.driverName,
    required this.driverAvatarUrl,
    required this.offeredPrice,
    required this.cancelling,
    required this.error,
  });

  AwaitingResponseState copyWith({
    ScheduledDirectStatus? status,
    String? driverName,
    String? driverAvatarUrl,
    double? offeredPrice,
    bool? cancelling,
    String? error,
    bool clearError = false,
  }) {
    return AwaitingResponseState(
      status: status ?? this.status,
      driverName: driverName ?? this.driverName,
      driverAvatarUrl: driverAvatarUrl ?? this.driverAvatarUrl,
      offeredPrice: offeredPrice ?? this.offeredPrice,
      cancelling: cancelling ?? this.cancelling,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AwaitingResponseCubit extends Cubit<AwaitingResponseState> {
  AwaitingResponseCubit({
    required this.tripId,
    required ScheduledDirectRequestRepository repo,
  })  : _repo = repo,
        super(const AwaitingResponseState(
          status: ScheduledDirectStatus.awaitingDriver,
          driverName: '',
          driverAvatarUrl: null,
          offeredPrice: null,
          cancelling: false,
          error: null,
        ));

  final String tripId;
  final ScheduledDirectRequestRepository _repo;
  RealtimeChannel? _channel;

  Future<void> start() async {
    await _refetch();
    _channel = Supabase.instance.client
        .channel('client-scheduled-direct-$tripId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'trips',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: tripId,
          ),
          callback: (_) => _refetch(),
        )
        .subscribe();
  }

  Future<void> _refetch() async {
    final clientId = Supabase.instance.client.auth.currentUser?.id;
    if (clientId == null) return;
    final row = await _repo.fetchActiveRequest(clientId);
    if (row == null) return;

    final providerRaw = row['driver_profiles'];
    final provider = providerRaw is Map ? providerRaw['provider_profiles'] : null;
    final userRaw = provider is Map ? provider['users'] : null;
    final candidates = (row['trip_driver_candidates'] as List?) ?? const [];
    final candidateStatus = candidates.isNotEmpty ? (candidates.first['status'] as String? ?? 'pending') : 'pending';
    final offeredPrice = candidates.isNotEmpty ? (candidates.first['offered_price'] as num?)?.toDouble() : null;

    emit(state.copyWith(
      status: scheduledDirectStatusFrom(
        tripStatus: row['status'] as String,
        candidateStatus: candidateStatus,
      ),
      driverName: (userRaw is Map ? userRaw['full_name'] as String? : null) ?? state.driverName,
      driverAvatarUrl: (userRaw is Map ? userRaw['avatar_url'] as String? : null),
      offeredPrice: offeredPrice,
      clearError: true,
    ));
  }

  Future<void> cancel(String reason) async {
    emit(state.copyWith(cancelling: true, clearError: true));
    try {
      await _repo.cancel(tripId, reason);
      emit(state.copyWith(status: ScheduledDirectStatus.cancelled, cancelling: false));
    } catch (e) {
      emit(state.copyWith(cancelling: false, error: e.toString()));
    }
  }

  @override
  Future<void> close() async {
    if (_channel != null) {
      await Supabase.instance.client.removeChannel(_channel!);
    }
    return super.close();
  }
}
```

- [ ] **Step 2: Implementar Page**

```dart
// awaiting_driver_response_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubits/awaiting_response_cubit.dart';
import '../../domain/entities/scheduled_direct_request.dart';

class AwaitingDriverResponsePage extends StatelessWidget {
  const AwaitingDriverResponsePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Aguardando resposta')),
      body: BlocConsumer<AwaitingResponseCubit, AwaitingResponseState>(
        listener: (context, state) {
          if (state.status == ScheduledDirectStatus.priceOffered) {
            final cubit = context.read<AwaitingResponseCubit>();
            context.go('/scheduled-choose-driver/price-review/${cubit.tripId}');
          } else if (state.status == ScheduledDirectStatus.rejected) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('${state.driverName} não pôde aceitar. Escolha outro.')),
            );
            context.go('/');  // volta pra home; usuário reabre fluxo se quiser
          } else if (state.status == ScheduledDirectStatus.confirmed) {
            final cubit = context.read<AwaitingResponseCubit>();
            context.go('/active-trip?tripId=${cubit.tripId}');
          }
        },
        builder: (context, state) {
          if (state.driverName.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundImage: state.driverAvatarUrl != null ? NetworkImage(state.driverAvatarUrl!) : null,
                  child: state.driverAvatarUrl == null
                      ? Text(state.driverName.isNotEmpty ? state.driverName[0].toUpperCase() : '?')
                      : null,
                ),
                const SizedBox(height: 16),
                Text('Solicitação enviada a', style: Theme.of(context).textTheme.bodyMedium),
                Text(state.driverName, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 24),
                const CircularProgressIndicator(),
                const SizedBox(height: 24),
                if (state.error != null)
                  Text(state.error!, style: const TextStyle(color: Colors.red)),
                Wrap(
                  spacing: 12,
                  children: [
                    FilledButton.tonal(
                      onPressed: () => context.go('/'),
                      child: const Text('Continuar navegando'),
                    ),
                    OutlinedButton(
                      onPressed: state.cancelling
                          ? null
                          : () => context.read<AwaitingResponseCubit>().cancel('cancelado pelo cliente'),
                      child: state.cancelling
                          ? const Text('Cancelando...')
                          : const Text('Cancelar solicitação'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 3: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/presentation/cubits/awaiting_response_cubit.dart lib/features/scheduled_choose_driver/presentation/pages/awaiting_driver_response_page.dart
```

Expected: 0 issues.

- [ ] **Step 4: Commit**

```bash
git add lib/features/scheduled_choose_driver/presentation/cubits/awaiting_response_cubit.dart lib/features/scheduled_choose_driver/presentation/pages/awaiting_driver_response_page.dart
git commit -m "feat(scheduled-choose-driver): AwaitingDriverResponsePage + Cubit

Subscribe realtime em trips filtrado por id. Refetch + emit status.
Botao 'Continuar navegando' + Cancelar solicitacao.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Cliente — `PriceOfferReviewPage`

**Files:**
- Create: `lib/features/scheduled_choose_driver/presentation/pages/price_offer_review_page.dart`

- [ ] **Step 1: Implementar**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubits/awaiting_response_cubit.dart';
import '../../data/repositories/scheduled_direct_request_repository.dart';

class PriceOfferReviewPage extends StatefulWidget {
  const PriceOfferReviewPage({super.key, required this.tripId});

  final String tripId;

  @override
  State<PriceOfferReviewPage> createState() => _PriceOfferReviewPageState();
}

class _PriceOfferReviewPageState extends State<PriceOfferReviewPage> {
  bool _busy = false;
  String? _error;

  final _repo = ScheduledDirectRequestRepository();

  Future<void> _accept() async {
    setState(() { _busy = true; _error = null; });
    try {
      await _repo.acceptPrice(widget.tripId);
      if (mounted) context.go('/active-trip?tripId=${widget.tripId}');
    } catch (e) {
      setState(() { _error = e.toString(); _busy = false; });
    }
  }

  Future<void> _reject() async {
    setState(() { _busy = true; _error = null; });
    try {
      await _repo.rejectPrice(widget.tripId);
      if (mounted) context.go('/');
    } catch (e) {
      setState(() { _error = e.toString(); _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Proposta de preço')),
      body: BlocBuilder<AwaitingResponseCubit, AwaitingResponseState>(
        builder: (context, state) {
          if (state.offeredPrice == null) {
            return const Center(child: CircularProgressIndicator());
          }
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(state.driverName, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 12),
                Text('Propôs o valor de', style: Theme.of(context).textTheme.bodyMedium),
                Text('R\$ ${state.offeredPrice!.toStringAsFixed(2)}',
                    style: Theme.of(context).textTheme.displayMedium),
                const SizedBox(height: 32),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!, style: const TextStyle(color: Colors.red)),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    OutlinedButton(
                      onPressed: _busy ? null : _reject,
                      child: const Text('Recusar preço'),
                    ),
                    const SizedBox(width: 16),
                    FilledButton(
                      onPressed: _busy ? null : _accept,
                      child: const Text('Confirmar corrida'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 2: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/presentation/pages/price_offer_review_page.dart
```

Expected: 0 issues.

- [ ] **Step 3: Commit**

```bash
git add lib/features/scheduled_choose_driver/presentation/pages/price_offer_review_page.dart
git commit -m "feat(scheduled-choose-driver): PriceOfferReviewPage

Mostra preco proposto pelo motorista. Botoes Confirmar (RPC accept)
ou Recusar preco (RPC reject). Navega para active-trip ou home.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Cliente — `ActiveRequestBanner`

**Files:**
- Create: `lib/features/scheduled_choose_driver/presentation/widgets/active_request_banner.dart`

- [ ] **Step 1: Implementar**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ActiveRequestBanner extends StatelessWidget {
  const ActiveRequestBanner({
    super.key,
    required this.driverName,
    required this.tripId,
  });

  final String driverName;
  final String tripId;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.amber.shade100,
      child: InkWell(
        onTap: () => context.go('/scheduled-choose-driver/awaiting/$tripId'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
          child: Row(
            children: [
              const Icon(Icons.hourglass_top, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Aguardando resposta de $driverName',
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
              const Icon(Icons.chevron_right, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Analyzer**

```bash
flutter analyze lib/features/scheduled_choose_driver/presentation/widgets/active_request_banner.dart
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/scheduled_choose_driver/presentation/widgets/active_request_banner.dart
git commit -m "feat(scheduled-choose-driver): ActiveRequestBanner discreto no home

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Cliente — Wire tudo: router + sheet ativa + banner integration

**Files:**
- Modify: `lib/routes/app_router.dart`
- Modify: `lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart`
- Modify: `lib/features/trip/presentation/pages/trip_home_page.dart`

- [ ] **Step 1: Adicionar 3 rotas em `app_router.dart`**

Ler as rotas existentes (padrão `/flash/searching/:tripId`). Adicionar dentro do array de routes:

```dart
GoRoute(
  path: '/scheduled-choose-driver/:tripId',
  builder: (context, state) {
    final tripId = state.pathParameters['tripId']!;
    // tripId é usado só como "existe pendente?" — ignorar por hora, pode passar contexto via extra
    final extra = state.extra as Map<String, dynamic>? ?? const {};
    return BlocProvider(
      create: (_) => DriverSelectionCubit(
        driversRepo: AvailableDriversRepository(),
        requestRepo: ScheduledDirectRequestRepository(),
        pickupAddressId: extra['pickupAddressId'] as String,
        dropoffAddressId: extra['dropoffAddressId'] as String,
        serviceCategoryId: extra['serviceCategoryId'] as String,
        passengerCount: extra['passengerCount'] as int,
        observation: extra['observation'] as String?,
      ),
      child: const DriverSelectionPage(),
    );
  },
),
GoRoute(
  path: '/scheduled-choose-driver/awaiting/:tripId',
  builder: (context, state) {
    final tripId = state.pathParameters['tripId']!;
    return BlocProvider(
      create: (_) => AwaitingResponseCubit(
        tripId: tripId,
        repo: ScheduledDirectRequestRepository(),
      )..start(),
      child: const AwaitingDriverResponsePage(),
    );
  },
),
GoRoute(
  path: '/scheduled-choose-driver/price-review/:tripId',
  builder: (context, state) {
    final tripId = state.pathParameters['tripId']!;
    return BlocProvider(
      create: (_) => AwaitingResponseCubit(
        tripId: tripId,
        repo: ScheduledDirectRequestRepository(),
      )..start(),
      child: PriceOfferReviewPage(tripId: tripId),
    );
  },
),
```

Adicionar imports no topo de `app_router.dart`:

```dart
import '../features/scheduled_choose_driver/data/repositories/available_drivers_repository.dart';
import '../features/scheduled_choose_driver/data/repositories/scheduled_direct_request_repository.dart';
import '../features/scheduled_choose_driver/presentation/cubits/awaiting_response_cubit.dart';
import '../features/scheduled_choose_driver/presentation/cubits/driver_selection_cubit.dart';
import '../features/scheduled_choose_driver/presentation/pages/awaiting_driver_response_page.dart';
import '../features/scheduled_choose_driver/presentation/pages/driver_selection_page.dart';
import '../features/scheduled_choose_driver/presentation/pages/price_offer_review_page.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
```

- [ ] **Step 2: Ativar opção "Escolha seu motorista" em `scheduled_mode_choice_sheet.dart`**

Ler o arquivo — localizar o comentário `// TODO Subprojeto 2B: adicionar ListTile "Escolha seu motorista"`. Substituir por um `ListTile` adicional entre o de Cotação e o botão Akira:

```dart
ListTile(
  leading: const Text('👤', style: TextStyle(fontSize: 28)),
  title: const Text('Escolha seu motorista'),
  subtitle: const Text('Selecione um motorista aprovado da sua confiança'),
  onTap: () => Navigator.of(context).pop('scheduled_choose_driver'),
),
```

- [ ] **Step 3: Tratar `scheduled_choose_driver` em `trip_home_page.dart`**

Ler o método `_openSearch` (modificado no 2A). No branch onde `secondChoice` do sub-sheet retorna, adicionar tratamento:

```dart
if (secondChoice == 'scheduled_choose_driver') {
  // ... executar o fluxo scheduled ATÉ o ponto onde temos endereços + detalhes
  //     (usar mesmo picker e detalhes do Cotação)
  // Ao final, em vez de criar trip direto, navegar para DriverSelectionPage:
  context.push('/scheduled-choose-driver/pending', extra: {
    'pickupAddressId': pickupAddressId,
    'dropoffAddressId': dropoffAddressId,
    'serviceCategoryId': serviceCategoryId,
    'passengerCount': passengerCount,
    'observation': observation,
  });
  return;
}
```

**Nota:** o path `/scheduled-choose-driver/pending` usa "pending" como tripId placeholder — a rota consome só `extra`. Ajustar se preferir path sem parâmetro (ex: `/scheduled-choose-driver/select`).

Se o cliente já tem solicitação pendente (guard "1 por vez"), fetch antes:

```dart
final activeRequest = await ScheduledDirectRequestRepository()
    .fetchActiveRequest(Supabase.instance.client.auth.currentUser!.id);
if (activeRequest != null) {
  final existingTripId = activeRequest['id'] as String;
  context.go('/scheduled-choose-driver/awaiting/$existingTripId');
  return;
}
```

Adicionar `ActiveRequestBanner` no build do `trip_home_page` (topo do body):

```dart
// dentro do build, no topo do body
FutureBuilder<Map<String, dynamic>?>(
  future: ScheduledDirectRequestRepository()
      .fetchActiveRequest(Supabase.instance.client.auth.currentUser?.id ?? ''),
  builder: (context, snap) {
    final row = snap.data;
    if (row == null) return const SizedBox.shrink();
    final tripId = row['id'] as String;
    final provider = row['driver_profiles'] is Map ? row['driver_profiles']['provider_profiles'] : null;
    final user = provider is Map ? provider['users'] : null;
    final name = user is Map ? (user['full_name'] as String? ?? '') : '';
    return ActiveRequestBanner(driverName: name, tripId: tripId);
  },
),
```

- [ ] **Step 4: Analyzer**

```bash
flutter analyze lib/routes/app_router.dart lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart lib/features/trip/presentation/pages/trip_home_page.dart
```

Expected: 0 issues NOVOS.

- [ ] **Step 5: Commit**

```bash
git add lib/routes/app_router.dart lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "feat(scheduled-choose-driver): wire router + ativa opcao no sheet + banner home

- 3 rotas GoRoute novas: select, awaiting, price-review.
- ScheduledModeChoiceSheet mostra ListTile 'Escolha seu motorista' (remove TODO).
- trip_home_page._openSearch trata secondChoice='scheduled_choose_driver'
  (guard 1-pendente + push com extra) + ActiveRequestBanner FutureBuilder.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Prestador — `ScheduledDirectRepository`

**Files:**
- Create: `lib/features/schedules/data/repositories/scheduled_direct_repository.dart`

Working directory: `C:\Projetos\kz-servicos-app-prestador`

- [ ] **Step 1: Implementar**

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class ScheduledDirectRepository {
  Future<void> acceptWithPrice(String tripId, double price) async {
    await Supabase.instance.client.rpc(
      'driver_accept_scheduled_direct',
      params: {'trip_id_input': tripId, 'offered_price_input': price},
    );
  }

  Future<void> reject(String tripId) async {
    await Supabase.instance.client.rpc(
      'driver_reject_scheduled_direct',
      params: {'trip_id_input': tripId},
    );
  }
}
```

- [ ] **Step 2: Analyzer**

```bash
flutter analyze lib/features/schedules/data/repositories/scheduled_direct_repository.dart
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/schedules/data/repositories/scheduled_direct_repository.dart
git commit -m "feat(scheduled-choose-driver): ScheduledDirectRepository (prestador RPCs)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Prestador — `PriceOfferDialog` + `ScheduledDirectRequestCard`

**Files:**
- Create: `lib/features/schedules/presentation/dialogs/price_offer_dialog.dart`
- Create: `lib/features/schedules/presentation/widgets/scheduled_direct_request_card.dart`

- [ ] **Step 1: Implementar `PriceOfferDialog`** (wrapper reusando FlashPriceInput se preferir; aqui inline pra evitar import circular)

```dart
import 'package:flutter/material.dart';

class PriceOfferDialog extends StatefulWidget {
  const PriceOfferDialog({super.key});

  @override
  State<PriceOfferDialog> createState() => _PriceOfferDialogState();
}

class _PriceOfferDialogState extends State<PriceOfferDialog> {
  final _controller = TextEditingController();
  String? _error;

  void _submit() {
    final raw = _controller.text.replaceAll(',', '.').trim();
    final parsed = double.tryParse(raw);
    if (parsed == null || parsed <= 0 || parsed > 10000) {
      setState(() => _error = 'Valor deve ser entre R\$ 0,01 e R\$ 10.000');
      return;
    }
    Navigator.of(context).pop(parsed);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Proponha o valor da corrida'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              prefixText: 'R\$ ',
              errorText: _error,
            ),
            autofocus: true,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _submit, child: const Text('Enviar proposta')),
      ],
    );
  }
}
```

- [ ] **Step 2: Implementar `ScheduledDirectRequestCard`**

```dart
import 'package:flutter/material.dart';

import '../dialogs/price_offer_dialog.dart';

class ScheduledDirectRequestCard extends StatelessWidget {
  const ScheduledDirectRequestCard({
    super.key,
    required this.tripId,
    required this.clientName,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.onAcceptWithPrice,
    required this.onReject,
  });

  final String tripId;
  final String clientName;
  final String pickupAddress;
  final String dropoffAddress;
  final Future<void> Function(double price) onAcceptWithPrice;
  final Future<void> Function() onReject;

  Future<void> _openPriceDialog(BuildContext context) async {
    final price = await showDialog<double>(
      context: context,
      builder: (_) => const PriceOfferDialog(),
    );
    if (price != null) {
      await onAcceptWithPrice(price);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Chip(
              label: Text('📅 AGENDAMENTO — NOVA'),
              backgroundColor: Color(0xFFFEF3C7),
            ),
            const SizedBox(height: 8),
            Text('Cliente: $clientName', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('De: $pickupAddress'),
            Text('Para: $dropoffAddress'),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () => onReject(),
                  child: const Text('Recusar'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () => _openPriceDialog(context),
                  child: const Text('Aceitar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Analyzer**

```bash
flutter analyze lib/features/schedules/presentation/dialogs/price_offer_dialog.dart lib/features/schedules/presentation/widgets/scheduled_direct_request_card.dart
```

- [ ] **Step 4: Commit**

```bash
git add lib/features/schedules/presentation/dialogs/price_offer_dialog.dart lib/features/schedules/presentation/widgets/scheduled_direct_request_card.dart
git commit -m "feat(scheduled-choose-driver): PriceOfferDialog + ScheduledDirectRequestCard prestador

Dialog aceita valor 0.01-10000. Card com badge AGENDAMENTO + Aceitar/Recusar.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: Prestador — Integrar em `schedules_page.dart`

**Files:**
- Modify: `lib/features/schedules/presentation/pages/schedules_page.dart`

- [ ] **Step 1: Ler o arquivo completo pra entender estrutura**

Especial atenção a:
- Como carrega trips hoje (linhas ~22-25 do report inicial)
- Realtime channels (linhas ~47-91)
- Padrão de renderizar cards

- [ ] **Step 2: Adicionar fetch de solicitações Escolha pendentes**

Adicionar novo método/state que faz query:

```dart
Future<List<Map<String, dynamic>>> _fetchDirectRequests(String driverId) async {
  final response = await Supabase.instance.client
      .from('trip_driver_candidates')
      .select('''
        trip_id, status,
        trips!inner (
          id, client_id, trip_type, status,
          pickup_address:pickup_address_id ( street, number, neighborhood ),
          dropoff_address:dropoff_address_id ( street, number, neighborhood ),
          users:client_id ( full_name )
        )
      ''')
      .eq('driver_profile_id', driverId)
      .eq('status', 'pending')
      .eq('trips.trip_type', 'scheduled_choose_driver')
      .eq('trips.status', 'awaiting_driver_confirmation');

  if (response is! List) return const [];
  return response.whereType<Map<String, dynamic>>().toList();
}
```

- [ ] **Step 3: Renderizar `ScheduledDirectRequestCard` para cada solicitação pendente**

Na seção onde o carousel/lista de trips é renderizada, adicionar seção nova para direct requests. Cada card conecta a callbacks que chamam `ScheduledDirectRepository`:

```dart
...directRequests.map((row) {
  final trip = row['trips'] as Map<String, dynamic>;
  final client = trip['users'] as Map<String, dynamic>?;
  final pickup = trip['pickup_address'] as Map<String, dynamic>?;
  final dropoff = trip['dropoff_address'] as Map<String, dynamic>?;

  return ScheduledDirectRequestCard(
    tripId: trip['id'] as String,
    clientName: client?['full_name'] as String? ?? 'Cliente',
    pickupAddress: _formatAddress(pickup),
    dropoffAddress: _formatAddress(dropoff),
    onAcceptWithPrice: (price) async {
      await ScheduledDirectRepository().acceptWithPrice(trip['id'] as String, price);
      await _reload();
    },
    onReject: () async {
      await ScheduledDirectRepository().reject(trip['id'] as String);
      await _reload();
    },
  );
}),
```

Helper local:
```dart
String _formatAddress(Map<String, dynamic>? addr) {
  if (addr == null) return '—';
  return '${addr['street'] ?? ''}, ${addr['number'] ?? ''} — ${addr['neighborhood'] ?? ''}';
}
```

- [ ] **Step 4: Adicionar realtime pra recebi solicitação nova**

Estender o handler existente do canal `trip_driver_candidates` filtrado por driver_profile_id: quando insert de status='pending' + trip é scheduled_choose_driver, chamar `_reload()`.

O canal atual já filtra por driver_profile_id (report inicial linhas 47-91). Só garantir que `_reload()` refetcha directRequests também.

- [ ] **Step 5: Analyzer + smoke build**

```bash
flutter analyze lib/features/schedules/presentation/pages/schedules_page.dart
```

- [ ] **Step 6: Commit**

```bash
git add lib/features/schedules/presentation/pages/schedules_page.dart
git commit -m "feat(scheduled-choose-driver): renderizar Direct Requests em schedules_page

Fetch trip_driver_candidates pending + trip_type=scheduled_choose_driver.
Cada solicitacao vira ScheduledDirectRequestCard com Aceitar (dialog preco)
ou Recusar. Reload apos acao.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: Prestador — Push routing

**Files:**
- Modify: `lib/core/services/push_notification_service.dart`

- [ ] **Step 1: Ler o método `buildOpenedMessageLocation` (ou equivalente)**

Grep `type == 'flash'` ou `case 'trip_request'` no arquivo. Localizar o switch/if-chain que roteia por type.

- [ ] **Step 2: Adicionar caso `scheduled_direct_request` e `scheduled_direct_confirmed`**

```dart
if (type == 'scheduled_direct_request' || type == 'scheduled_direct_confirmed') {
  final tripId = data['tripId'] as String?;
  return tripId != null ? '/schedules?tripId=$tripId' : '/schedules';
}
```

Inserir no lugar apropriado (antes do fallback `/home` ou onde os outros tipos são tratados).

- [ ] **Step 3: Marcar tipo como persistent (som + vibração)**

Se existe uma lista/set de "persistent types" (linhas ~148-157 do report inicial), adicionar `'scheduled_direct_request'`.

- [ ] **Step 4: Analyzer**

```bash
flutter analyze lib/core/services/push_notification_service.dart
```

- [ ] **Step 5: Commit**

```bash
git add lib/core/services/push_notification_service.dart
git commit -m "feat(scheduled-choose-driver): push routing scheduled_direct_request

Deep link para /schedules?tripId=<uuid>. Persistente (som+vibra).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 18: Admin — filtro + badge + TripDetailModal + isChooseDriverTrip

**Files:**
- Modify: `src/lib/trip-status.ts`
- Modify: `src/lib/trip-status.test.ts`
- Modify: `src/app/(dashboard)/viagens/page.tsx`
- Modify: `src/components/TripDetailModal.tsx`
- Create: `src/lib/scheduled-direct.ts`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Adicionar `isChooseDriverTrip`**

Em `src/lib/trip-status.ts`, depois de `isQuotationTrip`:

```typescript
export function isChooseDriverTrip(trip: { trip_type?: string | null } | null | undefined): boolean {
  return trip?.trip_type === "scheduled_choose_driver";
}
```

- [ ] **Step 2: Adicionar 2 testes**

Em `src/lib/trip-status.test.ts`:

```typescript
import { isChooseDriverTrip } from "./trip-status.ts";

test("isChooseDriverTrip returns true for trip_type=scheduled_choose_driver", () => {
  assert.equal(isChooseDriverTrip({ trip_type: "scheduled_choose_driver" }), true);
});

test("isChooseDriverTrip returns false for other trip_types", () => {
  assert.equal(isChooseDriverTrip({ trip_type: "standard" }), false);
  assert.equal(isChooseDriverTrip({ trip_type: "scheduled_quote" }), false);
  assert.equal(isChooseDriverTrip(null), false);
  assert.equal(isChooseDriverTrip({}), false);
});
```

Ajustar o import da linha superior se já tem `isFlashTrip, isQuotationTrip` — adicionar `isChooseDriverTrip`.

- [ ] **Step 3: Rodar testes**

```bash
npx tsx --test src/lib/trip-status.test.ts
```

Expected: PASS — todos existentes + 2 novos.

- [ ] **Step 4: Adicionar opção "👤 Escolha Motorista" ao dropdown de `/viagens`**

Em `src/app/(dashboard)/viagens/page.tsx`, localizar o `<select>` (~linhas 322-335). Adicionar opção logo após "💰 Cotação":

```tsx
<option value="scheduled_choose_driver">👤 Escolha Motorista</option>
```

- [ ] **Step 5: Adicionar badge no card**

Localizar o encadeamento condicional (~linhas 270-280) que hoje tem `isFlashTrip` + `isQuotationTrip`:

```typescript
...(isFlashTrip(t)
  ? { tag: "⚡ FLASH", tagColor: "#facc15" }
  : isQuotationTrip(t)
  ? { tag: "💰 COTAÇÃO", tagColor: "#10B981" }
  : isChooseDriverTrip(t)
  ? { tag: "👤 ESCOLHA MOTORISTA", tagColor: "#8B5CF6" }
  : t.is_round_trip
  ? { tag: "Ida e volta", tagColor: "#2261FE" }
  : ...
```

Adicionar `isChooseDriverTrip` ao import de `@/lib/trip-status`.

- [ ] **Step 6: Criar `scheduled-direct.ts` (helper cancel emergência admin)**

```typescript
import { supabase } from "@/lib/supabase";

export async function cancelScheduledChooseDriverTrip(tripId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_scheduled_choose_driver_trip", {
    p_trip_id: tripId,
    p_reason: reason,
  });
  if (error) throw error;
}
```

- [ ] **Step 7: Adicionar branch `isScheduledChooseDriver` em `TripDetailModal.tsx`**

Ler o arquivo. Localizar `const isFlash = isFlashTrip(trip)` (~linha 430). Depois:

```typescript
const isScheduledChooseDriver = isChooseDriverTrip(trip);
```

Onde renderiza ações, se `isScheduledChooseDriver`, mostrar apenas botão "Cancelar (emergência)" que chama `cancelScheduledChooseDriverTrip` com prompt de motivo:

```tsx
{isScheduledChooseDriver && (
  <button
    onClick={async () => {
      const reason = window.prompt("Motivo do cancelamento (emergência):");
      if (!reason) return;
      try {
        await cancelScheduledChooseDriverTrip(trip.id, reason);
        onUpdate?.();
        onClose();
      } catch (e) {
        alert(`Erro: ${e instanceof Error ? e.message : String(e)}`);
      }
    }}
    className="px-4 py-2 bg-red-600 text-white rounded"
  >
    Cancelar (emergência)
  </button>
)}
```

Adicionar imports:
```typescript
import { isChooseDriverTrip } from "@/lib/trip-status";
import { cancelScheduledChooseDriverTrip } from "@/lib/scheduled-direct";
```

**Escopo do modal nesta iteração:** APENAS o botão "Cancelar (emergência)" quando `isScheduledChooseDriver`. Detalhes ricos do candidato (nome do motorista, preço proposto, status) ficam como débito documentado no e2e checklist — não implementar aqui pra não estourar o escopo. O `fetchTripById` atual pode não trazer candidatos; deixar essa query pra uma iteração dedicada de UX admin.

- [ ] **Step 8: Verificar build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/trip-status.ts src/lib/trip-status.test.ts "src/app/(dashboard)/viagens/page.tsx" src/components/TripDetailModal.tsx src/lib/scheduled-direct.ts
git commit -m "feat(scheduled-choose-driver): admin filtro/badge/modal + isChooseDriverTrip

- isChooseDriverTrip helper + 2 testes
- Dropdown /viagens: opcao 👤 Escolha Motorista
- Badge roxo (#8B5CF6) nos cards
- TripDetailModal: branch scheduled_choose_driver com botao Cancelar (emergencia)
- scheduled-direct.ts helper cancelScheduledChooseDriverTrip

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 19: E2E checklist + verificação global

**Files:**
- Create: `docs/superpowers/plans/subprojeto-2b-e2e-checklist.md`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Escrever checklist**

Conteúdo:

````markdown
# Subprojeto 2B — Escolha seu Motorista — Checklist manual e2e

**Pré-requisitos:**
- 3 migrations aplicadas (`20260729160000+`) via MCP em dev/staging.
- App admin rodando (`npm run dev`).
- App cliente Flutter + prestador Flutter buildados em 2 devices/emuladores.
- 1 cliente autenticado; 2 motoristas aprovados autenticados no prestador; 1 admin.

---

## Cenário 1 — Cliente escolhe e envia (happy path)

1. Cliente: barra de endereço → Corrida Agendada → **Escolha seu motorista**.
2. Segue picker (endereços + detalhes) → tela `DriverSelectionPage`.
3. Lista mostra motorista 1 e 2 aprovados com foto/nome/rating/veículo.
4. Tap **Solicitar** no motorista 1 → navega para `AwaitingDriverResponsePage`.

### SQL

```sql
SELECT id, status, trip_type, driver_profile_id FROM trips ORDER BY created_at DESC LIMIT 1;
SELECT status, driver_profile_id FROM trip_driver_candidates ORDER BY created_at DESC LIMIT 1;
```

Esperado: trip `status='awaiting_driver_confirmation'`, `trip_type='scheduled_choose_driver'`, `driver_profile_id=<motorista1>`. Candidate `pending`.

---

## Cenário 2 — Motorista aceita com preço

1. Motorista 1: recebe push `📅 NOVA SOLICITAÇÃO DE AGENDAMENTO`.
2. Toca push → abre `/schedules?tripId=<uuid>`.
3. Vê card "AGENDAMENTO — NOVA" com dados.
4. Tap **Aceitar** → dialog de preço → digita R$ 40 → **Enviar proposta**.
5. Card some da lista (candidate accepted).

### SQL

```sql
SELECT status FROM trips WHERE id='<uuid>';
SELECT status, offered_price FROM trip_driver_candidates WHERE trip_id='<uuid>';
```

Esperado: trip `awaiting_client_confirmation`; candidate `accepted`, `offered_price=40.00`.

---

## Cenário 3 — Cliente confirma preço

1. Cliente: recebe push "Motorista aceitou! Confirme o valor".
2. Cliente (ainda em `AwaitingDriverResponsePage`) → status muda para `priceOffered` via realtime → navega para `PriceOfferReviewPage`.
3. Vê "R$ 40,00" grande + botões Recusar/Confirmar.
4. Tap **Confirmar corrida** → RPC → navega para `/active-trip?tripId=<uuid>`.

### SQL

```sql
SELECT status, final_price FROM trips WHERE id='<uuid>';
```

Esperado: `scheduled`, `final_price=40.00`.

---

## Cenário 4 — Motorista recusa

1. Repetir Cenário 1 (nova solicitação, motorista 1 escolhido).
2. Motorista 1: tap **Recusar** → RPC → card some.
3. Cliente: push "Motorista indisponível" → volta para home com snackbar.

### SQL

```sql
SELECT status, driver_profile_id FROM trips WHERE id='<uuid>';
SELECT status FROM trip_driver_candidates WHERE trip_id='<uuid>';
```

Esperado: trip `searching_drivers`, `driver_profile_id=NULL`. Candidate `rejected`.

---

## Cenário 5 — Cliente cancela pendente

1. Cliente cria solicitação (Cenário 1 até passo 4).
2. Cliente em `AwaitingDriverResponsePage` → tap **Cancelar solicitação**.
3. Motorista: candidate desaparece de Agendamentos.

### SQL

```sql
SELECT status FROM trips WHERE id='<uuid>';
```

Esperado: `cancelled`, `cancelled_at NOT NULL`.

---

## Cenário 6 — Guard "só 1 pendente"

1. Cliente tem 1 solicitação `awaiting_driver_confirmation` ativa.
2. Cliente tenta abrir novo fluxo Escolha seu Motorista → deve ser redirecionado para `AwaitingDriverResponsePage` daquela trip.
3. Se tentar direto via SQL/RPC → RPC lança `'Voce ja tem uma solicitacao pendente'`.

---

## Cenário 7 — Admin badge + filtro

1. Admin abre `/viagens`.
2. Dropdown de filtro tem opção **👤 Escolha Motorista**.
3. Trips do Cenário 1/2 aparecem com badge **👤 ESCOLHA MOTORISTA** (roxo).
4. Clicar card → modal abre → botão **Cancelar (emergência)** disponível.
5. Cancelar via admin → trip `cancelled`.

---

## Cenário 8 — Cliente recusa preço

1. Repetir até Cenário 3 passo 3 (na `PriceOfferReviewPage` com preço proposto).
2. Cliente tap **Recusar preço** → RPC → volta para `/`.
3. Motorista: candidate volta para `rejected`.

### SQL

```sql
SELECT status FROM trips WHERE id='<uuid>';
```

Esperado: `searching_drivers`, driver_profile_id NULL.

---

## Cenário 9 — Banner discreto no home

1. Cliente tem solicitação pendente.
2. Volta ao home (via "Continuar navegando").
3. Banner amarelo topo mostra "Aguardando resposta de <motorista>".
4. Tap no banner → volta para `AwaitingDriverResponsePage`.

---

## Regressão

- [ ] Flash: fluxo Cenário 1-5 do checklist do Flash (`flash-e2e-checklist.md`) continua íntegro.
- [ ] Cotação (2A): opção continua funcionando no sub-sheet, cria trip `scheduled_quote`.
- [ ] Sub-sheet mostra AGORA 3 items: Cotação + Escolha seu motorista + Falar com Akira (não mais TODO).
- [ ] Push type `trip_request` (standard) ainda roteia normalmente no prestador.
- [ ] Advisor Supabase limpo (só WARN esperado sobre SECURITY DEFINER).

---

## Débitos identificados

- [ ] Chat prévio antes de solicitar — Subprojeto 5 ou backlog
- [ ] Timeout server-side para requests pendentes (cron)
- [ ] Múltiplas solicitações paralelas
- [ ] Contra-proposta de preço pelo cliente
- [ ] Ranking/ordenação da lista de motoristas
- [ ] Filtro por categoria de veículo
- [ ] Ocultação persistente de motoristas que recusaram
- [ ] TripDetailModal do admin: mostrar candidate details (nome motorista, preço proposto, status detalhado) — hoje só tem cancelamento
- [ ] Notif ao cliente se ninguém aceitar em X min

---

## Execução

- [ ] Cenário 1 — Happy path envio
- [ ] Cenário 2 — Aceite com preço
- [ ] Cenário 3 — Cliente confirma preço
- [ ] Cenário 4 — Motorista recusa
- [ ] Cenário 5 — Cliente cancela pendente
- [ ] Cenário 6 — Guard 1-pendente
- [ ] Cenário 7 — Admin badge + filtro + cancelamento emergência
- [ ] Cenário 8 — Cliente recusa preço
- [ ] Cenário 9 — Banner home
- [ ] Regressão
- [ ] Registrar bugs em `docs/superpowers/plans/subprojeto-2b-e2e-bugs.md`
````

- [ ] **Step 2: Rodar TODOS os testes**

Admin:
```bash
cd C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork
npx tsx --test src/lib/trip-status.test.ts
```

Cliente:
```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter test test/features/scheduled_choose_driver/
```

Expected: 4 (available_driver) + 6 (scheduled_direct_request) = 10 tests passing no cliente.

- [ ] **Step 3: Build admin + Flutter analyze**

```bash
cd C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork
npm run build
```

```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter analyze
```

```bash
cd C:\Projetos\kz-servicos-app-prestador
flutter analyze
```

Expected: 0 issues NOVOS.

- [ ] **Step 4: Advisor Supabase final**

`mcp__supabase__get_advisors` type=security. Sem alertas novos.

- [ ] **Step 5: Commit**

```bash
cd C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork
git add docs/superpowers/plans/subprojeto-2b-e2e-checklist.md
git commit -m "docs(scheduled-choose-driver): checklist manual e2e Subprojeto 2B

9 cenarios (envio, aceite com preco, confirma preco, recusas, cancelamento
cliente, guard 1-pendente, admin, recusa preco cliente, banner home).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Verificação global pós-execução

- [ ] Admin: ~4 commits (Tasks 1-3 + 18 + 19)
- [ ] Cliente: ~10 commits (Tasks 4-13)
- [ ] Prestador: ~4 commits (Tasks 14-17)
- [ ] Suites puras verdes nos 3 codebases
- [ ] Build admin limpo
- [ ] Flutter analyze sem issues novos em ambos apps
- [ ] Advisor Supabase limpo (só WARN esperado)
- [ ] E2E checklist executado ao menos parcialmente (Cenários 1-3 mínimos) antes de rollout em prod
