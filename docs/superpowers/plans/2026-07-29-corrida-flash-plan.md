# Corrida Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Corrida Flash flow (subprojeto 1 de 6): novo tipo de trip instantânea (`trip_type='flash'`), dispatch automático a todos motoristas aprovados sem aprovação admin, propostas com preço livre, cliente escolhe, motorista faz re-check, redispatch automático quem recusou.

**Architecture:** Reusa a tabela `trips` com discriminator `trip_type`, reusa todo o schema de `trip_driver_candidates`, `driver_locations`, execução (`advance_trip_execution`), chat e push. Novo enum + coluna + 7 RPCs SECURITY DEFINER. Push OneSignal recebe payload adaptado. Cliente Flutter usa BLoC/Cubit (padrão existente). Prestador Flutter usa StatefulWidget + service direto (padrão existente). Admin Next.js só ganha badge + guarda de botões.

**Tech Stack:**
- Supabase Postgres 15 (goose migrations), pgTAP para testes, `pg_net` p/ HTTP a edge functions.
- Deno edge functions p/ OneSignal.
- Next.js 14+ (admin) — Jest + RTL.
- Flutter 3.x (cliente + prestador) — flutter_test + bloc_test + mocktail.
- OneSignal p/ push notifications.

**Referência:** spec `docs/superpowers/specs/2026-07-29-corrida-flash-design.md`.

**Codebases:**
- `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork` (admin, este repo, contém `supabase/migrations` de referência)
- `C:\Projetos\kz-servicos-app-cliente`
- `C:\Projetos\kz-servicos-app-prestador`

**Convenção de commit:** commits Conventional (`feat:`, `fix:`, `test:`, `chore:`) mais escopo `(flash)`. Ex.: `feat(flash): add trip_type enum and column`.

---

## File Structure

### Novo em `kz-servicos-web-app-fork`

- `supabase/migrations/20260730120000_flash_trip_type_enum.sql` — enum + coluna
- `supabase/migrations/20260730120001_flash_last_push_at.sql` — coluna last_push_at
- `supabase/migrations/20260730120002_flash_no_scheduling_check.sql` — CHECK constraint
- `supabase/migrations/20260730120010_flash_rpc_create_flash_trip.sql`
- `supabase/migrations/20260730120011_flash_rpc_driver_send_proposal.sql`
- `supabase/migrations/20260730120012_flash_rpc_reject_flash_call.sql`
- `supabase/migrations/20260730120013_flash_rpc_client_accept_proposal.sql`
- `supabase/migrations/20260730120014_flash_rpc_driver_recheck.sql`
- `supabase/migrations/20260730120015_flash_rpc_redispatch.sql`
- `supabase/migrations/20260730120016_flash_rpc_cancel_flash.sql`
- `supabase/migrations/20260730120020_flash_push_trigger_extension.sql` — trigger push_on_candidate_insert lê trip_type
- `supabase/functions/send-flash-repush/index.ts` — nova edge function
- `supabase/tests/flash/*.sql` — 10 arquivos de teste pgTAP
- `src/lib/trip-flash-utils.ts` — utilidades UI admin
- `src/lib/trip-flash-utils.test.ts` — testes utils
- `src/components/FlashBadge.tsx` — badge visual

### Modificado em `kz-servicos-web-app-fork`

- `src/app/(dashboard)/viagens/page.tsx` — filtro Flash + badge
- `src/components/TripDetailModal.tsx` — esconder botões de standard quando flash
- `src/lib/trip-status.ts` — helper `isFlashTrip()`

### Novo em `kz-servicos-app-cliente`

- `lib/features/trip/data/models/flash_trip_model.dart`
- `lib/features/trip/data/models/flash_proposal_model.dart`
- `lib/features/trip/data/repositories/flash_trip_repository_impl.dart`
- `lib/features/trip/domain/entities/flash_trip.dart`
- `lib/features/trip/domain/entities/flash_proposal.dart`
- `lib/features/trip/domain/repositories/flash_trip_repository.dart`
- `lib/features/trip/domain/usecases/create_flash_trip.dart`
- `lib/features/trip/presentation/cubit/flash_creation_cubit.dart`
- `lib/features/trip/presentation/cubit/flash_creation_state.dart`
- `lib/features/trip/presentation/cubit/flash_searching_cubit.dart`
- `lib/features/trip/presentation/cubit/flash_searching_state.dart`
- `lib/features/trip/presentation/pages/flash_details_page.dart`
- `lib/features/trip/presentation/pages/flash_searching_page.dart`
- `lib/features/trip/presentation/pages/flash_awaiting_driver_page.dart`
- `lib/features/trip/presentation/widgets/trip_type_choice_sheet.dart`
- `lib/features/trip/presentation/widgets/flash_proposal_card.dart`
- `lib/features/trip/presentation/widgets/flash_driver_profile_modal.dart`
- `test/features/trip/data/flash_trip_model_test.dart`
- `test/features/trip/data/flash_proposal_model_test.dart`
- `test/features/trip/presentation/cubit/flash_creation_cubit_test.dart`
- `test/features/trip/presentation/cubit/flash_searching_cubit_test.dart`
- `test/features/trip/presentation/widgets/trip_type_choice_sheet_test.dart`
- `test/features/trip/presentation/widgets/flash_proposal_card_test.dart`

### Modificado em `kz-servicos-app-cliente`

- `lib/routes/app_router.dart` — 3 novas rotas Flash + ActiveFlashTripGate
- `lib/features/trip/presentation/pages/trip_home_page.dart` — abrir BottomSheet ao tocar em endereço

### Novo em `kz-servicos-app-prestador`

- `lib/features/trip/data/models/flash_incoming_call.dart`
- `lib/features/trip/data/models/flash_recheck_data.dart`
- `lib/core/services/flash_trip_service.dart` — RPCs Flash + realtime
- `lib/features/trip/presentation/pages/flash_incoming_call_page.dart`
- `lib/features/trip/presentation/pages/flash_awaiting_client_page.dart`
- `lib/features/trip/presentation/pages/flash_recheck_page.dart`
- `lib/features/trip/presentation/widgets/flash_price_input.dart`
- `test/features/trip/data/flash_incoming_call_test.dart`
- `test/core/services/flash_trip_service_test.dart`
- `test/features/trip/presentation/widgets/flash_price_input_test.dart`

### Modificado em `kz-servicos-app-prestador`

- `lib/routes/app_router.dart` — 3 novas rotas Flash
- `lib/core/services/push_notification_service.dart` — reconhecer `trip_type='flash'` e mapear rotas
- `lib/core/models/trip_data.dart` — adicionar `tripType`

---

## Phase 1 — Supabase schema

### Task 1: Enum `trip_type` + coluna em `trips`

**Files:**
- Create: `supabase/migrations/20260730120000_flash_trip_type_enum.sql`
- Test: `supabase/tests/flash/01_trip_type_enum_test.sql`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/flash/01_trip_type_enum_test.sql
BEGIN;
SELECT plan(3);

-- enum existe
SELECT has_type('public', 'trip_type', 'enum public.trip_type deve existir');

-- coluna existe e tem default correto
SELECT has_column('public', 'trips', 'trip_type', 'coluna trip_type deve existir em trips');
SELECT col_default_is('public', 'trips', 'trip_type', 'standard'::text, 'default deve ser standard');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
supabase test db --file supabase/tests/flash/01_trip_type_enum_test.sql
```

Expected: FAIL — enum e coluna não existem.

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/20260730120000_flash_trip_type_enum.sql
-- +goose Up

DO $$ BEGIN
  CREATE TYPE public.trip_type AS ENUM ('standard', 'flash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_type public.trip_type NOT NULL DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_trips_type_status ON public.trips(trip_type, status);

-- +goose Down
DROP INDEX IF EXISTS public.idx_trips_type_status;
ALTER TABLE public.trips DROP COLUMN IF EXISTS trip_type;
DROP TYPE IF EXISTS public.trip_type;
```

- [ ] **Step 4: Run test to verify it passes**

```powershell
supabase db reset
supabase test db --file supabase/tests/flash/01_trip_type_enum_test.sql
```

Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20260730120000_flash_trip_type_enum.sql supabase/tests/flash/01_trip_type_enum_test.sql
git commit -m "feat(flash): add trip_type enum and column"
```

---

### Task 2: Coluna `last_push_at` em `trip_driver_candidates`

**Files:**
- Create: `supabase/migrations/20260730120001_flash_last_push_at.sql`
- Test: `supabase/tests/flash/02_last_push_at_test.sql`

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SELECT plan(2);
SELECT has_column('public', 'trip_driver_candidates', 'last_push_at', 'coluna last_push_at deve existir');
SELECT col_type_is('public', 'trip_driver_candidates', 'last_push_at', 'timestamp with time zone');
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run and see FAIL.**

`supabase test db --file supabase/tests/flash/02_last_push_at_test.sql`

- [ ] **Step 3: Implement**

```sql
-- +goose Up
ALTER TABLE public.trip_driver_candidates
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tdc_pending_last_push
  ON public.trip_driver_candidates(trip_id, last_push_at)
  WHERE status = 'pending';

-- +goose Down
DROP INDEX IF EXISTS public.idx_tdc_pending_last_push;
ALTER TABLE public.trip_driver_candidates DROP COLUMN IF EXISTS last_push_at;
```

- [ ] **Step 4: Run and see PASS.**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): add last_push_at to trip_driver_candidates for repush throttle"
```

---

### Task 3: CHECK constraint — Flash não permite agendamento/paradas

**Files:**
- Create: `supabase/migrations/20260730120002_flash_no_scheduling_check.sql`
- Test: `supabase/tests/flash/03_flash_no_scheduling_test.sql`

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SELECT plan(2);

-- Setup: fixture client + addresses + category (assume seed helpers)
-- Aqui usamos helpers definidos em supabase/tests/flash/_fixtures.sql (Task 4 depois)
INSERT INTO public.trips (id, client_id, service_category_id, pickup_address_id, dropoff_address_id,
                          scheduled_datetime, passenger_count, status, trip_type, is_round_trip)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000021',
        now(), 1, 'searching_drivers', 'flash', false);

SELECT pass('flash trip com is_round_trip=false deve aceitar');

-- Deve falhar:
SELECT throws_ok($$
  INSERT INTO public.trips (id, client_id, service_category_id, pickup_address_id, dropoff_address_id,
                            scheduled_datetime, passenger_count, status, trip_type, is_round_trip)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '00000000-0000-0000-0000-000000000020',
          '00000000-0000-0000-0000-000000000021',
          now(), 1, 'searching_drivers', 'flash', true)
$$, '23514', NULL, 'flash com is_round_trip=true deve violar CHECK');

SELECT * FROM finish();
ROLLBACK;
```

Nota: fixtures serão criadas na Task 4. Este teste pode falhar por FK; ok — o objetivo é ver a constraint funcionando. Se FK atrapalhar, mover asserção pra Task 4 depois das fixtures.

- [ ] **Step 2: Run — vai falhar (constraint não existe)**

- [ ] **Step 3: Implement**

```sql
-- +goose Up
ALTER TABLE public.trips
  ADD CONSTRAINT trips_flash_no_scheduling CHECK (
    trip_type = 'standard' OR (
      is_round_trip = false
      AND return_datetime IS NULL
    )
  );

-- +goose Down
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_flash_no_scheduling;
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): forbid round_trip and return_datetime on flash trips"
```

---

## Phase 2 — Supabase RPCs

**Fixtures compartilhadas:** antes de escrever os testes de RPC, criar arquivo de fixtures reusável.

### Task 4: Fixtures compartilhadas de teste

**Files:**
- Create: `supabase/tests/flash/_fixtures.sql`

- [ ] **Step 1: Escrever o helper**

```sql
-- supabase/tests/flash/_fixtures.sql
-- Fixtures reusáveis. NÃO usar plan()/finish() aqui.
-- Uso: SELECT flash_setup_fixtures();

CREATE OR REPLACE FUNCTION flash_setup_fixtures()
RETURNS TABLE (client_id uuid, driver1 uuid, driver2 uuid, driver3 uuid,
               category_id uuid, pickup_id uuid, dropoff_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_client uuid := gen_random_uuid();
  v_driver1_user uuid := gen_random_uuid();
  v_driver2_user uuid := gen_random_uuid();
  v_driver3_user uuid := gen_random_uuid();
  v_driver1_prof uuid;
  v_driver2_prof uuid;
  v_driver3_prof uuid;
  v_driver1_prov uuid;
  v_driver2_prov uuid;
  v_driver3_prov uuid;
  v_category uuid := gen_random_uuid();
  v_pickup uuid := gen_random_uuid();
  v_dropoff uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, name, email, role) VALUES
    (v_client, 'Cliente Teste', 'cliente@teste.com', 'client'),
    (v_driver1_user, 'Mot 1', 'm1@teste.com', 'provider'),
    (v_driver2_user, 'Mot 2', 'm2@teste.com', 'provider'),
    (v_driver3_user, 'Mot 3', 'm3@teste.com', 'provider');

  INSERT INTO public.service_categories (id, name, kind) VALUES
    (v_category, 'Simples', 'trip');

  INSERT INTO public.provider_profiles (id, user_id, status) VALUES
    (gen_random_uuid(), v_driver1_user, 'approved') RETURNING id INTO v_driver1_prov;
  INSERT INTO public.provider_profiles (id, user_id, status) VALUES
    (gen_random_uuid(), v_driver2_user, 'approved') RETURNING id INTO v_driver2_prov;
  INSERT INTO public.provider_profiles (id, user_id, status) VALUES
    (gen_random_uuid(), v_driver3_user, 'pending') RETURNING id INTO v_driver3_prov;
  -- driver3 = pending: nunca deve ser candidato

  INSERT INTO public.driver_profiles (id, provider_profile_id, cnh) VALUES
    (gen_random_uuid(), v_driver1_prov, '11111111111') RETURNING id INTO v_driver1_prof;
  INSERT INTO public.driver_profiles (id, provider_profile_id, cnh) VALUES
    (gen_random_uuid(), v_driver2_prov, '22222222222') RETURNING id INTO v_driver2_prof;
  INSERT INTO public.driver_profiles (id, provider_profile_id, cnh) VALUES
    (gen_random_uuid(), v_driver3_prov, '33333333333') RETURNING id INTO v_driver3_prof;

  INSERT INTO public.addresses (id, user_id, street, city, state, cep, location)
  VALUES (v_pickup, v_client, 'Rua A', 'São Paulo', 'SP', '01001000',
          ST_SetSRID(ST_MakePoint(-46.633, -23.550), 4326)::geography);
  INSERT INTO public.addresses (id, user_id, street, city, state, cep, location)
  VALUES (v_dropoff, v_client, 'Rua B', 'São Paulo', 'SP', '01002000',
          ST_SetSRID(ST_MakePoint(-46.640, -23.560), 4326)::geography);

  RETURN QUERY SELECT v_client, v_driver1_prof, v_driver2_prof, v_driver3_prof,
                      v_category, v_pickup, v_dropoff;
END;
$$;

-- Helper para simular auth.uid()
CREATE OR REPLACE FUNCTION flash_set_auth(p_user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
END;
$$;
```

- [ ] **Step 2: Sem teste isolado — este arquivo é lib. Verificar sintaxe:**

```powershell
supabase db reset
supabase db push --dry-run
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add supabase/tests/flash/_fixtures.sql
git commit -m "test(flash): shared fixtures for RPC tests"
```

---

### Task 5: RPC `create_flash_trip`

**Files:**
- Create: `supabase/migrations/20260730120010_flash_rpc_create_flash_trip.sql`
- Test: `supabase/tests/flash/10_create_flash_trip_test.sql`

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(5);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid;
  v_trip uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, 'obs teste');

  PERFORM ok((SELECT trip_type = 'flash' FROM public.trips WHERE id = v_trip), 'trip_type=flash');
  PERFORM ok((SELECT status = 'searching_drivers' FROM public.trips WHERE id = v_trip),
            'status=searching_drivers');
  PERFORM ok((SELECT scheduled_datetime BETWEEN now() - interval '5 seconds' AND now() + interval '5 seconds'
              FROM public.trips WHERE id = v_trip), 'scheduled_datetime=now()');

  -- 2 aprovados esperados, driver3 é pending
  PERFORM is((SELECT COUNT(*)::int FROM public.trip_driver_candidates WHERE trip_id = v_trip), 2,
            'insere candidato para todos motoristas aprovados');

  -- driver3 NÃO deve ter candidato
  PERFORM ok(NOT EXISTS (SELECT 1 FROM public.trip_driver_candidates
                         WHERE trip_id = v_trip AND driver_profile_id = v_driver3),
            'motorista pending NÃO recebe candidato');
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL (função não existe)**

- [ ] **Step 3: Implement**

```sql
-- supabase/migrations/20260730120010_flash_rpc_create_flash_trip.sql
-- +goose Up

CREATE OR REPLACE FUNCTION public.create_flash_trip(
  p_pickup_address_id uuid,
  p_dropoff_address_id uuid,
  p_service_category_id uuid,
  p_passenger_count int,
  p_children_count int,
  p_luggage_count int,
  p_observations text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_trip_id uuid;
  v_client_id uuid := auth.uid();
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE client_id = v_client_id
      AND trip_type = 'flash'
      AND status IN ('searching_drivers','awaiting_driver_confirmation','scheduled','started')
  ) THEN
    RAISE EXCEPTION 'Você já tem uma corrida Flash em andamento';
  END IF;

  IF p_passenger_count < 1 THEN
    RAISE EXCEPTION 'Número de passageiros inválido';
  END IF;

  INSERT INTO public.trips (
    client_id, service_category_id, pickup_address_id, dropoff_address_id,
    scheduled_datetime, passenger_count, children_count, luggage_count,
    observations, status, trip_type, is_round_trip
  ) VALUES (
    v_client_id, p_service_category_id, p_pickup_address_id, p_dropoff_address_id,
    now(), p_passenger_count, p_children_count, p_luggage_count,
    p_observations, 'searching_drivers', 'flash', false
  )
  RETURNING id INTO v_trip_id;

  PERFORM public.add_all_approved_trip_candidates(v_trip_id);
  RETURN v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_flash_trip(uuid,uuid,uuid,int,int,int,text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.create_flash_trip(uuid,uuid,uuid,int,int,int,text);
```

- [ ] **Step 4: Run — PASS 5/5**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): create_flash_trip RPC dispatches to all approved drivers"
```

---

### Task 6: RPC `driver_send_flash_proposal`

**Files:**
- Create: `supabase/migrations/20260730120011_flash_rpc_driver_send_proposal.sql`
- Test: `supabase/tests/flash/11_driver_send_proposal_test.sql`

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(5);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid;
  v_trip uuid;
  v_driver1_user uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');

  SELECT pp.user_id INTO v_driver1_user
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE dp.id = v_driver1;

  PERFORM flash_set_auth(v_driver1_user);
  PERFORM public.driver_send_flash_proposal(v_trip, 45.50);

  PERFORM ok((SELECT status = 'accepted' FROM public.trip_driver_candidates
              WHERE trip_id = v_trip AND driver_profile_id = v_driver1), 'status=accepted');
  PERFORM is((SELECT offered_price::text FROM public.trip_driver_candidates
              WHERE trip_id = v_trip AND driver_profile_id = v_driver1),
             '45.50', 'offered_price=45.50');

  -- Re-envio deve falhar
  PERFORM throws_ok($$SELECT public.driver_send_flash_proposal($1, 50)$$,
                    ARRAY[v_trip::text], 'P0001',
                    'Você já respondeu essa chamada',
                    'não permite re-submissão');

  -- Preço inválido
  PERFORM flash_set_auth(v_client);
  DECLARE v_trip2 uuid;
  BEGIN
    v_trip2 := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');
    PERFORM flash_set_auth(v_driver1_user);
    PERFORM throws_ok($$SELECT public.driver_send_flash_proposal($1, 0)$$,
                      ARRAY[v_trip2::text], 'P0001', NULL, 'preço 0 rejeitado');
    PERFORM throws_ok($$SELECT public.driver_send_flash_proposal($1, 15000)$$,
                      ARRAY[v_trip2::text], 'P0001', NULL, 'preço acima do teto rejeitado');
  END;
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```sql
-- +goose Up

CREATE OR REPLACE FUNCTION public.driver_send_flash_proposal(
  p_trip_id uuid, p_price numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile_id uuid;
  v_current_status public.trip_status_candidate;
  v_trip_status public.trip_status;
  v_trip_type public.trip_type;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_price <= 0 OR p_price > 10000 THEN
    RAISE EXCEPTION 'Preço inválido';
  END IF;

  SELECT dp.id INTO v_driver_profile_id
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;
  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  SELECT status, trip_type INTO v_trip_status, v_trip_type
  FROM public.trips WHERE id = p_trip_id;
  IF v_trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Esta RPC só aceita corridas Flash';
  END IF;
  IF v_trip_status <> 'searching_drivers' THEN
    RAISE EXCEPTION 'Corrida não está buscando motoristas';
  END IF;

  SELECT status INTO v_current_status
  FROM public.trip_driver_candidates
  WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Você não foi convidado para essa corrida';
  END IF;
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Você já respondeu essa chamada';
  END IF;

  UPDATE public.trip_driver_candidates
     SET status = 'accepted', offered_price = p_price, updated_at = now()
   WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_send_flash_proposal(uuid, numeric) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.driver_send_flash_proposal(uuid, numeric);
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): driver_send_flash_proposal with idempotency and sanity checks"
```

---

### Task 7: RPC `reject_flash_call`

**Files:**
- Create: `supabase/migrations/20260730120012_flash_rpc_reject_flash_call.sql`
- Test: `supabase/tests/flash/12_reject_flash_call_test.sql`

- [ ] **Step 1: Test**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(2);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid; v_trip uuid; v_driver1_user uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');

  SELECT pp.user_id INTO v_driver1_user
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE dp.id = v_driver1;
  PERFORM flash_set_auth(v_driver1_user);
  PERFORM public.reject_flash_call(v_trip);

  PERFORM ok((SELECT status = 'rejected' FROM public.trip_driver_candidates
              WHERE trip_id = v_trip AND driver_profile_id = v_driver1), 'candidate rejected');

  PERFORM throws_ok($$SELECT public.reject_flash_call($1)$$,
                    ARRAY[v_trip::text], 'P0001', 'Você já respondeu essa chamada',
                    'não permite rejeitar 2x');
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```sql
-- +goose Up
CREATE OR REPLACE FUNCTION public.reject_flash_call(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile_id uuid;
  v_current_status public.trip_status_candidate;
  v_trip_type public.trip_type;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT trip_type INTO v_trip_type FROM public.trips WHERE id = p_trip_id;
  IF v_trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Esta RPC só aceita corridas Flash';
  END IF;

  SELECT dp.id INTO v_driver_profile_id
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;
  IF v_driver_profile_id IS NULL THEN RAISE EXCEPTION 'Motorista não encontrado'; END IF;

  SELECT status INTO v_current_status
  FROM public.trip_driver_candidates
  WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Você não foi convidado'; END IF;
  IF v_current_status <> 'pending' THEN RAISE EXCEPTION 'Você já respondeu essa chamada'; END IF;

  UPDATE public.trip_driver_candidates
     SET status = 'rejected', updated_at = now()
   WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_flash_call(uuid) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.reject_flash_call(uuid);
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): reject_flash_call marks candidate rejected"
```

---

### Task 8: RPC `client_accept_flash_proposal`

**Files:**
- Create: `supabase/migrations/20260730120013_flash_rpc_client_accept_proposal.sql`
- Test: `supabase/tests/flash/13_client_accept_proposal_test.sql`

- [ ] **Step 1: Test — happy path + concorrência**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(4);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid;
  v_trip uuid; v_driver1_user uuid; v_driver2_user uuid;
  v_cand1_id uuid; v_cand2_id uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');

  SELECT pp.user_id INTO v_driver1_user FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id WHERE dp.id = v_driver1;
  SELECT pp.user_id INTO v_driver2_user FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id WHERE dp.id = v_driver2;

  PERFORM flash_set_auth(v_driver1_user);
  PERFORM public.driver_send_flash_proposal(v_trip, 40);
  PERFORM flash_set_auth(v_driver2_user);
  PERFORM public.driver_send_flash_proposal(v_trip, 50);

  SELECT id INTO v_cand1_id FROM public.trip_driver_candidates
    WHERE trip_id = v_trip AND driver_profile_id = v_driver1;
  SELECT id INTO v_cand2_id FROM public.trip_driver_candidates
    WHERE trip_id = v_trip AND driver_profile_id = v_driver2;

  PERFORM flash_set_auth(v_client);
  PERFORM public.client_accept_flash_proposal(v_cand1_id);

  PERFORM ok((SELECT status = 'awaiting_driver_confirmation' FROM public.trips WHERE id = v_trip),
            'trip vira awaiting_driver_confirmation');
  PERFORM ok((SELECT driver_profile_id = v_driver1 FROM public.trips WHERE id = v_trip),
            'driver_profile_id preenchido');
  PERFORM ok((SELECT final_price = 40 FROM public.trips WHERE id = v_trip),
            'final_price=offered_price');

  PERFORM throws_ok($$SELECT public.client_accept_flash_proposal($1)$$,
                    ARRAY[v_cand2_id::text], 'P0001',
                    'Corrida não está mais buscando',
                    'segundo aceite falha');
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```sql
-- +goose Up
CREATE OR REPLACE FUNCTION public.client_accept_flash_proposal(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_trip_id uuid; v_driver_profile uuid; v_price numeric;
  v_trip_status public.trip_status; v_trip_type public.trip_type; v_trip_client uuid;
  v_vehicle_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT trip_id, driver_profile_id, offered_price INTO v_trip_id, v_driver_profile, v_price
  FROM public.trip_driver_candidates WHERE id = p_candidate_id;
  IF v_trip_id IS NULL THEN RAISE EXCEPTION 'Candidato inexistente'; END IF;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Proposta sem preço'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trip_id::text));

  SELECT status, trip_type, client_id INTO v_trip_status, v_trip_type, v_trip_client
  FROM public.trips WHERE id = v_trip_id FOR UPDATE;
  IF v_trip_client <> v_user THEN RAISE EXCEPTION 'Não é sua corrida'; END IF;
  IF v_trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Esta RPC só aceita corridas Flash';
  END IF;
  IF v_trip_status <> 'searching_drivers' THEN
    RAISE EXCEPTION 'Corrida não está mais buscando';
  END IF;

  -- Seleciona veículo ativo do motorista
  SELECT id INTO v_vehicle_id FROM public.vehicles
   WHERE driver_profile_id = v_driver_profile AND is_active = true
   ORDER BY updated_at DESC LIMIT 1;

  UPDATE public.trips
     SET status = 'awaiting_driver_confirmation',
         driver_profile_id = v_driver_profile,
         vehicle_id = v_vehicle_id,
         final_price = v_price,
         updated_at = now()
   WHERE id = v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_accept_flash_proposal(uuid) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.client_accept_flash_proposal(uuid);
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): client_accept_flash_proposal with concurrency lock"
```

---

### Task 9: RPCs de re-check — confirm + reject

**Files:**
- Create: `supabase/migrations/20260730120014_flash_rpc_driver_recheck.sql`
- Test: `supabase/tests/flash/14_driver_recheck_test.sql`

- [ ] **Step 1: Test**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(6);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid;
  v_trip uuid; v_driver1_user uuid; v_cand1_id uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');
  SELECT pp.user_id INTO v_driver1_user FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id WHERE dp.id = v_driver1;
  PERFORM flash_set_auth(v_driver1_user);
  PERFORM public.driver_send_flash_proposal(v_trip, 40);
  SELECT id INTO v_cand1_id FROM public.trip_driver_candidates
    WHERE trip_id = v_trip AND driver_profile_id = v_driver1;
  PERFORM flash_set_auth(v_client);
  PERFORM public.client_accept_flash_proposal(v_cand1_id);

  -- Reject: volta para searching, candidato rejected, redispatch chamado
  PERFORM flash_set_auth(v_driver1_user);
  PERFORM public.driver_flash_recheck_reject(v_trip);

  PERFORM ok((SELECT status = 'searching_drivers' FROM public.trips WHERE id = v_trip),
            'status volta a searching');
  PERFORM ok((SELECT driver_profile_id IS NULL FROM public.trips WHERE id = v_trip),
            'driver_profile_id limpo');
  PERFORM ok((SELECT final_price IS NULL FROM public.trips WHERE id = v_trip),
            'final_price limpo');
  PERFORM ok((SELECT status = 'rejected' FROM public.trip_driver_candidates WHERE id = v_cand1_id),
            'candidato virou rejected');

  -- Confirm: cria caminho happy path com outro motorista
  PERFORM flash_set_auth(v_client);
  DECLARE v_trip2 uuid; v_cand_ok uuid;
  BEGIN
    v_trip2 := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');
    PERFORM flash_set_auth(v_driver1_user);
    PERFORM public.driver_send_flash_proposal(v_trip2, 42);
    SELECT id INTO v_cand_ok FROM public.trip_driver_candidates
      WHERE trip_id = v_trip2 AND driver_profile_id = v_driver1;
    PERFORM flash_set_auth(v_client);
    PERFORM public.client_accept_flash_proposal(v_cand_ok);
    PERFORM flash_set_auth(v_driver1_user);
    PERFORM public.driver_flash_recheck_confirm(v_trip2);
    PERFORM ok((SELECT status = 'started' FROM public.trips WHERE id = v_trip2),
              'confirm inicia trip (status started via advance_trip_execution)');
    PERFORM ok((SELECT execution_stage = 'to_pickup' FROM public.trips WHERE id = v_trip2),
              'execution_stage to_pickup');
  END;
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement — cria as duas RPCs no mesmo arquivo**

```sql
-- +goose Up

CREATE OR REPLACE FUNCTION public.driver_flash_recheck_confirm(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile uuid;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT dp.id INTO v_driver_profile
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Só corridas Flash';
  END IF;
  IF v_trip.driver_profile_id IS DISTINCT FROM v_driver_profile THEN
    RAISE EXCEPTION 'Você não é o motorista dessa corrida';
  END IF;
  IF v_trip.status <> 'awaiting_driver_confirmation' THEN
    RAISE EXCEPTION 'Trip não está aguardando sua confirmação';
  END IF;

  UPDATE public.trips SET status = 'scheduled' WHERE id = p_trip_id;
  -- advance_trip_execution muda pra started + to_pickup
  PERFORM public.advance_trip_execution(p_trip_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_flash_recheck_reject(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_driver_profile uuid;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT dp.id INTO v_driver_profile
  FROM public.driver_profiles dp
  JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id
  WHERE pp.user_id = v_user;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Só corridas Flash';
  END IF;
  IF v_trip.driver_profile_id IS DISTINCT FROM v_driver_profile THEN
    RAISE EXCEPTION 'Você não é o motorista dessa corrida';
  END IF;
  IF v_trip.status <> 'awaiting_driver_confirmation' THEN
    RAISE EXCEPTION 'Trip não está aguardando sua confirmação';
  END IF;

  UPDATE public.trip_driver_candidates
     SET status = 'rejected', updated_at = now()
   WHERE trip_id = p_trip_id AND driver_profile_id = v_driver_profile;

  UPDATE public.trips
     SET status = 'searching_drivers',
         driver_profile_id = NULL,
         vehicle_id = NULL,
         final_price = NULL,
         updated_at = now()
   WHERE id = p_trip_id;

  PERFORM public.redispatch_flash_trip(p_trip_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_flash_recheck_confirm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_flash_recheck_reject(uuid) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.driver_flash_recheck_confirm(uuid);
DROP FUNCTION IF EXISTS public.driver_flash_recheck_reject(uuid);
```

Nota: `driver_flash_recheck_reject` chama `redispatch_flash_trip` que ainda não existe — o teste vai falhar. **Ordem correta:** implementar Task 10 primeiro, ou usar stub temporário. Para manter TDD sequencial, esta migration inclui **stub** `redispatch_flash_trip` que só faz `RETURN 0`; a Task 10 substitui.

Adicionar antes das grant clauses:

```sql
-- Stub — substituído pela Task 10
CREATE OR REPLACE FUNCTION public.redispatch_flash_trip(p_trip_id uuid)
RETURNS integer LANGUAGE sql AS $$ SELECT 0::int $$;
```

- [ ] **Step 4: Run — PASS 6/6**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): driver re-check confirm/reject RPCs"
```

---

### Task 10: RPC `redispatch_flash_trip` (substitui o stub)

**Files:**
- Create: `supabase/migrations/20260730120015_flash_rpc_redispatch.sql`
- Test: `supabase/tests/flash/15_redispatch_test.sql`

- [ ] **Step 1: Test**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(4);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid;
  v_trip uuid; v_driver1_user uuid; v_new_driver_user uuid; v_new_driver_prof uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');

  -- driver1 rejeita
  SELECT pp.user_id INTO v_driver1_user FROM public.driver_profiles dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_profile_id WHERE dp.id = v_driver1;
  PERFORM flash_set_auth(v_driver1_user);
  PERFORM public.reject_flash_call(v_trip);

  -- Cria 4º motorista aprovado (depois do dispatch original)
  v_new_driver_user := gen_random_uuid();
  INSERT INTO public.users (id, name, email, role) VALUES (v_new_driver_user, 'Mot 4', 'm4@x.com', 'provider');
  DECLARE v_prov uuid;
  BEGIN
    INSERT INTO public.provider_profiles (id, user_id, status)
    VALUES (gen_random_uuid(), v_new_driver_user, 'approved') RETURNING id INTO v_prov;
    INSERT INTO public.driver_profiles (id, provider_profile_id, cnh)
    VALUES (gen_random_uuid(), v_prov, '44444444444') RETURNING id INTO v_new_driver_prof;
  END;

  PERFORM public.redispatch_flash_trip(v_trip);

  PERFORM ok(EXISTS (SELECT 1 FROM public.trip_driver_candidates
                     WHERE trip_id = v_trip AND driver_profile_id = v_new_driver_prof),
            'novo motorista aprovado ganha candidato via redispatch');

  PERFORM ok((SELECT status = 'rejected' FROM public.trip_driver_candidates
              WHERE trip_id = v_trip AND driver_profile_id = v_driver1),
            'driver1 continua rejected');

  PERFORM is((SELECT COUNT(*)::int FROM public.trip_driver_candidates
              WHERE trip_id = v_trip AND driver_profile_id = v_driver1), 1,
            'driver1 rejected não duplica');

  -- Throttle: última push de 5s atrás, redispatch NÃO deve reenviar
  UPDATE public.trip_driver_candidates SET last_push_at = now() - interval '5 seconds'
    WHERE trip_id = v_trip AND status = 'pending';
  PERFORM is(public.redispatch_flash_trip(v_trip), 0::int,
            'segundo redispatch dentro de 30s não envia re-push');
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL** (o stub sempre retorna 0, teste do novo motorista falha)

- [ ] **Step 3: Implement**

```sql
-- +goose Up

CREATE OR REPLACE FUNCTION public.redispatch_flash_trip(p_trip_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_pushed int := 0;
  v_settings_id uuid;
  v_webhook_url text;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Não é Flash';
  END IF;
  IF v_trip.status <> 'searching_drivers' THEN
    RETURN 0;
  END IF;

  -- Insere candidatos p/ novos aprovados (idempotente via NOT EXISTS na função existente)
  PERFORM public.add_all_approved_trip_candidates(p_trip_id);

  -- Re-push com throttle 30s
  SELECT value INTO v_webhook_url FROM public.system_settings
   WHERE key = 'flash_repush_webhook_url';

  IF v_webhook_url IS NOT NULL THEN
    WITH to_repush AS (
      SELECT id, driver_profile_id
      FROM public.trip_driver_candidates
      WHERE trip_id = p_trip_id
        AND status = 'pending'
        AND (last_push_at IS NULL OR last_push_at < now() - interval '30 seconds')
    ),
    updated AS (
      UPDATE public.trip_driver_candidates c
         SET last_push_at = now()
        FROM to_repush r
       WHERE c.id = r.id
      RETURNING c.id
    )
    SELECT COUNT(*) INTO v_pushed FROM updated;

    IF v_pushed > 0 THEN
      PERFORM net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('trip_id', p_trip_id, 'kind', 'flash_repush')
      );
    END IF;
  END IF;

  RETURN v_pushed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redispatch_flash_trip(uuid) TO authenticated;

-- Nota: assegurar que system_settings tem a chave 'flash_repush_webhook_url' apontando para a edge function.
-- Isso é inserido em uma seed (fora deste plano) OU manualmente:
-- INSERT INTO public.system_settings(key, value) VALUES ('flash_repush_webhook_url', 'https://<project>.supabase.co/functions/v1/send-flash-repush');

-- +goose Down
DROP FUNCTION IF EXISTS public.redispatch_flash_trip(uuid);
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): redispatch_flash_trip with 30s repush throttle"
```

---

### Task 11: RPC `cancel_flash_trip`

**Files:**
- Create: `supabase/migrations/20260730120016_flash_rpc_cancel_flash.sql`
- Test: `supabase/tests/flash/16_cancel_flash_test.sql`

- [ ] **Step 1: Test**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(3);

DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid; v_trip uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');

  PERFORM public.cancel_flash_trip(v_trip, 'Não quero mais');

  PERFORM ok((SELECT status = 'cancelled' FROM public.trips WHERE id = v_trip), 'trip cancelada');
  PERFORM ok((SELECT cancelled_at IS NOT NULL FROM public.trips WHERE id = v_trip),
            'cancelled_at preenchido');
  PERFORM ok((SELECT cancellation_reason = 'Não quero mais' FROM public.trips WHERE id = v_trip),
            'reason gravado');
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```sql
-- +goose Up
CREATE OR REPLACE FUNCTION public.cancel_flash_trip(p_trip_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.trip_type IS DISTINCT FROM 'flash' THEN
    RAISE EXCEPTION 'Só corridas Flash';
  END IF;
  IF v_trip.client_id <> v_user THEN
    RAISE EXCEPTION 'Não é sua corrida';
  END IF;
  IF v_trip.status NOT IN ('searching_drivers','awaiting_driver_confirmation','scheduled') THEN
    RAISE EXCEPTION 'Corrida não pode mais ser cancelada';
  END IF;

  UPDATE public.trips
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_at = now()
   WHERE id = p_trip_id;
  -- Trigger existente reject_candidates_when_trip_cancelled marca candidatos como rejected
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_flash_trip(uuid, text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.cancel_flash_trip(uuid, text);
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): cancel_flash_trip for client cancellation"
```

---

## Phase 3 — Push notification triggers & edge function

### Task 12: Estender trigger `push_on_candidate_insert` para reconhecer Flash

**Files:**
- Modify: nova migration `supabase/migrations/20260730120020_flash_push_trigger_extension.sql`
- Test: `supabase/tests/flash/20_push_trigger_test.sql`

Referência do trigger atual: `supabase/migrations/20260618140000_push_on_candidate_insert.sql`.

- [ ] **Step 1: Test — verifica que trigger não quebra quando trip_type='flash'**

```sql
BEGIN;
\i supabase/tests/flash/_fixtures.sql
SELECT plan(1);

-- Só verificamos que INSERT de candidato em trip Flash não lança erro
-- (a chamada http_post via pg_net vai falhar/timeout silenciosamente em ambiente de teste)
DO $$
DECLARE
  v_client uuid; v_driver1 uuid; v_driver2 uuid; v_driver3 uuid;
  v_category uuid; v_pickup uuid; v_dropoff uuid; v_trip uuid;
BEGIN
  SELECT * FROM flash_setup_fixtures()
    INTO v_client, v_driver1, v_driver2, v_driver3, v_category, v_pickup, v_dropoff;
  PERFORM flash_set_auth(v_client);
  v_trip := public.create_flash_trip(v_pickup, v_dropoff, v_category, 1, 0, 0, '');
  PERFORM ok((SELECT COUNT(*) FROM public.trip_driver_candidates WHERE trip_id = v_trip) = 2,
            'insert candidatos em flash não é bloqueado pelo trigger de push');
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run — pode passar ou falhar dependendo do trigger atual. Vamos assumir que passa (trigger não bloqueia INSERT). Se falhar, o passo 3 corrige.**

- [ ] **Step 3: Implement — patch da função de push**

```sql
-- +goose Up
-- Atualiza função para incluir trip_type no payload OneSignal.

CREATE OR REPLACE FUNCTION public.trigger_push_on_candidate_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_url text; v_service_key text;
  v_trip_type public.trip_type;
  v_client_name text;
  v_title text; v_body text;
BEGIN
  SELECT value INTO v_url FROM public.system_settings
    WHERE key = 'onesignal_webhook_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets
    WHERE name = 'onesignal_webhook_secret';
  IF v_url IS NULL THEN RETURN NEW; END IF;

  SELECT t.trip_type, u.name INTO v_trip_type, v_client_name
    FROM public.trips t
    JOIN public.users u ON u.id = t.client_id
   WHERE t.id = NEW.trip_id;

  IF v_trip_type = 'flash' THEN
    v_title := '⚡ CORRIDA FLASH!';
    v_body := COALESCE(v_client_name, 'Cliente') || ' pediu uma corrida agora — toque para ver';
  ELSE
    v_title := 'Nova solicitação de corrida';
    v_body := 'Uma nova corrida está disponível para você';
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'candidate_id', NEW.id,
      'trip_id', NEW.trip_id,
      'driver_profile_id', NEW.driver_profile_id,
      'trip_type', v_trip_type,
      'title', v_title,
      'body', v_body
    )
  );
  RETURN NEW;
END;
$$;

-- +goose Down
-- (mantém versão anterior; sem reversão automática)
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(flash): push_on_candidate_insert emits flash-specific title/body"
```

---

### Task 13: Edge function `send-flash-repush`

**Files:**
- Create: `supabase/functions/send-flash-repush/index.ts`
- Create: `supabase/functions/send-flash-repush/deno.json`

- [ ] **Step 1: Escrever o esqueleto**

Referência: função existente `supabase/functions/send-trip-notification/index.ts` (assumindo padrão OneSignal). Se não existir, seguir doc oficial:
https://onesignal.com/api/v1/notifications

```typescript
// supabase/functions/send-flash-repush/index.ts
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const { trip_id, kind } = await req.json();
  if (kind !== 'flash_repush') return new Response('bad kind', { status: 400 });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: candidates, error } = await sb
    .from('trip_driver_candidates')
    .select('id, driver_profile_id, driver_profiles(provider_profiles(user_id))')
    .eq('trip_id', trip_id)
    .eq('status', 'pending');
  if (error) return new Response(error.message, { status: 500 });

  const externalIds = (candidates ?? [])
    .map((c) => c.driver_profiles?.provider_profiles?.user_id)
    .filter(Boolean);
  if (externalIds.length === 0) return new Response('nobody', { status: 200 });

  const notif = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: externalIds },
    target_channel: 'push',
    headings: { pt: '⚡ Corrida Flash ainda aberta' },
    contents: { pt: 'Envie sua proposta agora' },
    data: { trip_id, trip_type: 'flash', route: '/flash/incoming' },
  };

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(notif),
  });
  return new Response(await res.text(), { status: res.status });
});
```

- [ ] **Step 2: Deploy local pra teste manual**

```powershell
supabase functions serve send-flash-repush --env-file supabase/.env.local
```

- [ ] **Step 3: Testar via curl:**

```powershell
curl -X POST http://localhost:54321/functions/v1/send-flash-repush `
  -H "Content-Type: application/json" `
  -d '{\"trip_id\":\"<uuid>\", \"kind\":\"flash_repush\"}'
```

Expected: 200 (ou 'nobody' se sem candidatos pending).

- [ ] **Step 4: Deploy para o projeto**

```powershell
supabase functions deploy send-flash-repush
```

- [ ] **Step 5: Registrar URL no system_settings**

```sql
INSERT INTO public.system_settings(key, value)
VALUES ('flash_repush_webhook_url',
        'https://<PROJECT_REF>.supabase.co/functions/v1/send-flash-repush')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/send-flash-repush/
git commit -m "feat(flash): edge function send-flash-repush for redispatch push"
```

---

## Phase 4 — Painel Admin (Next.js)

### Task 14: Helper `isFlashTrip` + testes

**Files:**
- Modify: `src/lib/trip-status.ts`
- Create: `src/lib/trip-status.test.ts` (se não existir)

- [ ] **Step 1: Ler arquivo atual**

Verificar `src/lib/trip-status.ts` — quais tipos existem.

- [ ] **Step 2: Test**

```typescript
// src/lib/trip-status.test.ts
import { isFlashTrip } from './trip-status';

describe('isFlashTrip', () => {
  it('returns true for trip_type=flash', () => {
    expect(isFlashTrip({ trip_type: 'flash' } as any)).toBe(true);
  });
  it('returns false for trip_type=standard or missing', () => {
    expect(isFlashTrip({ trip_type: 'standard' } as any)).toBe(false);
    expect(isFlashTrip({} as any)).toBe(false);
  });
});
```

Run: `npm test -- src/lib/trip-status.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement em `src/lib/trip-status.ts`**

Adicionar:

```typescript
export type TripType = 'standard' | 'flash';

export interface HasTripType { trip_type?: TripType | null }

export function isFlashTrip(trip: HasTripType | null | undefined): boolean {
  return trip?.trip_type === 'flash';
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(admin): isFlashTrip helper"
```

---

### Task 15: Badge `<FlashBadge />` + testes

**Files:**
- Create: `src/components/FlashBadge.tsx`
- Create: `src/components/FlashBadge.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/components/FlashBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { FlashBadge } from './FlashBadge';

describe('FlashBadge', () => {
  it('renders "FLASH" text', () => {
    render(<FlashBadge />);
    expect(screen.getByText(/FLASH/i)).toBeInTheDocument();
  });
});
```

Expected: FAIL.

- [ ] **Step 2: Implement**

```tsx
// src/components/FlashBadge.tsx
export function FlashBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-bold text-black"
      title="Corrida Flash"
    >
      ⚡ FLASH
    </span>
  );
}
```

- [ ] **Step 3: Run — PASS**

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(admin): FlashBadge component"
```

---

### Task 16: Trip list — filtro Flash + badge

**Files:**
- Modify: `src/app/(dashboard)/viagens/page.tsx`

- [ ] **Step 1: Ler arquivo atual**

Identificar onde está o `.select('*')` no supabase query e onde a coluna de tipo aparece.

- [ ] **Step 2: Escrever teste (se testes de página existirem)**

Se não houver, criar `src/app/(dashboard)/viagens/page.test.tsx` com um render smoke test que verifica badge visível quando linha tem `trip_type='flash'`.

- [ ] **Step 3: Alteração — dois passos:**

1. **Query**: adicionar `trip_type` no select.
2. **UI**: import `FlashBadge`; onde a linha da viagem é renderizada, `{isFlashTrip(trip) && <FlashBadge />}` ao lado do id/status.
3. **Filtro**: adicionar dropdown "Tipo: [Todos, Padrão, Flash]" no header da lista. Filtro aplicado localmente após fetch ou via `.eq('trip_type', ...)` no query.

- [ ] **Step 4: Verificar visualmente**

```powershell
npm run dev
```

Navegar para `/viagens`, criar uma trip Flash via SQL Editor, ver badge aparecer.

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(admin): FLASH filter + badge in trips list"
```

---

### Task 17: TripDetailModal — esconder botões de standard para Flash

**Files:**
- Modify: `src/components/TripDetailModal.tsx`

- [ ] **Step 1: Ler o modal e identificar botões**

Lista de botões que devem ficar OCULTOS quando `isFlashTrip(trip)`:
- Aprovar
- Rejeitar
- Selecionar motorista
- Editar horário / rota
- Editar detalhes (bagagem/passageiros/etc)

Manter:
- Ver logs
- Cancelar (com label "Cancelar (emergência)")

- [ ] **Step 2: Escrever teste**

```tsx
// src/components/TripDetailModal.test.tsx (adicionar novo caso)
it('hides standard action buttons for flash trips', () => {
  const flashTrip = { id: '1', trip_type: 'flash', status: 'searching_drivers' } as any;
  render(<TripDetailModal trip={flashTrip} onClose={() => {}} />);
  expect(screen.queryByText(/Aprovar/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Selecionar motorista/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Cancelar/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Modificar. Em cada botão de standard:**

```tsx
{!isFlashTrip(trip) && <button onClick={...}>Aprovar</button>}
```

E o botão de cancelar:

```tsx
<button onClick={...}>
  {isFlashTrip(trip) ? 'Cancelar (emergência)' : 'Cancelar'}
</button>
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(admin): guard standard-only actions in TripDetailModal for flash"
```

---

## Phase 5 — App cliente Flash flow (Flutter)

**Contexto:** app usa BLoC/Cubit + go_router + Supabase realtime `.channel().onPostgresChanges()`. Cubits comuns em `presentation/cubit/`, models em `data/models/` com `fromJson`+`toEntity`.

### Task 18: Model `FlashProposalModel` + entity + teste

**Files:**
- Create: `lib/features/trip/domain/entities/flash_proposal.dart`
- Create: `lib/features/trip/data/models/flash_proposal_model.dart`
- Create: `test/features/trip/data/flash_proposal_model_test.dart`

- [ ] **Step 1: Entity**

```dart
// lib/features/trip/domain/entities/flash_proposal.dart
import 'package:equatable/equatable.dart';

class FlashProposal extends Equatable {
  final String candidateId;
  final String tripId;
  final String driverProfileId;
  final String driverName;
  final String? driverPhotoUrl;
  final String vehicleLabel; // "Onix Prata"
  final double offeredPrice;
  final DateTime createdAt;
  final double? etaMinutes; // null se localização indisponível
  final double? driverRatingAvg;
  final int driverFinishedTrips;

  const FlashProposal({
    required this.candidateId,
    required this.tripId,
    required this.driverProfileId,
    required this.driverName,
    required this.driverPhotoUrl,
    required this.vehicleLabel,
    required this.offeredPrice,
    required this.createdAt,
    required this.etaMinutes,
    required this.driverRatingAvg,
    required this.driverFinishedTrips,
  });

  @override
  List<Object?> get props => [candidateId, tripId, offeredPrice, createdAt];
}
```

- [ ] **Step 2: Model + test**

```dart
// test/features/trip/data/flash_proposal_model_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app_cliente/features/trip/data/models/flash_proposal_model.dart';

void main() {
  group('FlashProposalModel.fromJson', () {
    test('parses candidate + driver join payload', () {
      final json = {
        'id': 'cand-1',
        'trip_id': 'trip-1',
        'driver_profile_id': 'drv-1',
        'offered_price': '55.00',
        'created_at': '2026-07-29T12:00:00Z',
        'driver_profiles': {
          'photo_url': 'https://x/y.png',
          'provider_profiles': {'user': {'name': 'João Silva'}},
          'vehicles': [{'brand': 'Chevrolet', 'model': 'Onix', 'color': 'Prata'}],
        },
      };
      final m = FlashProposalModel.fromJson(json);
      expect(m.candidateId, 'cand-1');
      expect(m.offeredPrice, 55.0);
      expect(m.driverName, 'João Silva');
      expect(m.vehicleLabel, contains('Onix'));
    });
  });
}
```

Run: `flutter test test/features/trip/data/flash_proposal_model_test.dart` — Expected: FAIL.

- [ ] **Step 3: Implement model**

```dart
// lib/features/trip/data/models/flash_proposal_model.dart
import '../../domain/entities/flash_proposal.dart';

class FlashProposalModel {
  final String candidateId;
  final String tripId;
  final String driverProfileId;
  final String driverName;
  final String? driverPhotoUrl;
  final String vehicleLabel;
  final double offeredPrice;
  final DateTime createdAt;

  FlashProposalModel({
    required this.candidateId,
    required this.tripId,
    required this.driverProfileId,
    required this.driverName,
    required this.driverPhotoUrl,
    required this.vehicleLabel,
    required this.offeredPrice,
    required this.createdAt,
  });

  factory FlashProposalModel.fromJson(Map<String, dynamic> json) {
    final driver = (json['driver_profiles'] as Map?) ?? {};
    final provider = (driver['provider_profiles'] as Map?) ?? {};
    final user = (provider['user'] as Map?) ?? {};
    final vehiclesRaw = driver['vehicles'];
    final vehicles = vehiclesRaw is List ? vehiclesRaw : const [];
    final v = vehicles.isNotEmpty ? vehicles.first as Map : const {};
    final brand = v['brand'] ?? '';
    final model = v['model'] ?? '';
    final color = v['color'] ?? '';
    return FlashProposalModel(
      candidateId: json['id'] as String,
      tripId: json['trip_id'] as String,
      driverProfileId: json['driver_profile_id'] as String,
      driverName: (user['name'] as String?) ?? 'Motorista',
      driverPhotoUrl: driver['photo_url'] as String?,
      vehicleLabel: '$brand $model $color'.trim(),
      offeredPrice: double.parse(json['offered_price'].toString()),
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  FlashProposal toEntity({
    double? etaMinutes,
    double? driverRatingAvg,
    int driverFinishedTrips = 0,
  }) =>
      FlashProposal(
        candidateId: candidateId,
        tripId: tripId,
        driverProfileId: driverProfileId,
        driverName: driverName,
        driverPhotoUrl: driverPhotoUrl,
        vehicleLabel: vehicleLabel,
        offeredPrice: offeredPrice,
        createdAt: createdAt,
        etaMinutes: etaMinutes,
        driverRatingAvg: driverRatingAvg,
        driverFinishedTrips: driverFinishedTrips,
      );
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(client): FlashProposal entity + model"
```

---

### Task 19: Repository `FlashTripRepository` (contract + impl)

**Files:**
- Create: `lib/features/trip/domain/repositories/flash_trip_repository.dart`
- Create: `lib/features/trip/data/repositories/flash_trip_repository_impl.dart`

- [ ] **Step 1: Contract**

```dart
// lib/features/trip/domain/repositories/flash_trip_repository.dart
abstract class FlashTripRepository {
  Future<String> createFlashTrip({
    required String pickupAddressId,
    required String dropoffAddressId,
    required String serviceCategoryId,
    required int passengerCount,
    required int childrenCount,
    required int luggageCount,
    required String observations,
  });

  Future<void> acceptProposal(String candidateId);
  Future<void> cancelFlashTrip(String tripId, String reason);
  Stream<List<Map<String, dynamic>>> watchProposals(String tripId);
  Stream<Map<String, dynamic>> watchTripStatus(String tripId);
}
```

- [ ] **Step 2: Impl (sem TDD detalhado nesta task — coberto no cubit test com mock)**

```dart
// lib/features/trip/data/repositories/flash_trip_repository_impl.dart
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/repositories/flash_trip_repository.dart';

class FlashTripRepositoryImpl implements FlashTripRepository {
  final SupabaseClient client;
  FlashTripRepositoryImpl({required this.client});

  @override
  Future<String> createFlashTrip({
    required String pickupAddressId,
    required String dropoffAddressId,
    required String serviceCategoryId,
    required int passengerCount,
    required int childrenCount,
    required int luggageCount,
    required String observations,
  }) async {
    final result = await client.rpc('create_flash_trip', params: {
      'p_pickup_address_id': pickupAddressId,
      'p_dropoff_address_id': dropoffAddressId,
      'p_service_category_id': serviceCategoryId,
      'p_passenger_count': passengerCount,
      'p_children_count': childrenCount,
      'p_luggage_count': luggageCount,
      'p_observations': observations,
    });
    return result as String;
  }

  @override
  Future<void> acceptProposal(String candidateId) async {
    await client.rpc('client_accept_flash_proposal',
        params: {'p_candidate_id': candidateId});
  }

  @override
  Future<void> cancelFlashTrip(String tripId, String reason) async {
    await client.rpc('cancel_flash_trip',
        params: {'p_trip_id': tripId, 'p_reason': reason});
  }

  @override
  Stream<List<Map<String, dynamic>>> watchProposals(String tripId) {
    return client
        .from('trip_driver_candidates')
        .stream(primaryKey: ['id'])
        .eq('trip_id', tripId)
        .order('created_at', ascending: false)
        .map((rows) => rows
            .where((r) => r['status'] == 'accepted' && r['offered_price'] != null)
            .toList());
  }

  @override
  Stream<Map<String, dynamic>> watchTripStatus(String tripId) {
    return client
        .from('trips')
        .stream(primaryKey: ['id'])
        .eq('id', tripId)
        .map((rows) => rows.first);
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(client): FlashTripRepository contract + supabase impl"
```

---

### Task 20: `FlashCreationCubit` + testes

**Files:**
- Create: `lib/features/trip/presentation/cubit/flash_creation_state.dart`
- Create: `lib/features/trip/presentation/cubit/flash_creation_cubit.dart`
- Create: `test/features/trip/presentation/cubit/flash_creation_cubit_test.dart`

- [ ] **Step 1: State**

```dart
// lib/features/trip/presentation/cubit/flash_creation_state.dart
import 'package:equatable/equatable.dart';

sealed class FlashCreationState extends Equatable {
  const FlashCreationState();
  @override List<Object?> get props => [];
}

class FlashCreationInitial extends FlashCreationState { const FlashCreationInitial(); }
class FlashCreationLoading extends FlashCreationState { const FlashCreationLoading(); }
class FlashCreationSuccess extends FlashCreationState {
  final String tripId; const FlashCreationSuccess(this.tripId);
  @override List<Object?> get props => [tripId];
}
class FlashCreationError extends FlashCreationState {
  final String message; const FlashCreationError(this.message);
  @override List<Object?> get props => [message];
}
```

- [ ] **Step 2: Test**

```dart
// test/features/trip/presentation/cubit/flash_creation_cubit_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app_cliente/features/trip/domain/repositories/flash_trip_repository.dart';
import 'package:kz_servicos_app_cliente/features/trip/presentation/cubit/flash_creation_cubit.dart';
import 'package:kz_servicos_app_cliente/features/trip/presentation/cubit/flash_creation_state.dart';

class _MockRepo extends Mock implements FlashTripRepository {}

void main() {
  late _MockRepo repo;
  setUp(() { repo = _MockRepo(); });

  blocTest<FlashCreationCubit, FlashCreationState>(
    'emits [Loading, Success] on happy path',
    build: () {
      when(() => repo.createFlashTrip(
        pickupAddressId: any(named: 'pickupAddressId'),
        dropoffAddressId: any(named: 'dropoffAddressId'),
        serviceCategoryId: any(named: 'serviceCategoryId'),
        passengerCount: any(named: 'passengerCount'),
        childrenCount: any(named: 'childrenCount'),
        luggageCount: any(named: 'luggageCount'),
        observations: any(named: 'observations'),
      )).thenAnswer((_) async => 'trip-xyz');
      return FlashCreationCubit(repository: repo);
    },
    act: (c) => c.submit(
      pickupAddressId: 'p', dropoffAddressId: 'd',
      serviceCategoryId: 'cat', passengerCount: 1,
      childrenCount: 0, luggageCount: 0, observations: '',
    ),
    expect: () => [
      isA<FlashCreationLoading>(),
      isA<FlashCreationSuccess>().having((s) => s.tripId, 'tripId', 'trip-xyz'),
    ],
  );

  blocTest<FlashCreationCubit, FlashCreationState>(
    'emits [Loading, Error] on repo failure',
    build: () {
      when(() => repo.createFlashTrip(
        pickupAddressId: any(named: 'pickupAddressId'),
        dropoffAddressId: any(named: 'dropoffAddressId'),
        serviceCategoryId: any(named: 'serviceCategoryId'),
        passengerCount: any(named: 'passengerCount'),
        childrenCount: any(named: 'childrenCount'),
        luggageCount: any(named: 'luggageCount'),
        observations: any(named: 'observations'),
      )).thenThrow(Exception('boom'));
      return FlashCreationCubit(repository: repo);
    },
    act: (c) => c.submit(
      pickupAddressId: 'p', dropoffAddressId: 'd',
      serviceCategoryId: 'cat', passengerCount: 1,
      childrenCount: 0, luggageCount: 0, observations: '',
    ),
    expect: () => [
      isA<FlashCreationLoading>(),
      isA<FlashCreationError>(),
    ],
  );
}
```

Run: `flutter test test/features/trip/presentation/cubit/flash_creation_cubit_test.dart` → FAIL.

- [ ] **Step 3: Cubit**

```dart
// lib/features/trip/presentation/cubit/flash_creation_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/flash_trip_repository.dart';
import 'flash_creation_state.dart';

class FlashCreationCubit extends Cubit<FlashCreationState> {
  final FlashTripRepository repository;
  FlashCreationCubit({required this.repository}) : super(const FlashCreationInitial());

  Future<void> submit({
    required String pickupAddressId,
    required String dropoffAddressId,
    required String serviceCategoryId,
    required int passengerCount,
    required int childrenCount,
    required int luggageCount,
    required String observations,
  }) async {
    emit(const FlashCreationLoading());
    try {
      final id = await repository.createFlashTrip(
        pickupAddressId: pickupAddressId,
        dropoffAddressId: dropoffAddressId,
        serviceCategoryId: serviceCategoryId,
        passengerCount: passengerCount,
        childrenCount: childrenCount,
        luggageCount: luggageCount,
        observations: observations,
      );
      emit(FlashCreationSuccess(id));
    } catch (e) {
      emit(FlashCreationError(e.toString()));
    }
  }
}
```

- [ ] **Step 4: Run — PASS 2/2**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(client): FlashCreationCubit with submit path"
```

---

### Task 21: `FlashSearchingCubit` + realtime + testes

**Files:**
- Create: `lib/features/trip/presentation/cubit/flash_searching_state.dart`
- Create: `lib/features/trip/presentation/cubit/flash_searching_cubit.dart`
- Create: `test/features/trip/presentation/cubit/flash_searching_cubit_test.dart`

- [ ] **Step 1: State**

```dart
// lib/features/trip/presentation/cubit/flash_searching_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/flash_proposal.dart';

sealed class FlashSearchingState extends Equatable {
  const FlashSearchingState();
  @override List<Object?> get props => [];
}

class FlashSearchingIdle extends FlashSearchingState { const FlashSearchingIdle(); }
class FlashSearchingProposals extends FlashSearchingState {
  final List<FlashProposal> proposals;
  const FlashSearchingProposals(this.proposals);
  @override List<Object?> get props => [proposals];
}
class FlashSearchingAwaitingDriver extends FlashSearchingState {
  final String driverName;
  const FlashSearchingAwaitingDriver(this.driverName);
  @override List<Object?> get props => [driverName];
}
class FlashSearchingReadyToStart extends FlashSearchingState { const FlashSearchingReadyToStart(); }
class FlashSearchingCancelled extends FlashSearchingState { const FlashSearchingCancelled(); }
class FlashSearchingError extends FlashSearchingState {
  final String message; const FlashSearchingError(this.message);
  @override List<Object?> get props => [message];
}
```

- [ ] **Step 2: Test — emissões básicas**

```dart
// test/features/trip/presentation/cubit/flash_searching_cubit_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:kz_servicos_app_cliente/features/trip/domain/repositories/flash_trip_repository.dart';
import 'package:kz_servicos_app_cliente/features/trip/presentation/cubit/flash_searching_cubit.dart';
import 'package:kz_servicos_app_cliente/features/trip/presentation/cubit/flash_searching_state.dart';

class _MockRepo extends Mock implements FlashTripRepository {}

void main() {
  late _MockRepo repo;
  const tripId = 'trip-1';

  setUp(() {
    repo = _MockRepo();
    when(() => repo.watchProposals(tripId))
        .thenAnswer((_) => Stream.value([
              {
                'id': 'cand-1', 'trip_id': tripId, 'driver_profile_id': 'd1',
                'offered_price': '55.00', 'created_at': '2026-07-29T12:00:00Z',
                'status': 'accepted',
                'driver_profiles': {
                  'photo_url': null,
                  'provider_profiles': {'user': {'name': 'João'}},
                  'vehicles': [{'brand': 'Onix', 'model': 'LT', 'color': 'Prata'}],
                },
              }
            ]));
    when(() => repo.watchTripStatus(tripId))
        .thenAnswer((_) => Stream.value({'status': 'searching_drivers'}));
  });

  blocTest<FlashSearchingCubit, FlashSearchingState>(
    'emits FlashSearchingProposals when a proposal arrives',
    build: () => FlashSearchingCubit(repository: repo, tripId: tripId),
    act: (c) => c.start(),
    wait: const Duration(milliseconds: 100),
    expect: () => [isA<FlashSearchingProposals>()],
  );
}
```

- [ ] **Step 3: Cubit**

```dart
// lib/features/trip/presentation/cubit/flash_searching_cubit.dart
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/flash_proposal_model.dart';
import '../../domain/repositories/flash_trip_repository.dart';
import 'flash_searching_state.dart';

class FlashSearchingCubit extends Cubit<FlashSearchingState> {
  final FlashTripRepository repository;
  final String tripId;
  StreamSubscription? _proposalsSub;
  StreamSubscription? _statusSub;

  FlashSearchingCubit({required this.repository, required this.tripId})
      : super(const FlashSearchingIdle());

  void start() {
    _proposalsSub = repository.watchProposals(tripId).listen((rows) {
      final proposals = rows
          .map((r) => FlashProposalModel.fromJson(r).toEntity())
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      emit(FlashSearchingProposals(proposals));
    });
    _statusSub = repository.watchTripStatus(tripId).listen((row) {
      final status = row['status'] as String?;
      switch (status) {
        case 'awaiting_driver_confirmation':
          emit(const FlashSearchingAwaitingDriver('Motorista'));
          break;
        case 'scheduled':
        case 'started':
          emit(const FlashSearchingReadyToStart());
          break;
        case 'cancelled':
          emit(const FlashSearchingCancelled());
          break;
        case 'searching_drivers':
          // volta ao estado de propostas — deixado ao próximo update de propostas
          break;
      }
    });
  }

  Future<void> acceptProposal(String candidateId) async {
    try {
      await repository.acceptProposal(candidateId);
    } catch (e) {
      emit(FlashSearchingError(e.toString()));
    }
  }

  Future<void> cancelTrip(String reason) async {
    try {
      await repository.cancelFlashTrip(tripId, reason);
    } catch (e) {
      emit(FlashSearchingError(e.toString()));
    }
  }

  @override
  Future<void> close() async {
    await _proposalsSub?.cancel();
    await _statusSub?.cancel();
    return super.close();
  }
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(client): FlashSearchingCubit with realtime proposals + status"
```

---

### Task 22: `TripTypeChoiceSheet` — bottomsheet inicial

**Files:**
- Create: `lib/features/trip/presentation/widgets/trip_type_choice_sheet.dart`
- Create: `test/features/trip/presentation/widgets/trip_type_choice_sheet_test.dart`

- [ ] **Step 1: Test**

```dart
// test/features/trip/presentation/widgets/trip_type_choice_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app_cliente/features/trip/presentation/widgets/trip_type_choice_sheet.dart';

void main() {
  testWidgets('renders both options and returns "flash" on tap', (tester) async {
    String? picked;
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (ctx) {
      return ElevatedButton(
        onPressed: () async {
          picked = await showModalBottomSheet<String>(
            context: ctx, builder: (_) => const TripTypeChoiceSheet());
        },
        child: const Text('open'),
      );
    })));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Preciso de uma viagem agora'), findsOneWidget);
    expect(find.text('Quero agendar uma viagem'), findsOneWidget);
    await tester.tap(find.text('Preciso de uma viagem agora'));
    await tester.pumpAndSettle();
    expect(picked, 'flash');
  });
}
```

- [ ] **Step 2: Implement**

```dart
// lib/features/trip/presentation/widgets/trip_type_choice_sheet.dart
import 'package:flutter/material.dart';

class TripTypeChoiceSheet extends StatelessWidget {
  const TripTypeChoiceSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Text('⚡', style: TextStyle(fontSize: 28)),
              title: const Text('Preciso de uma viagem agora'),
              subtitle: const Text('Corrida Flash — motoristas próximos'),
              onTap: () => Navigator.of(context).pop('flash'),
            ),
            const Divider(),
            ListTile(
              leading: const Text('📅', style: TextStyle(fontSize: 24)),
              title: const Text('Quero agendar uma viagem'),
              subtitle: const Text('Escolha data, horário e opções'),
              onTap: () => Navigator.of(context).pop('scheduled'),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Run — PASS**

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(client): TripTypeChoiceSheet for flash/scheduled selection"
```

---

### Task 23: `FlashProposalCard` widget

**Files:**
- Create: `lib/features/trip/presentation/widgets/flash_proposal_card.dart`
- Create: `test/features/trip/presentation/widgets/flash_proposal_card_test.dart`

- [ ] **Step 1: Test — renderiza campos-chave**

```dart
// test/features/trip/presentation/widgets/flash_proposal_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app_cliente/features/trip/domain/entities/flash_proposal.dart';
import 'package:kz_servicos_app_cliente/features/trip/presentation/widgets/flash_proposal_card.dart';

void main() {
  testWidgets('renders name, vehicle and price', (tester) async {
    final p = FlashProposal(
      candidateId: 'c', tripId: 't', driverProfileId: 'd',
      driverName: 'João', driverPhotoUrl: null, vehicleLabel: 'Onix Prata',
      offeredPrice: 55.5, createdAt: DateTime.now(),
      etaMinutes: 12, driverRatingAvg: 4.8, driverFinishedTrips: 100,
    );
    await tester.pumpWidget(MaterialApp(home: Scaffold(
      body: FlashProposalCard(proposal: p, onTap: () {}),
    )));
    expect(find.text('João'), findsOneWidget);
    expect(find.text('Onix Prata'), findsOneWidget);
    expect(find.textContaining('R\$'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Implement**

```dart
// lib/features/trip/presentation/widgets/flash_proposal_card.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/flash_proposal.dart';

class FlashProposalCard extends StatelessWidget {
  final FlashProposal proposal;
  final VoidCallback onTap;
  const FlashProposalCard({super.key, required this.proposal, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundImage: proposal.driverPhotoUrl != null
              ? NetworkImage(proposal.driverPhotoUrl!) : null,
          child: proposal.driverPhotoUrl == null
              ? Text(proposal.driverName.characters.first) : null,
        ),
        title: Text(proposal.driverName),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(proposal.vehicleLabel),
            Text(proposal.etaMinutes == null
                ? 'ETA indisponível'
                : '${proposal.etaMinutes!.round()} min até você'),
          ],
        ),
        trailing: Text(
          money.format(proposal.offeredPrice),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        onTap: onTap,
      ),
    );
  }
}
```

Adicionar dependência (se não existir): `intl: ^0.19.0` em `pubspec.yaml`.

- [ ] **Step 3: Run — PASS**

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(client): FlashProposalCard widget"
```

---

### Task 24: `FlashDriverProfileModal`

**Files:**
- Create: `lib/features/trip/presentation/widgets/flash_driver_profile_modal.dart`

- [ ] **Step 1: Implement — modal com dados do motorista**

Fetch adicional necessário (ratings + finished trips + photos) — método no repositório:

```dart
// Adicionar em FlashTripRepository:
Future<Map<String, dynamic>> fetchDriverDetails(String driverProfileId);
```

Impl no repositório:

```dart
@override
Future<Map<String, dynamic>> fetchDriverDetails(String driverProfileId) async {
  final [details, ratings, count, photos, vehiclePhotos] = await Future.wait([
    client.from('driver_profiles').select('*, provider_profiles(user:users(name))').eq('id', driverProfileId).single(),
    client.from('ratings').select('rating').eq('rated_user_id', driverProfileId),
    client.from('trips').select('id').eq('driver_profile_id', driverProfileId).eq('status', 'finished').count(),
    client.from('driver_profile_photos').select('url').eq('driver_profile_id', driverProfileId),
    client.from('vehicle_photos').select('url').eq('driver_profile_id', driverProfileId),
  ]);
  final ratingsList = (ratings as List).map((r) => (r as Map)['rating'] as num).toList();
  final avg = ratingsList.isEmpty ? null
      : ratingsList.fold<double>(0, (a, b) => a + b.toDouble()) / ratingsList.length;
  return {
    'details': details, 'ratingAvg': avg, 'ratingsCount': ratingsList.length,
    'finishedTrips': count.count ?? 0,
    'profilePhotos': (photos as List).map((e) => (e as Map)['url']).toList(),
    'vehiclePhotos': (vehiclePhotos as List).map((e) => (e as Map)['url']).toList(),
  };
}
```

- [ ] **Step 2: UI modal**

```dart
// lib/features/trip/presentation/widgets/flash_driver_profile_modal.dart
import 'package:flutter/material.dart';
import '../../domain/entities/flash_proposal.dart';
import '../../domain/repositories/flash_trip_repository.dart';

class FlashDriverProfileModal extends StatefulWidget {
  final FlashProposal proposal;
  final FlashTripRepository repository;
  final Future<void> Function() onAccept;
  const FlashDriverProfileModal({
    super.key, required this.proposal, required this.repository, required this.onAccept,
  });

  @override
  State<FlashDriverProfileModal> createState() => _FlashDriverProfileModalState();
}

class _FlashDriverProfileModalState extends State<FlashDriverProfileModal> {
  Map<String, dynamic>? data;

  @override
  void initState() {
    super.initState();
    widget.repository
        .fetchDriverDetails(widget.proposal.driverProfileId)
        .then((d) => setState(() => data = d))
        .catchError((_) => setState(() => data = {}));
  }

  @override
  Widget build(BuildContext context) {
    if (data == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final photos = (data!['profilePhotos'] as List?) ?? const [];
    final vehiclePhotos = (data!['vehiclePhotos'] as List?) ?? const [];
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.proposal.driverName),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            const Icon(Icons.star, color: Colors.amber),
            Text(' ${data!['ratingAvg']?.toStringAsFixed(1) ?? '—'}'
                 ' (${data!['ratingsCount']} avaliações)'),
            const Spacer(),
            Text('${data!['finishedTrips']} corridas'),
          ]),
          const SizedBox(height: 12),
          Text('Veículo: ${widget.proposal.vehicleLabel}'),
          const SizedBox(height: 12),
          _photoGrid('Fotos do motorista', photos),
          _photoGrid('Fotos do veículo', vehiclePhotos),
          const SizedBox(height: 24),
          Center(child: Text(
            'R\$ ${widget.proposal.offeredPrice.toStringAsFixed(2)}',
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
          )),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () async {
              await widget.onAccept();
              if (mounted) Navigator.pop(context);
            },
            child: const Text('Aceitar proposta'),
          ),
        ],
      ),
    );
  }

  Widget _photoGrid(String title, List photos) {
    if (photos.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 12),
      Text(title, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      GridView.count(
        crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 4, crossAxisSpacing: 4,
        children: photos.map<Widget>((u) => Image.network(u as String, fit: BoxFit.cover)).toList(),
      ),
    ]);
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(client): FlashDriverProfileModal with fetched driver details"
```

---

### Task 25: `FlashDetailsPage` — tela de detalhes da corrida

**Files:**
- Create: `lib/features/trip/presentation/pages/flash_details_page.dart`

- [ ] **Step 1: Implement — formulário simples**

```dart
// lib/features/trip/presentation/pages/flash_details_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../cubit/flash_creation_cubit.dart';
import '../cubit/flash_creation_state.dart';

class FlashDetailsPage extends StatefulWidget {
  final String pickupAddressId;
  final String dropoffAddressId;
  final String serviceCategoryId;
  const FlashDetailsPage({
    super.key,
    required this.pickupAddressId,
    required this.dropoffAddressId,
    required this.serviceCategoryId,
  });

  @override
  State<FlashDetailsPage> createState() => _FlashDetailsPageState();
}

class _FlashDetailsPageState extends State<FlashDetailsPage> {
  int passengers = 1, children = 0, luggage = 0;
  final obsController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return BlocListener<FlashCreationCubit, FlashCreationState>(
      listener: (context, state) {
        if (state is FlashCreationSuccess) {
          context.go('/flash/searching/${state.tripId}');
        } else if (state is FlashCreationError) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(state.message)));
        }
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Detalhes da corrida Flash')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _stepperRow('Passageiros', passengers, (v) => setState(() => passengers = v), min: 1),
            _stepperRow('Crianças', children, (v) => setState(() => children = v)),
            _stepperRow('Bagagens', luggage, (v) => setState(() => luggage = v)),
            TextField(
              controller: obsController,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Observações (opcional)'),
            ),
            const SizedBox(height: 24),
            BlocBuilder<FlashCreationCubit, FlashCreationState>(
              builder: (ctx, state) => ElevatedButton(
                onPressed: state is FlashCreationLoading ? null : () {
                  ctx.read<FlashCreationCubit>().submit(
                    pickupAddressId: widget.pickupAddressId,
                    dropoffAddressId: widget.dropoffAddressId,
                    serviceCategoryId: widget.serviceCategoryId,
                    passengerCount: passengers,
                    childrenCount: children,
                    luggageCount: luggage,
                    observations: obsController.text,
                  );
                },
                child: state is FlashCreationLoading
                    ? const CircularProgressIndicator()
                    : const Text('Solicitar Flash'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepperRow(String label, int value, ValueChanged<int> onChanged, {int min = 0}) {
    return Row(children: [
      Expanded(child: Text(label)),
      IconButton(
        icon: const Icon(Icons.remove),
        onPressed: value > min ? () => onChanged(value - 1) : null),
      Text('$value'),
      IconButton(icon: const Icon(Icons.add), onPressed: () => onChanged(value + 1)),
    ]);
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git commit -am "feat(client): FlashDetailsPage (passengers, children, luggage, obs)"
```

---

### Task 26: `FlashSearchingPage`

**Files:**
- Create: `lib/features/trip/presentation/pages/flash_searching_page.dart`

- [ ] **Step 1: Implement**

```dart
// lib/features/trip/presentation/pages/flash_searching_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../cubit/flash_searching_cubit.dart';
import '../cubit/flash_searching_state.dart';
import '../widgets/flash_proposal_card.dart';
import '../widgets/flash_driver_profile_modal.dart';

class FlashSearchingPage extends StatefulWidget {
  final String tripId;
  const FlashSearchingPage({super.key, required this.tripId});

  @override
  State<FlashSearchingPage> createState() => _FlashSearchingPageState();
}

class _FlashSearchingPageState extends State<FlashSearchingPage> {
  @override
  void initState() {
    super.initState();
    context.read<FlashSearchingCubit>().start();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<FlashSearchingCubit, FlashSearchingState>(
      listener: (ctx, state) {
        if (state is FlashSearchingReadyToStart) {
          context.go('/active-trip?tripId=${widget.tripId}');
        } else if (state is FlashSearchingCancelled) {
          context.go('/home');
        } else if (state is FlashSearchingError) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.message)));
        }
      },
      builder: (ctx, state) => Scaffold(
        appBar: AppBar(
          title: const Text('Buscando motoristas'),
          actions: [
            TextButton(
              onPressed: () => ctx.read<FlashSearchingCubit>().cancelTrip('Cliente cancelou'),
              child: const Text('Cancelar', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
        body: switch (state) {
          FlashSearchingProposals(:final proposals) when proposals.isNotEmpty =>
              ListView(children: proposals.map((p) => FlashProposalCard(
                proposal: p,
                onTap: () => _openProfile(ctx, p),
              )).toList()),
          FlashSearchingAwaitingDriver(:final driverName) =>
              Center(child: Text('Aguardando $driverName confirmar...')),
          _ => const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Buscando motoristas...'),
            ])),
        },
      ),
    );
  }

  Future<void> _openProfile(BuildContext ctx, dynamic proposal) async {
    final cubit = ctx.read<FlashSearchingCubit>();
    await showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.9,
        child: FlashDriverProfileModal(
          proposal: proposal,
          repository: cubit.repository,
          onAccept: () => cubit.acceptProposal(proposal.candidateId),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git commit -am "feat(client): FlashSearchingPage with proposal list + profile modal"
```

---

### Task 27: Rotas e wiring do BottomSheet no `trip_home_page.dart`

**Files:**
- Modify: `lib/routes/app_router.dart`
- Modify: `lib/features/trip/presentation/pages/trip_home_page.dart`

- [ ] **Step 1: Adicionar rotas em `app_router.dart`**

```dart
// dentro do GoRouter routes: []:
GoRoute(
  path: '/flash/details',
  builder: (ctx, state) {
    final args = state.extra as Map<String, String>;
    return BlocProvider(
      create: (_) => FlashCreationCubit(
        repository: FlashTripRepositoryImpl(client: Supabase.instance.client),
      ),
      child: FlashDetailsPage(
        pickupAddressId: args['pickup']!,
        dropoffAddressId: args['dropoff']!,
        serviceCategoryId: args['category']!,
      ),
    );
  },
),
GoRoute(
  path: '/flash/searching/:tripId',
  builder: (ctx, state) {
    final tripId = state.pathParameters['tripId']!;
    return BlocProvider(
      create: (_) => FlashSearchingCubit(
        repository: FlashTripRepositoryImpl(client: Supabase.instance.client),
        tripId: tripId,
      ),
      child: FlashSearchingPage(tripId: tripId),
    );
  },
),
```

- [ ] **Step 2: Modificar `trip_home_page.dart` — no handler de tap do campo de endereço:**

Encontrar o gesture detector/tap do endereço; substituir por:

```dart
onTap: () async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (_) => const TripTypeChoiceSheet(),
  );
  if (choice == 'flash') {
    // Continua fluxo Flash — passa por endereços e categoria, depois:
    // context.go('/flash/details', extra: {'pickup':..., 'dropoff':..., 'category':...});
  } else if (choice == 'scheduled') {
    // fluxo atual de agendamento (stub) — cai no fluxo standard existente
    _openAddressSearch(); // função existente
  }
},
```

Nota: o app cliente atual tem fluxo com `TripFlowStep` enum. A escolha 'flash' entra em uma variante desse mesmo fluxo — reutilizar `address_search_sheet.dart` para pickup/dropoff, depois navegar para `/flash/details`.

- [ ] **Step 3: Testar visualmente**

```powershell
flutter run -d chrome
```

Verificar: tap no endereço → sheet → escolher Flash → fluxo Flash.

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(client): wire Flash routes and BottomSheet entry"
```

---

### Task 28: `ActiveFlashTripGate` — retomada ao abrir app

**Files:**
- Modify: `lib/routes/app_router.dart` (redirect + query existente)
- Create: `lib/features/trip/data/services/active_flash_gate.dart`

- [ ] **Step 1: Serviço de check**

```dart
// lib/features/trip/data/services/active_flash_gate.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class ActiveFlashGate {
  final SupabaseClient client;
  ActiveFlashGate({required this.client});

  Future<String?> resolveTargetPath() async {
    final user = client.auth.currentUser;
    if (user == null) return null;
    final rows = await client
        .from('trips')
        .select('id, status')
        .eq('client_id', user.id)
        .eq('trip_type', 'flash')
        .inFilter('status', [
          'searching_drivers','awaiting_driver_confirmation','scheduled','started',
        ])
        .order('created_at', ascending: false)
        .limit(1);
    if (rows.isEmpty) return null;
    final trip = rows.first;
    switch (trip['status']) {
      case 'searching_drivers':
      case 'awaiting_driver_confirmation':
        return '/flash/searching/${trip['id']}';
      case 'scheduled':
      case 'started':
        return '/active-trip?tripId=${trip['id']}';
    }
    return null;
  }
}
```

- [ ] **Step 2: Hook no router — no `redirect` global do GoRouter, adicionar:**

```dart
redirect: (ctx, state) async {
  // ... auth guard existente
  if (state.matchedLocation == '/home') {
    final gate = ActiveFlashGate(client: Supabase.instance.client);
    final target = await gate.resolveTargetPath();
    if (target != null && target != state.matchedLocation) return target;
  }
  return null;
},
```

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(client): ActiveFlashGate resumes user into active flash trip"
```

---

## Phase 6 — App prestador Flash flow (Flutter)

**Contexto:** app do motorista usa StatefulWidget + `TripService`. Push handling em `push_notification_service.dart`. Realtime é via polling/queries diretas + subscriptions ad-hoc.

### Task 29: Adicionar `tripType` em `TripData`

**Files:**
- Modify: `lib/core/models/trip_data.dart`
- Modify: `test/core/models/trip_data_test.dart` (se existir; senão criar)

- [ ] **Step 1: Test**

```dart
// test/core/models/trip_data_test.dart (adicionar)
test('parses trip_type=flash', () {
  final t = TripData.fromMap({
    'trip_id': 't', 'client_name': 'C', 'origin_lat': 0, 'origin_lng': 0,
    'destination_lat': 0, 'destination_lng': 0, 'status': 'searching_drivers',
    'trip_type': 'flash',
  });
  expect(t.tripType, 'flash');
});
```

- [ ] **Step 2: Modificar `TripData`**

Adicionar campo `final String tripType;` (default 'standard'), incluir no `fromMap`:

```dart
tripType: (map['trip_type'] as String?) ?? 'standard',
```

- [ ] **Step 3: Run — PASS**

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(driver): add tripType to TripData"
```

---

### Task 30: `FlashTripService`

**Files:**
- Create: `lib/core/services/flash_trip_service.dart`

- [ ] **Step 1: Implement**

```dart
// lib/core/services/flash_trip_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class FlashTripService {
  final SupabaseClient client;
  FlashTripService({required this.client});

  Future<Map<String, dynamic>> loadIncomingCall(String tripId) async {
    return await client
        .from('trips')
        .select('*, pickup:addresses!pickup_address_id(*), dropoff:addresses!dropoff_address_id(*), client:users!client_id(*)')
        .eq('id', tripId)
        .single();
  }

  Future<void> sendProposal(String tripId, double price) async {
    await client.rpc('driver_send_flash_proposal',
        params: {'p_trip_id': tripId, 'p_price': price});
  }

  Future<void> rejectCall(String tripId) async {
    await client.rpc('reject_flash_call', params: {'p_trip_id': tripId});
  }

  Future<void> recheckConfirm(String tripId) async {
    await client.rpc('driver_flash_recheck_confirm', params: {'p_trip_id': tripId});
  }

  Future<void> recheckReject(String tripId) async {
    await client.rpc('driver_flash_recheck_reject', params: {'p_trip_id': tripId});
  }

  Stream<Map<String, dynamic>> watchTripStatus(String tripId) {
    return client
        .from('trips')
        .stream(primaryKey: ['id'])
        .eq('id', tripId)
        .map((rows) => rows.first);
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git commit -am "feat(driver): FlashTripService with RPC methods"
```

---

### Task 31: Push handler reconhece `trip_type='flash'`

**Files:**
- Modify: `lib/core/services/push_notification_service.dart` (função `buildOpenedMessageLocation`)

- [ ] **Step 1: Alteração**

```dart
static String? buildOpenedMessageLocation(Map<String, dynamic> data) {
  final tripType = '${data['trip_type'] ?? ''}';
  final tripId = '${data['trip_id'] ?? ''}'.trim();
  if (tripType == 'flash' && tripId.isNotEmpty) {
    final route = '${data['route'] ?? '/flash/incoming'}';
    return '$route?tripId=${Uri.encodeComponent(tripId)}';
  }
  // fallback: lógica existente
  final type = '${data['type'] ?? data['event'] ?? ''}';
  if ((type == 'trip_request' || type == 'new_trip_request' ||
       type == 'recheck' || type == 'awaiting_driver_confirmation') &&
      tripId.isNotEmpty) {
    return '/home?tripRequestId=${Uri.encodeComponent(tripId)}';
  }
  if (type == 'trip_cancellation_rejected' && tripId.isNotEmpty) {
    return '/home?activeTripId=${Uri.encodeComponent(tripId)}';
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```powershell
git commit -am "feat(driver): route flash pushes to /flash/incoming"
```

---

### Task 32: `FlashPriceInput` widget + testes

**Files:**
- Create: `lib/features/trip/presentation/widgets/flash_price_input.dart`
- Create: `test/features/trip/presentation/widgets/flash_price_input_test.dart`

- [ ] **Step 1: Test**

```dart
// test/features/trip/presentation/widgets/flash_price_input_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app_prestador/features/trip/presentation/widgets/flash_price_input.dart';

void main() {
  testWidgets('emits parsed price on tap Enviar', (tester) async {
    double? out;
    await tester.pumpWidget(MaterialApp(home: Scaffold(
      body: FlashPriceInput(onSubmit: (v) => out = v),
    )));
    await tester.enterText(find.byType(TextField), '45.5');
    await tester.tap(find.text('Enviar proposta'));
    await tester.pump();
    expect(out, 45.5);
  });
}
```

- [ ] **Step 2: Implement**

```dart
// lib/features/trip/presentation/widgets/flash_price_input.dart
import 'package:flutter/material.dart';

class FlashPriceInput extends StatefulWidget {
  final void Function(double price) onSubmit;
  const FlashPriceInput({super.key, required this.onSubmit});

  @override
  State<FlashPriceInput> createState() => _FlashPriceInputState();
}

class _FlashPriceInputState extends State<FlashPriceInput> {
  final _controller = TextEditingController();
  String? _error;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      TextField(
        controller: _controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: 'Valor da proposta (R\$)', errorText: _error),
      ),
      const SizedBox(height: 8),
      ElevatedButton(
        onPressed: () {
          final raw = _controller.text.replaceAll(',', '.').trim();
          final parsed = double.tryParse(raw);
          if (parsed == null || parsed <= 0 || parsed > 10000) {
            setState(() => _error = 'Preço inválido');
            return;
          }
          setState(() => _error = null);
          widget.onSubmit(parsed);
        },
        child: const Text('Enviar proposta'),
      ),
    ]);
  }
}
```

- [ ] **Step 3: Run — PASS**

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(driver): FlashPriceInput widget"
```

---

### Task 33: `FlashIncomingCallPage`

**Files:**
- Create: `lib/features/trip/presentation/pages/flash_incoming_call_page.dart`

- [ ] **Step 1: Implement**

```dart
// lib/features/trip/presentation/pages/flash_incoming_call_page.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/services/flash_trip_service.dart';
import '../widgets/flash_price_input.dart';

class FlashIncomingCallPage extends StatefulWidget {
  final String tripId;
  final FlashTripService service;
  const FlashIncomingCallPage({super.key, required this.tripId, required this.service});

  @override
  State<FlashIncomingCallPage> createState() => _FlashIncomingCallPageState();
}

class _FlashIncomingCallPageState extends State<FlashIncomingCallPage> {
  Map<String, dynamic>? trip;
  String? error;

  @override
  void initState() {
    super.initState();
    widget.service.loadIncomingCall(widget.tripId)
      .then((t) => setState(() => trip = t))
      .catchError((e) => setState(() => error = e.toString()));
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) return Scaffold(body: Center(child: Text(error!)));
    if (trip == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final pickup = trip!['pickup'] as Map;
    final dropoff = trip!['dropoff'] as Map;
    final client = trip!['client'] as Map;

    return Scaffold(
      appBar: AppBar(title: const Text('⚡ Corrida Flash')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Cliente: ${client['name']}'),
        const SizedBox(height: 8),
        Text('Origem: ${pickup['street']}, ${pickup['city']}'),
        Text('Destino: ${dropoff['street']}, ${dropoff['city']}'),
        const SizedBox(height: 8),
        Text('Passageiros: ${trip!['passenger_count']}'),
        Text('Bagagens: ${trip!['luggage_count'] ?? 0}'),
        Text('Crianças: ${trip!['children_count'] ?? 0}'),
        if ((trip!['observations'] as String?)?.isNotEmpty ?? false)
          Text('Obs: ${trip!['observations']}'),
        const SizedBox(height: 24),
        FlashPriceInput(onSubmit: (price) async {
          try {
            await widget.service.sendProposal(widget.tripId, price);
            if (mounted) context.go('/flash/awaiting/${widget.tripId}');
          } catch (e) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
            }
          }
        }),
        TextButton(
          onPressed: () async {
            await widget.service.rejectCall(widget.tripId);
            if (mounted) context.go('/home');
          },
          child: const Text('Recusar chamada'),
        ),
      ]),
    );
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git commit -am "feat(driver): FlashIncomingCallPage"
```

---

### Task 34: `FlashAwaitingClientPage` e `FlashRecheckPage`

**Files:**
- Create: `lib/features/trip/presentation/pages/flash_awaiting_client_page.dart`
- Create: `lib/features/trip/presentation/pages/flash_recheck_page.dart`

- [ ] **Step 1: Implement Awaiting**

```dart
// lib/features/trip/presentation/pages/flash_awaiting_client_page.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/services/flash_trip_service.dart';

class FlashAwaitingClientPage extends StatefulWidget {
  final String tripId;
  final FlashTripService service;
  const FlashAwaitingClientPage({super.key, required this.tripId, required this.service});

  @override
  State<FlashAwaitingClientPage> createState() => _FlashAwaitingClientPageState();
}

class _FlashAwaitingClientPageState extends State<FlashAwaitingClientPage> {
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = widget.service.watchTripStatus(widget.tripId).listen((row) async {
      final myUserId = Supabase.instance.client.auth.currentUser?.id;
      final myProfileRes = await Supabase.instance.client
          .from('driver_profiles')
          .select('id, provider_profiles!inner(user_id)')
          .eq('provider_profiles.user_id', myUserId as Object)
          .single();
      final myDriverProfile = myProfileRes['id'] as String;
      switch (row['status']) {
        case 'awaiting_driver_confirmation':
          if (row['driver_profile_id'] == myDriverProfile) {
            if (mounted) context.go('/flash/recheck/${widget.tripId}');
          } else {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cliente escolheu outro motorista')));
              context.go('/home');
            }
          }
          break;
        case 'cancelled':
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Cliente cancelou a Flash')));
            context.go('/home');
          }
          break;
      }
    });
  }

  @override
  void dispose() { _sub?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      CircularProgressIndicator(),
      SizedBox(height: 16),
      Text('Proposta enviada, aguardando cliente escolher...'),
    ])),
  );
}
```

- [ ] **Step 2: Implement Recheck**

```dart
// lib/features/trip/presentation/pages/flash_recheck_page.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/services/flash_trip_service.dart';

class FlashRecheckPage extends StatelessWidget {
  final String tripId;
  final FlashTripService service;
  const FlashRecheckPage({super.key, required this.tripId, required this.service});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cliente aceitou sua proposta!')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          const Text('Deseja iniciar a corrida?', style: TextStyle(fontSize: 20)),
          const Spacer(),
          ElevatedButton(
            onPressed: () async {
              await service.recheckConfirm(tripId);
              if (context.mounted) context.go('/active-trip?tripId=$tripId');
            },
            child: const Text('Iniciar corrida'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () async {
              await service.recheckReject(tripId);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Você desistiu desta corrida')));
                context.go('/home');
              }
            },
            child: const Text('Desistir'),
          ),
        ]),
      ),
    );
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(driver): FlashAwaitingClientPage + FlashRecheckPage"
```

---

### Task 35: Rotas prestador

**Files:**
- Modify: `lib/routes/app_router.dart`

- [ ] **Step 1: Adicionar**

```dart
GoRoute(
  path: '/flash/incoming',
  builder: (ctx, state) {
    final tripId = state.uri.queryParameters['tripId']!;
    return FlashIncomingCallPage(
      tripId: tripId,
      service: FlashTripService(client: Supabase.instance.client),
    );
  },
),
GoRoute(
  path: '/flash/awaiting/:tripId',
  builder: (ctx, state) => FlashAwaitingClientPage(
    tripId: state.pathParameters['tripId']!,
    service: FlashTripService(client: Supabase.instance.client),
  ),
),
GoRoute(
  path: '/flash/recheck/:tripId',
  builder: (ctx, state) => FlashRecheckPage(
    tripId: state.pathParameters['tripId']!,
    service: FlashTripService(client: Supabase.instance.client),
  ),
),
```

- [ ] **Step 2: Commit**

```powershell
git commit -am "feat(driver): Flash routes"
```

---

## Phase 7 — Verificação e2e

### Task 36: Roteiro de teste manual e2e

**Files:**
- Create: `docs/superpowers/plans/flash-e2e-checklist.md`

- [ ] **Step 1: Escrever roteiro**

```markdown
# Flash — Checklist manual e2e

Pré-requisito: `supabase start`, 3 usuários seed (1 cliente, 2 motoristas aprovados).

## Cenário 1 — happy path
1. Cliente app: tap endereço → escolher Flash
2. Preencher pickup+dropoff → categoria → detalhes (1 passageiro) → Solicitar
3. Verificar: cliente vai pra tela "Buscando motoristas"
4. Motorista 1 app: recebe push "⚡ CORRIDA FLASH!"
5. Motorista 1: abrir → digitar R$ 40 → Enviar proposta
6. Cliente: proposta aparece na tela (mais nova no topo)
7. Cliente: tap card → modal perfil → Aceitar proposta
8. Motorista 1: recebe push "✅ Cliente aceitou" → Iniciar corrida
9. Ambos vão para tela de corrida em andamento

## Cenário 2 — motorista desiste no re-check
1. Repetir 1-7 acima
2. Motorista 1: Desistir (no re-check)
3. Motorista 1: candidate.status='rejected' no banco
4. Cliente: vê snackbar "O motorista desistiu, buscando novamente"
5. Cliente: continua na tela de propostas
6. Motorista 2: se enviou proposta antes, ainda visível

## Cenário 3 — cancelamento
1. Cliente cria Flash
2. Cliente: Cancelar
3. Motoristas com candidato pending param de ver a chamada (trigger reject_candidates_when_trip_cancelled)

## Cenário 4 — admin
1. Admin: `/viagens` → filtro Flash → ver corrida com badge ⚡ FLASH
2. Abrir detalhe → botões "Aprovar", "Selecionar motorista" NÃO aparecem
3. Botão "Cancelar (emergência)" aparece

## Cenário 5 — dispatch racing
1. Criar Flash, dois motoristas enviam propostas simultâneas
2. Cliente aceita a primeira
3. Segunda aceite deve falhar com "Corrida não está mais buscando"

## Assertivas de banco por cenário

Rodar após cada cenário:

```sql
SELECT id, status, trip_type, driver_profile_id, final_price FROM trips ORDER BY created_at DESC LIMIT 3;
SELECT trip_id, driver_profile_id, status, offered_price, last_push_at FROM trip_driver_candidates
  WHERE trip_id = '<uuid>' ORDER BY created_at DESC;
```
```

- [ ] **Step 2: Executar cenários 1-5 manualmente**

- [ ] **Step 3: Ajustar bugs encontrados**

- [ ] **Step 4: Commit**

```powershell
git add docs/superpowers/plans/flash-e2e-checklist.md
git commit -m "docs(flash): e2e manual checklist"
```

---

## Self-Review (para revisão pós-execução)

- Cobertura do spec: cada seção do spec deve ter tarefas correspondentes ✓
- Placeholder scan: sem TBD/TODO em passos ✓
- Type consistency: nomes de RPC batem entre SQL, service Dart e cubit ✓
- Ordem de dependência: RPCs criadas antes dos consumidores ✓
- Migração destrutiva evitada: default `standard` em trip_type ✓

## Fim
