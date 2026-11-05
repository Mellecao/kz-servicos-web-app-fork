# Subprojeto 2A — Corrida Agendada: Fundação + Cotação + Akira — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender enum `trip_type`, redesenhar entry screen do cliente com sub-sheet de Corrida Agendada (Cotação + Falar com Akira), adicionar card admin de override no dashboard e filtro/badge Cotação no Kanban de viagens.

**Architecture:** 3 migrations Supabase (enum, seed+policy, RPC SECURITY DEFINER) → 2 funções puras gêmeas (Dart + TS) para computar disponibilidade → widget cascata no cliente + card no admin. Cotação reusa 100% o fluxo scheduled atual; só grava `trip_type='scheduled_quote'`.

**Tech Stack:** Supabase (Postgres + RLS), Next.js 16 App Router + React 19 + `@supabase/supabase-js`, Flutter 3.11 + `flutter_bloc` + `supabase_flutter` + `url_launcher` + `timezone`, testes `node:test` (admin) + `flutter_test` (cliente).

**Pré-descobertas (confirmadas antes deste plano):**

- **Cliente Flutter** cria trip em `lib/features/trip/data/repositories/trip_repository_impl.dart:48` via `.from('trips').insert()`. Ordem do fluxo: `TripHomePage` → `TripCreationCubit.submit(TripRequest)` → `CreateTrip` usecase → `TripRepositoryImpl.createTrip` → `TripModel.buildInsertJson`. **Payload NÃO tem `trip_type` hoje** — precisa ser adicionado a 3 arquivos.
- **`system_settings`** tem RLS habilitada (`consolidated_schema.sql:518`). Policies existentes: `system_settings_select` (admin-only) e `system_settings_admin` (INSERT/UPDATE/DELETE admin-only). Uma policy adicional escopada por `key` **não conflita** — RLS usa OR entre policies do mesmo comando; authenticated poderá ler só a chave `scheduled_quote_admin_override`.
- **Filtro Flash** em `src/app/(dashboard)/viagens/page.tsx:322-331` é um `<select>` HTML. Type: `TripType = "standard" | "flash"` em `src/types/database.ts:15`. `TripTypeFilter = "all" | TripType`. Badge: `FlashBadge.tsx` + helper `isFlashTrip` em `src/lib/trip-status.ts:4-8`.
- **Padrão RPC Flash** (`supabase/migrations/20260729120010+`): SECURITY DEFINER, `SET search_path = public`, revoke anon, guard `get_user_role()='admin'`, validação inline com `RAISE EXCEPTION`.
- **Padrão de testes admin**: `npx tsx --test src/lib/<name>.test.ts` com `node:test` + `node:assert/strict`. `tsx` foi adicionado como devDep no Subprojeto 3.
- **Padrão de testes Dart**: `flutter test test/<caminho>` para unit tests puros. `flutter_test` já é devDep padrão do Flutter.

**Ordem das tasks (dependências):**
- Tasks 1-3 (migrations) devem rodar antes de qualquer código que use os novos valores/RPC.
- Tasks 4-5 (funções puras) são independentes; podem ir em paralelo se paralelizar.
- Tasks 6-9 (admin) dependem só de 1-3 e 4.
- Tasks 10-14 (cliente) dependem de 1-3 e 5.
- Task 15 (e2e + verify) é a última.

---

## File Structure

**Novos:**

Supabase (`supabase/migrations/`):
- `NNNNNNNNNNNN_scheduled_quote_trip_types.sql`
- `NNNNNNNNNNNN_scheduled_quote_settings.sql`
- `NNNNNNNNNNNN_set_scheduled_quote_override_rpc.sql`

Admin Next.js (`C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork\src\`):
- `lib/quotation-availability.ts` + `.test.ts`
- `lib/system-settings.ts`
- `app/(dashboard)/dashboard/QuotationOverrideCard.tsx`

Cliente Flutter (`C:\Projetos\kz-servicos-app-cliente\lib\`):
- `features/trip/domain/entities/quotation_availability.dart`
- `features/trip/data/repositories/system_settings_repository.dart`
- `features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart`
- `core/config/akira_whatsapp.dart`

Testes cliente Flutter (`C:\Projetos\kz-servicos-app-cliente\test\`):
- `features/trip/domain/entities/quotation_availability_test.dart`

Docs:
- `docs/superpowers/plans/subprojeto-2a-e2e-checklist.md`

**Modificados:**

Admin:
- `src/types/database.ts` (adicionar valores ao `TripType`)
- `src/lib/trip-status.ts` (adicionar `isQuotationTrip`)
- `src/app/(dashboard)/viagens/page.tsx` (dropdown filter + badge logic)
- `src/app/(dashboard)/dashboard/page.tsx` (renderizar `QuotationOverrideCard`)

Cliente Flutter:
- `pubspec.yaml` (verificar/add `timezone` e `url_launcher`)
- `lib/features/trip/domain/entities/trip_request.dart` (add `tripType`)
- `lib/features/trip/data/models/trip_model.dart` (add param + JSON)
- `lib/features/trip/data/repositories/trip_repository_impl.dart` (passa tripType)
- `lib/features/trip/presentation/pages/trip_home_page.dart` (cascade `_openSearch`)

---

## Task 1: Migration — enum `trip_type` ADD VALUE

**Files:**
- Create: `supabase/migrations/NNNNNNNNNNNN_scheduled_quote_trip_types.sql` (usar timestamp atual — ex: `20260729130000`)

- [ ] **Step 1: Confirmar timestamp atual e último migration**

```bash
ls supabase/migrations/ | sort | tail -5
```

Escolher timestamp posterior (ex: `20260729130000` — 30 min após o último Flash).

- [ ] **Step 2: Criar arquivo**

Conteúdo EXATO:

```sql
-- ============================================================================
-- Migration: Extend trip_type enum for Subprojeto 2A/2B
-- Adds 'scheduled_quote' (Cotação — fluxo scheduled atual) and
-- 'scheduled_choose_driver' (Escolha seu Motorista — usado no Subprojeto 2B).
-- Retrocompatível: trips 'standard' existentes permanecem inalteradas.
-- ============================================================================

-- +goose Up
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_quote';
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_choose_driver';

-- +goose Down
-- Postgres não suporta remoção de valores de enum em uso; Down = no-op.
```

- [ ] **Step 3: Aplicar via Supabase MCP**

Usar `mcp__supabase__apply_migration` com o nome `scheduled_quote_trip_types` e o conteúdo acima. Se o MCP não estiver disponível, o usuário aplica via CLI e retorna com o resultado.

- [ ] **Step 4: Verificar via SQL**

```sql
SELECT unnest(enum_range(NULL::trip_type));
```

Esperado: retorna `standard`, `flash`, `scheduled_quote`, `scheduled_choose_driver`.

- [ ] **Step 5: Rodar advisors**

`mcp__supabase__get_advisors`. Corrigir novos alertas antes de continuar. `ADD VALUE` idempotente não deve gerar novos advisors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/NNNNNNNNNNNN_scheduled_quote_trip_types.sql
git commit -m "feat(scheduled-quote): extend trip_type enum with scheduled_quote and scheduled_choose_driver

Retrocompatível — trips existentes com 'standard' permanecem.
'scheduled_choose_driver' será consumido no Subprojeto 2B.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Migration — `system_settings` seed + policy

**Files:**
- Create: `supabase/migrations/NNNNNNNNNNNN_scheduled_quote_settings.sql` (timestamp +1 segundo do Task 1)

- [ ] **Step 1: Criar arquivo**

Conteúdo EXATO:

```sql
-- ============================================================================
-- Migration: Seed scheduled_quote_admin_override + policy p/ authenticated
-- Adiciona linha seed em system_settings (default 'auto') e cria policy
-- SELECT escopada por key para permitir o cliente ler o override sem
-- expor o restante da tabela (que continua admin-only).
-- ============================================================================

-- +goose Up
INSERT INTO system_settings (key, value, updated_by)
VALUES ('scheduled_quote_admin_override', '"auto"'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "authenticated_read_scheduled_quote_override"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (key = 'scheduled_quote_admin_override');

-- +goose Down
DROP POLICY IF EXISTS "authenticated_read_scheduled_quote_override" ON public.system_settings;
DELETE FROM system_settings WHERE key = 'scheduled_quote_admin_override';
```

- [ ] **Step 2: Aplicar via MCP**

`mcp__supabase__apply_migration` com nome `scheduled_quote_settings`.

- [ ] **Step 3: Verificar seed**

```sql
SELECT key, value FROM system_settings WHERE key = 'scheduled_quote_admin_override';
```

Esperado: 1 linha, `value = "auto"` (JSONB string).

- [ ] **Step 4: Verificar policy**

```sql
SELECT polname, polcmd, polroles::regrole[]
  FROM pg_policy
 WHERE polrelid = 'public.system_settings'::regclass
   AND polname = 'authenticated_read_scheduled_quote_override';
```

Esperado: 1 linha com `polcmd='r'` (SELECT) e role `authenticated`.

- [ ] **Step 5: Rodar advisors + confirmar que não há alerta novo sobre policy permissiva demais**

`mcp__supabase__get_advisors`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/NNNNNNNNNNNN_scheduled_quote_settings.sql
git commit -m "feat(scheduled-quote): seed override 'auto' + policy SELECT escopada por key

Policy 'authenticated_read_scheduled_quote_override' permite qualquer
autenticado ler APENAS a chave scheduled_quote_admin_override.
Demais chaves de system_settings continuam admin-only via policy existente.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Migration — RPC `set_scheduled_quote_override`

**Files:**
- Create: `supabase/migrations/NNNNNNNNNNNN_set_scheduled_quote_override_rpc.sql` (timestamp +2 segundos)

- [ ] **Step 1: Criar arquivo**

```sql
-- ============================================================================
-- Migration: RPC set_scheduled_quote_override(new_value text)
-- SECURITY DEFINER, admin-only, valida value ∈ {auto, force_enabled, force_disabled}
-- Padrão Flash: revoke anon + guard get_user_role() + inline validation.
-- ============================================================================

-- +goose Up
CREATE OR REPLACE FUNCTION public.set_scheduled_quote_override(new_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Apenas admin pode alterar este setting';
  END IF;

  IF new_value NOT IN ('auto', 'force_enabled', 'force_disabled') THEN
    RAISE EXCEPTION 'Valor inválido: %', new_value;
  END IF;

  INSERT INTO system_settings (key, value, updated_by, updated_at)
  VALUES ('scheduled_quote_admin_override', to_jsonb(new_value), auth.uid(), now())
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by,
                updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_scheduled_quote_override(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_scheduled_quote_override(text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.set_scheduled_quote_override(text);
```

- [ ] **Step 2: Aplicar via MCP**

`mcp__supabase__apply_migration` com nome `set_scheduled_quote_override_rpc`.

- [ ] **Step 3: Verificar RPC criada**

```sql
SELECT proname, prosecdef
  FROM pg_proc
 WHERE proname = 'set_scheduled_quote_override';
```

Esperado: 1 linha, `prosecdef=true` (SECURITY DEFINER).

- [ ] **Step 4: Testar guard admin (deve falhar chamado como não-admin)**

Como admin autenticado no Supabase Studio, rodar:

```sql
SELECT public.set_scheduled_quote_override('force_enabled');
```

Esperado: sucesso. Depois:

```sql
SELECT key, value FROM system_settings WHERE key = 'scheduled_quote_admin_override';
```

Esperado: `value = "force_enabled"`.

Restaurar:

```sql
SELECT public.set_scheduled_quote_override('auto');
```

- [ ] **Step 5: Rodar advisors**

`mcp__supabase__get_advisors`. Confirmar que não há alerta sobre `SECURITY DEFINER` sem revoke — o revoke está na migration.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/NNNNNNNNNNNN_set_scheduled_quote_override_rpc.sql
git commit -m "feat(scheduled-quote): RPC set_scheduled_quote_override SECURITY DEFINER

Admin-only via get_user_role() guard. Valida value ∈ {auto,
force_enabled, force_disabled}. Revoke anon; grant authenticated
(o guard filtra o resto). Padrão consolidado do Flash.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: `quotation-availability.ts` + test (admin TS)

**Files:**
- Create: `src/lib/quotation-availability.ts`
- Create: `src/lib/quotation-availability.test.ts`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Escrever o teste falhando**

Conteúdo EXATO de `src/lib/quotation-availability.test.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  computeQuotationAvailability,
  type QuotationOverride,
} from "./quotation-availability.ts";

function at(hour: number): Date {
  const d = new Date("2026-07-29T00:00:00");
  d.setHours(hour, 0, 0, 0);
  return d;
}

test("override='auto' e hora=14 → available", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(14), adminOverride: "auto" }),
    "available"
  );
});

test("override='auto' e hora=6 → unavailable", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(6), adminOverride: "auto" }),
    "unavailable"
  );
});

test("override='auto' borda inferior: 07:00 → available, 06:59 → unavailable", () => {
  const seven = at(7);
  const sixFiftyNine = new Date(seven.getTime() - 60_000);
  assert.equal(
    computeQuotationAvailability({ nowInSp: seven, adminOverride: "auto" }),
    "available"
  );
  assert.equal(
    computeQuotationAvailability({ nowInSp: sixFiftyNine, adminOverride: "auto" }),
    "unavailable"
  );
});

test("override='auto' borda superior: 19:59 → available, 20:00 → unavailable", () => {
  const twenty = at(20);
  const nineteenFiftyNine = new Date(twenty.getTime() - 60_000);
  assert.equal(
    computeQuotationAvailability({ nowInSp: nineteenFiftyNine, adminOverride: "auto" }),
    "available"
  );
  assert.equal(
    computeQuotationAvailability({ nowInSp: twenty, adminOverride: "auto" }),
    "unavailable"
  );
});

test("override='force_enabled' + hora=3 → available (ignora horário)", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(3), adminOverride: "force_enabled" }),
    "available"
  );
});

test("override='force_disabled' + hora=12 → unavailable (ignora horário)", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(12), adminOverride: "force_disabled" }),
    "unavailable"
  );
});

test("QuotationOverride type exportado é literal union", () => {
  const values: QuotationOverride[] = ["auto", "force_enabled", "force_disabled"];
  assert.equal(values.length, 3);
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
npx tsx --test src/lib/quotation-availability.test.ts
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Conteúdo EXATO de `src/lib/quotation-availability.ts`:

```typescript
export type QuotationAvailability = "available" | "unavailable";
export type QuotationOverride = "auto" | "force_enabled" | "force_disabled";

export function computeQuotationAvailability(params: {
  nowInSp: Date;
  adminOverride: QuotationOverride;
  startHour?: number;
  endHour?: number;
}): QuotationAvailability {
  const { nowInSp, adminOverride, startHour = 7, endHour = 20 } = params;
  if (adminOverride === "force_enabled") return "available";
  if (adminOverride === "force_disabled") return "unavailable";
  const h = nowInSp.getHours();
  return h >= startHour && h < endHour ? "available" : "unavailable";
}
```

- [ ] **Step 4: Rodar teste e ver passar**

```bash
npx tsx --test src/lib/quotation-availability.test.ts
```

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quotation-availability.ts src/lib/quotation-availability.test.ts
git commit -m "feat(scheduled-quote): computeQuotationAvailability (TS)

Função pura que decide disponibilidade da Cotação a partir de
now-in-SP + override admin (auto/force_enabled/force_disabled).
Espelhada em Dart no Task 5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: `quotation_availability.dart` + test (cliente Dart)

**Files:**
- Create: `lib/features/trip/domain/entities/quotation_availability.dart`
- Create: `test/features/trip/domain/entities/quotation_availability_test.dart`

Working directory: `C:\Projetos\kz-servicos-app-cliente`

- [ ] **Step 1: Escrever teste falhando**

Conteúdo EXATO de `test/features/trip/domain/entities/quotation_availability_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app_cliente/features/trip/domain/entities/quotation_availability.dart';

DateTime at(int hour) => DateTime(2026, 7, 29, hour, 0, 0);

void main() {
  group('computeQuotationAvailability', () {
    test("override='auto' e hora=14 → available", () {
      expect(
        computeQuotationAvailability(nowInSp: at(14), adminOverride: 'auto'),
        QuotationAvailability.available,
      );
    });

    test("override='auto' e hora=6 → unavailable", () {
      expect(
        computeQuotationAvailability(nowInSp: at(6), adminOverride: 'auto'),
        QuotationAvailability.unavailable,
      );
    });

    test("override='auto' borda inferior: 07:00 → available, 06:59 → unavailable", () {
      expect(
        computeQuotationAvailability(nowInSp: at(7), adminOverride: 'auto'),
        QuotationAvailability.available,
      );
      expect(
        computeQuotationAvailability(nowInSp: DateTime(2026, 7, 29, 6, 59, 0), adminOverride: 'auto'),
        QuotationAvailability.unavailable,
      );
    });

    test("override='auto' borda superior: 19:59 → available, 20:00 → unavailable", () {
      expect(
        computeQuotationAvailability(nowInSp: DateTime(2026, 7, 29, 19, 59, 0), adminOverride: 'auto'),
        QuotationAvailability.available,
      );
      expect(
        computeQuotationAvailability(nowInSp: at(20), adminOverride: 'auto'),
        QuotationAvailability.unavailable,
      );
    });

    test("override='force_enabled' + hora=3 → available", () {
      expect(
        computeQuotationAvailability(nowInSp: at(3), adminOverride: 'force_enabled'),
        QuotationAvailability.available,
      );
    });

    test("override='force_disabled' + hora=12 → unavailable", () {
      expect(
        computeQuotationAvailability(nowInSp: at(12), adminOverride: 'force_disabled'),
        QuotationAvailability.unavailable,
      );
    });

    test("override desconhecido cai no branch 'auto'", () {
      expect(
        computeQuotationAvailability(nowInSp: at(14), adminOverride: 'unknown'),
        QuotationAvailability.available,
      );
      expect(
        computeQuotationAvailability(nowInSp: at(3), adminOverride: 'unknown'),
        QuotationAvailability.unavailable,
      );
    });
  });
}
```

**Nota sobre o import path:** o arquivo usa `package:kz_servicos_app_cliente/...`. Se o `name` no `pubspec.yaml` for outro, ajustar o import. Confirmar antes de rodar via:

```bash
grep -E "^name:" pubspec.yaml
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
flutter test test/features/trip/domain/entities/quotation_availability_test.dart
```

Expected: FAIL — arquivo não encontrado (import error).

- [ ] **Step 3: Implementar**

Conteúdo EXATO de `lib/features/trip/domain/entities/quotation_availability.dart`:

```dart
enum QuotationAvailability { available, unavailable }

QuotationAvailability computeQuotationAvailability({
  required DateTime nowInSp,
  required String adminOverride,
  int startHour = 7,
  int endHour = 20,
}) {
  if (adminOverride == 'force_enabled') return QuotationAvailability.available;
  if (adminOverride == 'force_disabled') return QuotationAvailability.unavailable;
  final h = nowInSp.hour;
  return (h >= startHour && h < endHour)
      ? QuotationAvailability.available
      : QuotationAvailability.unavailable;
}
```

- [ ] **Step 4: Rodar teste e ver passar**

```bash
flutter test test/features/trip/domain/entities/quotation_availability_test.dart
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/features/trip/domain/entities/quotation_availability.dart test/features/trip/domain/entities/quotation_availability_test.dart
git commit -m "feat(scheduled-quote): computeQuotationAvailability (Dart)

Espelha a função TS do admin. Recebe now-in-SP (caller responsável
por converter) + override string; retorna enum. Override desconhecido
cai no branch 'auto' (defesa).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: `system-settings.ts` (admin — fetch + set override)

**Files:**
- Create: `src/lib/system-settings.ts`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

Sem teste unitário (integração Supabase — cobertura via e2e).

- [ ] **Step 1: Implementar**

Conteúdo EXATO de `src/lib/system-settings.ts`:

```typescript
import { supabase } from "@/lib/supabase";
import type { QuotationOverride } from "@/lib/quotation-availability";

const KEY = "scheduled_quote_admin_override";

export async function getScheduledQuoteOverride(): Promise<QuotationOverride> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data) return "auto";

  const raw = data.value;
  if (raw === "auto" || raw === "force_enabled" || raw === "force_disabled") {
    return raw;
  }
  return "auto";
}

export async function setScheduledQuoteOverride(newValue: QuotationOverride): Promise<void> {
  const { error } = await supabase.rpc("set_scheduled_quote_override", {
    new_value: newValue,
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: PASS. Se falhar por import `@/lib/supabase`, verificar path (confirmado em `src/lib/supabase.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/system-settings.ts
git commit -m "feat(scheduled-quote): getScheduledQuoteOverride + setScheduledQuoteOverride

Fetch direto (RLS permite via policy scoped por key).
Update via RPC SECURITY DEFINER (admin-only).
Fallback 'auto' se linha ausente ou valor inválido.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: `QuotationOverrideCard.tsx` (admin component)

**Files:**
- Create: `src/app/(dashboard)/dashboard/QuotationOverrideCard.tsx`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Implementar**

Conteúdo EXATO:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeQuotationAvailability,
  type QuotationOverride,
} from "@/lib/quotation-availability";
import {
  getScheduledQuoteOverride,
  setScheduledQuoteOverride,
} from "@/lib/system-settings";

const OVERRIDE_OPTIONS: { value: QuotationOverride; label: string }[] = [
  { value: "auto", label: "Auto (segue horário 07-20h)" },
  { value: "force_enabled", label: "Forçar ON" },
  { value: "force_disabled", label: "Forçar OFF" },
];

export default function QuotationOverrideCard() {
  const [override, setOverride] = useState<QuotationOverride | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScheduledQuoteOverride()
      .then((v) => {
        if (!cancelled) setOverride(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao ler override");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(async (v: QuotationOverride) => {
    setSaving(true);
    setError(null);
    try {
      await setScheduledQuoteOverride(v);
      setOverride(v);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  }, []);

  const availabilityLabel = (() => {
    if (override === null) return "Carregando…";
    const availability = computeQuotationAvailability({
      nowInSp: new Date(),
      adminOverride: override,
    });
    if (override === "auto") {
      return availability === "available" ? "Auto (dentro do horário — ativa)" : "Auto (fora do horário — inativa)";
    }
    return override === "force_enabled" ? "Forçada ON (ativa)" : "Forçada OFF (inativa)";
  })();

  return (
    <div className="p-4 rounded-lg border border-border bg-surface">
      <h2 className="text-lg font-semibold text-dark mb-1">Cotação de Corrida Agendada</h2>
      <p className="text-sm text-contrast mb-3">Estado atual: <strong className="text-dark">{availabilityLabel}</strong></p>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {OVERRIDE_OPTIONS.map((opt) => {
          const isActive = override === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={saving || isActive}
              onClick={() => handleChange(opt.value)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                isActive
                  ? "bg-primary text-background border-primary font-semibold"
                  : "bg-surface text-dark border-border hover:bg-surface-hover"
              } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dashboard/QuotationOverrideCard.tsx"
git commit -m "feat(scheduled-quote): QuotationOverrideCard admin dashboard

Card client-component que exibe estado atual da Cotação (Auto dentro/
fora do horário / Forçada ON / Forçada OFF) e 3 botões pra alternar.
Usa computeQuotationAvailability + getScheduledQuoteOverride/set.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Renderizar `QuotationOverrideCard` no dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Ler page.tsx pra saber onde inserir**

Ler `src/app/(dashboard)/dashboard/page.tsx` via Read tool (a rota tem parênteses que precisam quoting no shell).

Identificar o JSX principal (provavelmente há vários cards já; queremos adicionar mais um).

- [ ] **Step 2: Adicionar import**

No topo do arquivo (junto com outros imports), adicionar:

```tsx
import QuotationOverrideCard from "./QuotationOverrideCard";
```

- [ ] **Step 3: Inserir o componente no JSX**

Adicionar `<QuotationOverrideCard />` como um card na grid principal do dashboard. Posição sugerida: logo abaixo dos cards de estatísticas principais (ou no final da grid se não houver seção clara).

Se a página tem uma grid tipo:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <SomeCard />
  <OtherCard />
</div>
```

Adicionar `<QuotationOverrideCard />` como novo filho dessa grid, ou criar uma nova seção logo abaixo:

```tsx
<div className="mt-6">
  <QuotationOverrideCard />
</div>
```

Escolher o padrão que casar melhor com o layout existente do dashboard.

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Verificar visualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000/dashboard` como admin. Confirmar:
- Card "Cotação de Corrida Agendada" aparece.
- Estado inicial: "Auto (dentro do horário — ativa)" ou similar dependendo da hora.
- Botões Auto (destacado como ativo), Forçar ON, Forçar OFF.
- Clicar "Forçar OFF" → estado muda pra "Forçada OFF (inativa)" em <1s. Voltar pra "Auto".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(scheduled-quote): renderizar QuotationOverrideCard no /dashboard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: TripType + filtro + badge Cotação no `/viagens`

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/trip-status.ts`
- Modify: `src/app/(dashboard)/viagens/page.tsx`

Sem testes unitários novos (adição segue padrão Flash).

- [ ] **Step 1: Adicionar valores ao `TripType`**

Em `src/types/database.ts` linha ~15, substituir:

```typescript
export type TripType = "standard" | "flash";
```

Por:

```typescript
export type TripType = "standard" | "flash" | "scheduled_quote" | "scheduled_choose_driver";
```

- [ ] **Step 2: Adicionar helper `isQuotationTrip`**

Em `src/lib/trip-status.ts`, logo depois de `isFlashTrip`, adicionar:

```typescript
export function isQuotationTrip(trip: { trip_type?: string | null } | null | undefined): boolean {
  return trip?.trip_type === "scheduled_quote";
}
```

- [ ] **Step 3: Adicionar teste do helper**

Em `src/lib/trip-status.test.ts` (arquivo existente), adicionar após os testes de `isFlashTrip`:

```typescript
import { isQuotationTrip } from "./trip-status.ts";

test("isQuotationTrip returns true for trip_type=scheduled_quote", () => {
  assert.equal(isQuotationTrip({ trip_type: "scheduled_quote" }), true);
});

test("isQuotationTrip returns false for other trip_types", () => {
  assert.equal(isQuotationTrip({ trip_type: "standard" }), false);
  assert.equal(isQuotationTrip({ trip_type: "flash" }), false);
  assert.equal(isQuotationTrip(null), false);
  assert.equal(isQuotationTrip({}), false);
});
```

Nota: se o arquivo já importa `isFlashTrip` na primeira linha, adicionar `isQuotationTrip` ao mesmo import em vez de duplicar linha.

- [ ] **Step 4: Rodar teste**

```bash
npx tsx --test src/lib/trip-status.test.ts
```

Expected: tests existentes + 2 novos passam.

- [ ] **Step 5: Adicionar opção "Cotação" ao dropdown**

Em `src/app/(dashboard)/viagens/page.tsx:322-331`, o `<select>` atual tem:

```tsx
<select id="trip-type-filter" value={tripTypeFilter} onChange={...}>
  <option value="all">Todos os tipos</option>
  <option value="standard">Padrão</option>
  <option value="flash">⚡ Flash</option>
</select>
```

Adicionar a opção Cotação logo após Flash:

```tsx
<option value="scheduled_quote">💰 Cotação</option>
```

- [ ] **Step 6: Adicionar badge Cotação nos cards Kanban**

Em `src/app/(dashboard)/viagens/page.tsx:271-277`, o encadeamento condicional atual é:

```typescript
...(isFlashTrip(t)
  ? { tag: "⚡ FLASH", tagColor: "#facc15" }
  : t.is_round_trip
  ? { tag: "Ida e volta", tagColor: "#2261FE" }
  : ...
```

Inserir Cotação como primeiro ramo alternativo (antes de round_trip). Importar `isQuotationTrip` se ainda não estiver importado. Substituir por:

```typescript
...(isFlashTrip(t)
  ? { tag: "⚡ FLASH", tagColor: "#facc15" }
  : isQuotationTrip(t)
  ? { tag: "💰 COTAÇÃO", tagColor: "#10B981" }
  : t.is_round_trip
  ? { tag: "Ida e volta", tagColor: "#2261FE" }
  : ...
```

- [ ] **Step 7: Verificar build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Verificar visualmente**

```bash
npm run dev
```

Abrir `/viagens`. Confirmar:
- Dropdown de filtro tem 4 opções (Todos, Padrão, ⚡ Flash, 💰 Cotação).
- Selecionar Cotação → lista vazia (nenhuma trip criada ainda como scheduled_quote).
- Selecionar Todos → Flash e standard aparecem com seus badges.

- [ ] **Step 9: Commit**

```bash
git add src/types/database.ts src/lib/trip-status.ts src/lib/trip-status.test.ts "src/app/(dashboard)/viagens/page.tsx"
git commit -m "feat(scheduled-quote): filtro + badge Cotação no Kanban admin

- TripType alias ganha 'scheduled_quote' e 'scheduled_choose_driver'
- isQuotationTrip helper + 2 testes
- Dropdown de filtro em /viagens ganha opção 💰 Cotação
- Cards Kanban mostram badge 💰 COTAÇÃO (verde) para trip_type='scheduled_quote'

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: `system_settings_repository.dart` (cliente Flutter — cache 60s)

**Files:**
- Create: `lib/features/trip/data/repositories/system_settings_repository.dart`

Working directory: `C:\Projetos\kz-servicos-app-cliente`

- [ ] **Step 1: Confirmar como o Supabase client é acessado hoje**

```bash
grep -R "Supabase.instance.client" lib/features/trip --include="*.dart" -l | head -3
```

Verificar o padrão (provavelmente `Supabase.instance.client.from(...)`). Se for diferente, ajustar o import abaixo.

- [ ] **Step 2: Implementar**

Conteúdo EXATO de `lib/features/trip/data/repositories/system_settings_repository.dart`:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class SystemSettingsRepository {
  SystemSettingsRepository._();
  static final SystemSettingsRepository instance = SystemSettingsRepository._();

  static const String _key = 'scheduled_quote_admin_override';
  static const Duration _ttl = Duration(seconds: 60);

  String? _cachedValue;
  DateTime? _cachedAt;

  Future<String> fetchScheduledQuoteOverride() async {
    final now = DateTime.now();
    if (_cachedValue != null &&
        _cachedAt != null &&
        now.difference(_cachedAt!) < _ttl) {
      return _cachedValue!;
    }

    try {
      final response = await Supabase.instance.client
          .from('system_settings')
          .select('value')
          .eq('key', _key)
          .maybeSingle();

      final raw = response == null ? null : response['value'];
      final value = _normalize(raw);
      _cachedValue = value;
      _cachedAt = now;
      return value;
    } catch (_) {
      return 'auto';
    }
  }

  String _normalize(Object? raw) {
    if (raw is String &&
        (raw == 'auto' || raw == 'force_enabled' || raw == 'force_disabled')) {
      return raw;
    }
    return 'auto';
  }
}
```

- [ ] **Step 3: Verificar que o Flutter analyzer não reclama**

```bash
flutter analyze lib/features/trip/data/repositories/system_settings_repository.dart
```

Expected: 0 issues.

- [ ] **Step 4: Commit**

```bash
git add lib/features/trip/data/repositories/system_settings_repository.dart
git commit -m "feat(scheduled-quote): SystemSettingsRepository com cache 60s

Singleton in-memory que faz SELECT em system_settings pela chave
scheduled_quote_admin_override. Cache TTL 60s. Fallback 'auto' em
erro ou linha ausente. Valida valor retornado.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: `akira_whatsapp.dart` + `pubspec.yaml` deps

**Files:**
- Create: `lib/core/config/akira_whatsapp.dart`
- Modify: `pubspec.yaml`

Working directory: `C:\Projetos\kz-servicos-app-cliente`

- [ ] **Step 1: Verificar pubspec para `url_launcher` e `timezone`**

```bash
grep -E "^  (url_launcher|timezone):" pubspec.yaml
```

Se `url_launcher` faltar, adicionar na seção `dependencies:`:

```yaml
  url_launcher: ^6.2.5
```

Se `timezone` faltar, adicionar na mesma seção:

```yaml
  timezone: ^0.9.4
```

- [ ] **Step 2: `pub get` se algo foi adicionado**

```bash
flutter pub get
```

Expected: sucesso; sem conflitos de resolver.

- [ ] **Step 3: Criar `akira_whatsapp.dart`**

Conteúdo EXATO de `lib/core/config/akira_whatsapp.dart`:

```dart
/// Número do WhatsApp de suporte "Akira" (E.164 sem +).
/// Usado em `launchUrl('https://wa.me/$akiraWhatsappE164')`.
const String akiraWhatsappE164 = '5511985889577';
```

- [ ] **Step 4: Verificar analyzer**

```bash
flutter analyze lib/core/config/akira_whatsapp.dart
```

Expected: 0 issues.

- [ ] **Step 5: Commit**

```bash
git add lib/core/config/akira_whatsapp.dart pubspec.yaml pubspec.lock
git commit -m "feat(akira): const akiraWhatsappE164 + garantir url_launcher/timezone

url_launcher: usado no botão Falar com Akira que abre wa.me.
timezone: usado para converter DateTime.now() em America/Sao_Paulo
ao computar disponibilidade da Cotação.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: `scheduled_mode_choice_sheet.dart` (widget cascata)

**Files:**
- Create: `lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart`

Working directory: `C:\Projetos\kz-servicos-app-cliente`

Sem teste unitário (widget presentacional — cobertura via e2e).

- [ ] **Step 1: Implementar**

Conteúdo EXATO:

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/akira_whatsapp.dart';
import '../../domain/entities/quotation_availability.dart';

class ScheduledModeChoiceSheet extends StatelessWidget {
  const ScheduledModeChoiceSheet({super.key, required this.availability});

  final QuotationAvailability availability;

  Future<void> _openAkira() async {
    final uri = Uri.parse('https://wa.me/$akiraWhatsappE164');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final quotationAvailable = availability == QuotationAvailability.available;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              enabled: quotationAvailable,
              leading: Text('💰', style: TextStyle(
                fontSize: 28,
                color: quotationAvailable ? null : Colors.grey,
              )),
              title: Text(
                'Cotação',
                style: TextStyle(color: quotationAvailable ? null : Colors.grey),
              ),
              subtitle: Text(
                quotationAvailable
                    ? 'A KZ busca o melhor motorista e preço para você'
                    : 'Disponível das 07h às 20h',
              ),
              onTap: quotationAvailable
                  ? () => Navigator.of(context).pop('scheduled_quote')
                  : null,
            ),
            // TODO Subprojeto 2B: adicionar ListTile "Escolha seu motorista"
            const SizedBox(height: 12),
            _AkiraButton(
              highlighted: !quotationAvailable,
              onPressed: _openAkira,
            ),
          ],
        ),
      ),
    );
  }
}

class _AkiraButton extends StatelessWidget {
  const _AkiraButton({required this.highlighted, required this.onPressed});

  final bool highlighted;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    if (highlighted) {
      return SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: onPressed,
          icon: const Text('💬', style: TextStyle(fontSize: 20)),
          label: const Text('Falar com o Akira'),
        ),
      );
    }
    return TextButton.icon(
      onPressed: onPressed,
      icon: const Text('💬'),
      label: const Text('Falar com o Akira'),
    );
  }
}
```

- [ ] **Step 2: Verificar analyzer**

```bash
flutter analyze lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart
```

Expected: 0 issues.

- [ ] **Step 3: Commit**

```bash
git add lib/features/trip/presentation/widgets/scheduled_mode_choice_sheet.dart
git commit -m "feat(scheduled-quote): ScheduledModeChoiceSheet widget cascata

Mostra ListTile Cotação (enabled/disabled conforme QuotationAvailability)
+ botão Falar com Akira (destacado quando Cotação inativa; discreto
quando ativa). Ao tocar Cotação, pop com 'scheduled_quote'. Akira
abre wa.me em app externo.
Escolha seu Motorista fica pro Subprojeto 2B (comentário TODO in loco).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Passar `tripType` no payload de criação

**Files:**
- Modify: `lib/features/trip/domain/entities/trip_request.dart:4`
- Modify: `lib/features/trip/data/models/trip_model.dart:39-67`
- Modify: `lib/features/trip/data/repositories/trip_repository_impl.dart:33-46`

Working directory: `C:\Projetos\kz-servicos-app-cliente`

- [ ] **Step 1: Adicionar `tripType` a `TripRequest`**

Ler `trip_request.dart` completo primeiro pra entender construtor e imutabilidade. Adicionar campo obrigatório do tipo `String` (não enum — validação server-side):

```dart
final String tripType;
```

E incluí-lo no construtor:

```dart
required this.tripType,
```

Se `TripRequest` usa `copyWith`, adicionar `tripType` também.

- [ ] **Step 2: Passar `tripType` no `TripModel.buildInsertJson`**

Em `trip_model.dart:39-67`, o método `buildInsertJson` monta o Map que vai pro INSERT. Adicionar `trip_type` como parâmetro obrigatório e como chave do Map:

```dart
static Map<String, dynamic> buildInsertJson({
  // ...campos existentes...
  required String tripType,
}) {
  return {
    // ...campos existentes...
    'trip_type': tripType,
  };
}
```

- [ ] **Step 3: Passar `tripType` no `TripRepositoryImpl.createTrip`**

Em `trip_repository_impl.dart:33-46`, a chamada existente:

```dart
final tripJson = TripModel.buildInsertJson(
  // ...
);
```

Adicionar o parâmetro:

```dart
final tripJson = TripModel.buildInsertJson(
  // ...
  tripType: request.tripType,
);
```

- [ ] **Step 4: Compilar**

```bash
flutter analyze lib/features/trip/domain/entities/trip_request.dart lib/features/trip/data/models/trip_model.dart lib/features/trip/data/repositories/trip_repository_impl.dart
```

Expected: analyzer aponta chamadas de `TripRequest(...)` sem `tripType` — vai ser corrigido no Task 14. Se quiser evitar noise agora, pode marcar `tripType` como default `'standard'` TEMPORARIAMENTE — mas MELHOR deixar quebrar e forçar Task 14 a corrigir.

- [ ] **Step 5: Rodar teste completo**

```bash
flutter test
```

Vai falhar em compilação porque callers de `TripRequest` não passam `tripType`. **Se houver mais que 2-3 callers**, considerar tornar `tripType` opcional com default `'standard'` para manter callers antigos funcionando (retrocompatível). Documente escolha no commit.

- [ ] **Step 6: Commit**

```bash
git add lib/features/trip/domain/entities/trip_request.dart lib/features/trip/data/models/trip_model.dart lib/features/trip/data/repositories/trip_repository_impl.dart
git commit -m "feat(scheduled-quote): TripRequest ganha tripType, propagado até INSERT

Adiciona campo tripType a TripRequest, TripModel.buildInsertJson e
propaga em TripRepositoryImpl.createTrip. Task 14 vai passar o valor
correto ('scheduled_quote' em Cotação, 'standard' em fluxo antigo).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: `trip_home_page.dart::_openSearch` cascade

**Files:**
- Modify: `lib/features/trip/presentation/pages/trip_home_page.dart` — método `_openSearch` (grep para localizar linha exata)

Working directory: `C:\Projetos\kz-servicos-app-cliente`

- [ ] **Step 1: Localizar `_openSearch`**

```bash
grep -n "_openSearch\|TripTypeChoiceSheet" lib/features/trip/presentation/pages/trip_home_page.dart
```

- [ ] **Step 2: Ler o método atual completo**

Ler ~50 linhas em torno do `_openSearch` para entender fluxo atual (como abre `TripTypeChoiceSheet`, o que faz com o retorno `'flash'` vs `'scheduled'`).

- [ ] **Step 3: Adicionar imports**

No topo do arquivo, adicionar (se ainda não estiverem):

```dart
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz_data;

import '../../data/repositories/system_settings_repository.dart';
import '../../domain/entities/quotation_availability.dart';
import '../widgets/scheduled_mode_choice_sheet.dart';
```

- [ ] **Step 4: Inicializar timezone no `main` do app se ainda não inicializado**

```bash
grep -n "tz_data.initializeTimeZones\|initializeTimeZones" lib/main.dart
```

Se não estiver inicializado, adicionar em `main()` (antes do `runApp`):

```dart
tz_data.initializeTimeZones();
```

E o import necessário em `main.dart`:

```dart
import 'package:timezone/data/latest.dart' as tz_data;
```

- [ ] **Step 5: Reescrever `_openSearch`**

Assumindo o método atual seja algo como:

```dart
Future<void> _openSearch() async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (_) => const TripTypeChoiceSheet(),
  );
  if (choice == 'flash') {
    // fluxo Flash existente
  } else if (choice == 'scheduled') {
    // fluxo scheduled atual (usa tripType='standard' hoje implícito)
  }
}
```

Substituir por:

```dart
Future<void> _openSearch() async {
  final firstChoice = await showModalBottomSheet<String>(
    context: context,
    builder: (_) => const TripTypeChoiceSheet(),
  );
  if (!mounted) return;

  if (firstChoice == 'flash') {
    // MANTER fluxo Flash existente exatamente como está.
    _startFlashFlow(); // ou como o código faz hoje
    return;
  }

  if (firstChoice == 'scheduled') {
    final override = await SystemSettingsRepository.instance
        .fetchScheduledQuoteOverride();
    if (!mounted) return;

    final sp = tz.getLocation('America/Sao_Paulo');
    final nowSp = tz.TZDateTime.now(sp);

    final availability = computeQuotationAvailability(
      nowInSp: nowSp,
      adminOverride: override,
    );

    final secondChoice = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => ScheduledModeChoiceSheet(availability: availability),
    );
    if (!mounted) return;

    if (secondChoice == 'scheduled_quote') {
      _startScheduledFlow(tripType: 'scheduled_quote');
      return;
    }
    // se secondChoice for null (fechou o sheet) ou Akira launched, não faz nada
  }
}
```

Se hoje há um método tipo `_startScheduledFlow()` sem parâmetro que sempre cria como standard, alterá-lo para receber `tripType` (default `'standard'` pra retrocompat).

Se o INSERT/build de `TripRequest` fica fora de `trip_home_page.dart`, seguir a cadeia pra passar `tripType` até o `TripRequest(...)` — pode envolver `TripCreationCubit.submit` recebendo `tripType` ou o `TripRequest` sendo montado a partir de um payload interno.

**Nota:** o writing-plans não pode antecipar 100% dessa cadeia sem ler os arquivos completos; o implementador executa o mapeamento e ajusta. Manter a interface simples: um único método `_startScheduledFlow(tripType: 'scheduled_quote'|'standard')`.

- [ ] **Step 6: Rodar teste + analyze**

```bash
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
flutter test test/features/trip/domain/entities/quotation_availability_test.dart
```

Expected: analyzer 0 issues, teste da Task 5 continua verde.

- [ ] **Step 7: Smoke test manual**

```bash
flutter run  # em dispositivo/emulador
```

Abrir o app como cliente:
1. Tap na barra de endereço → sheet aparece.
2. Escolher "Corrida Agendada" → segundo sheet (`ScheduledModeChoiceSheet`) aparece.
3. Se dentro do horário: Cotação habilitada + botão Akira discreto. Tap em Cotação → segue fluxo scheduled atual.
4. Se fora do horário (ou setar `force_disabled` no admin antes): Cotação cinza + botão Akira em destaque. Tap em Akira → abre WhatsApp com número `55 11 98588-9577`.

- [ ] **Step 8: Commit**

```bash
git add lib/features/trip/presentation/pages/trip_home_page.dart lib/main.dart
git commit -m "feat(scheduled-quote): cascade _openSearch (Trip type → Scheduled mode)

Fluxo:
- Nivel 1 (TripTypeChoiceSheet existente): Flash vs Agendada.
- Nivel 2 (novo ScheduledModeChoiceSheet): Cotação (habilitada por
  horário SP + override admin) OU botão Falar com Akira em destaque
  se Cotação indisponível.
- Cotação escolhida propaga tripType='scheduled_quote' até o INSERT.
- Flash mantém fluxo atual inalterado.

Adiciona init timezone no main.dart.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: E2E checklist manual + verificação final

**Files:**
- Create: `docs/superpowers/plans/subprojeto-2a-e2e-checklist.md`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Escrever checklist**

Conteúdo EXATO:

````markdown
# Subprojeto 2A — Corrida Agendada Fundação — Checklist manual e2e

**Pré-requisitos:**
- Migrations aplicadas em Supabase (dev ou staging).
- App admin (`kz-servicos-web-app-fork`) rodando (`npm run dev`).
- App cliente Flutter (`kz-servicos-app-cliente`) buildado (`flutter run`).
- 1 cliente autenticado; 1 admin autenticado.
- Ambiente pode simular horário forçando override admin (evita mock de sistema).

---

## Cenário 1 — Cotação dentro do horário (auto)

1. Admin: dashboard mostra card "Cotação de Corrida Agendada" com botão **Auto** ativo.
2. Cliente: tap na barra de endereço → escolher **Corrida Agendada** → sub-sheet abre.
3. **Assertivas visuais** (dentro do horário 07-20h SP):
   - Card "💰 Cotação" habilitado (cor padrão), subtitle "A KZ busca o melhor motorista e preço para você".
   - Botão "💬 Falar com o Akira" no rodapé, discreto (TextButton).
4. Cliente tap em "Cotação" → segue fluxo scheduled atual (picker de endereços + detalhes).
5. Confirmar solicitação → trip é criada.

### Assertiva SQL

```sql
SELECT id, status, trip_type FROM trips ORDER BY created_at DESC LIMIT 1;
```

Esperado: `status='open'` (ou o default do fluxo scheduled), `trip_type='scheduled_quote'`.

---

## Cenário 2 — Cotação fora do horário (auto)

Simular via override admin (mais confiável que esperar a hora):

1. Admin: card do dashboard → tap **Forçar OFF** → estado vira "Forçada OFF (inativa)".
2. Cliente: (re-abrir app OU aguardar 60s para expirar cache) tap na barra → Corrida Agendada.
3. **Assertivas visuais:**
   - Card "💰 Cotação" cinza, subtitle "Disponível das 07h às 20h", **onTap inativo**.
   - Botão "💬 Falar com o Akira" em destaque logo abaixo (FilledButton com largura total).
4. Tap em "Falar com o Akira" → app do WhatsApp abre (ou browser mobile fallback com `wa.me`) com número `55 11 98588-9577`.

---

## Cenário 3 — Admin `force_enabled` fora do horário

1. Admin: card → **Forçar ON** → estado "Forçada ON (ativa)".
2. Cliente: reabrir/aguardar 60s → Corrida Agendada → Cotação habilitada mesmo que hora local esteja fora de 07-20h SP.
3. Executar fluxo até criar trip → `trip_type='scheduled_quote'`.

---

## Cenário 4 — Voltar para Auto

1. Admin: card → **Auto** → estado retorna a "Auto (dentro/fora do horário — ...)" conforme relógio.
2. Cliente: reabrir → Cotação habilitada se hora local ∈ [07,20), inativa caso contrário.

---

## Cenário 5 — Filtro Cotação no Kanban admin

1. Após Cenário 1 (trip Cotação criada): admin abre `/viagens`.
2. Dropdown de filtro tem **💰 Cotação** como opção.
3. Selecionar Cotação → só trips `trip_type='scheduled_quote'` aparecem.
4. Cards mostram badge **💰 COTAÇÃO** (verde).

---

## Cenário 6 — Cache 60s no cliente

1. Admin: setar override para **Forçar OFF**.
2. Cliente (com o sub-sheet AINDA aberto): estado NÃO muda até fechar e reabrir.
3. Fechar sub-sheet, aguardar 60s+, reabrir → estado reflete `force_disabled`.

Aceitável: mudanças do admin propagam em até 1 minuto no cliente.

---

## Cenário 7 — Trip standard antiga

1. Admin: `/viagens` sem filtro (todos).
2. Trips com `trip_type='standard'` (criadas antes deste subprojeto) continuam listadas.
3. Filtrar por **Padrão** → só as antigas aparecem.
4. Filtrar por **⚡ Flash** → só Flash.

Confirma retrocompatibilidade do enum.

---

## Regressão obrigatória

- [ ] Fluxo Flash: cliente abre app → escolhe Flash → propostas → aceite. Zero mudança de comportamento.
- [ ] Fluxo scheduled antigo (se cliente antigo em prod ainda existir): continua criando trips `standard` sem quebrar.
- [ ] `/dashboard` admin: outros cards continuam visíveis, sem regressão de layout com o novo `QuotationOverrideCard`.
- [ ] `/viagens` admin: badge Flash e round trip continuam funcionando (encadeamento condicional preservou ordem).
- [ ] Advisor Supabase limpo pós-migrations (`mcp__supabase__get_advisors`).

---

## Débitos identificados (backlog)

- [ ] Chat interno com Akira via `support_chat` — Subprojeto 5 (2A usa launchUrl WhatsApp).
- [ ] Opção "Escolha seu Motorista" no sub-sheet — Subprojeto 2B.
- [ ] Rota admin `/configurações` com múltiplos settings — hoje é só card no dashboard.
- [ ] UI admin para editar horário base (07-20h) — hardcoded.
- [ ] Realtime do override no cliente (cache 60s é suficiente).
- [ ] Push notif diferenciado para `scheduled_quote` no prestador — mesmo fluxo scheduled atual.

---

## Execução

- [ ] Cenário 1 — Cotação dentro do horário
- [ ] Cenário 2 — Cotação fora / force_disabled
- [ ] Cenário 3 — force_enabled fora do horário
- [ ] Cenário 4 — Voltar para Auto
- [ ] Cenário 5 — Filtro + badge admin
- [ ] Cenário 6 — Cache 60s
- [ ] Cenário 7 — Retrocompatibilidade standard
- [ ] Regressão obrigatória
- [ ] Registrar bugs em `docs/superpowers/plans/subprojeto-2a-e2e-bugs.md` (criar sob demanda)
````

- [ ] **Step 2: Rodar TODOS os testes puros (admin + cliente)**

Admin:
```bash
npx tsx --test src/lib/quotation-availability.test.ts src/lib/trip-status.test.ts
```
Expected: 7 (quotation-availability) + N (trip-status pré-existente + 2 novos) tests passing.

Cliente Flutter:
```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter test test/features/trip/domain/entities/quotation_availability_test.dart
```
Expected: 7 tests passing.

- [ ] **Step 3: Build final admin**

```bash
cd C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork
npm run build
```

Expected: PASS.

- [ ] **Step 4: Flutter analyze completo**

```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter analyze
```

Expected: 0 issues NOVOS (issues pré-existentes de outras features não bloqueiam).

- [ ] **Step 5: Rodar advisors Supabase final**

`mcp__supabase__get_advisors` — deve estar limpo.

- [ ] **Step 6: Commit do checklist**

```bash
cd C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork
git add docs/superpowers/plans/subprojeto-2a-e2e-checklist.md
git commit -m "docs(scheduled-quote): checklist manual e2e do Subprojeto 2A

7 cenários (Cotação dentro/fora do horário, force_enabled/disabled,
voltar para auto, filtro+badge admin, cache 60s, retrocompat) +
regressão obrigatória + débitos deferidos.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Verificação global pós-execução

- [ ] `git log --oneline` do repo admin mostra ~10 commits (Tasks 1-3 migrations + 4, 6, 7, 8, 9, 15).
- [ ] `git log --oneline` do repo cliente mostra ~5 commits (Tasks 5, 10, 11, 12, 13-14).
- [ ] Suite pura verde nos dois repos.
- [ ] `npm run build` limpo (admin).
- [ ] `flutter analyze` limpo (cliente, sem issues novos).
- [ ] E2E checklist executado ao menos parcialmente (Cenários 1 + 2 + 5 mínimos) antes de rollout em prod.
- [ ] Advisor Supabase limpo.
