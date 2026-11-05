# Subprojeto 3 — Mapa admin de motoristas em tempo real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova rota admin `/mapa` que renderiza Google Maps em tela cheia mostrando cada motorista com GPS ativo (`driver_locations.updated_at > now() - 10 min`) como foto circular com border verde (livre) ou azul (em corrida), com popup contendo dados do motorista e link para viagem ativa.

**Architecture:** Client component único (`MapaClient.tsx`) orquestra state + `supabase.channel().onPostgresChanges()` em `driver_locations` + timer de 60s para expirar markers estagnados. Componentes filhos puros (`DriverMarker`, `DriverPopup`, `DriverSearchInput`, `ActiveDriverCounter`) recebem props e renderizam. Funções puras (`parseActiveDriverRow`, `formatTimeAgo`, bounds constants) isoladas em `src/lib/` com testes `node:test`.

**Tech Stack:** Next.js 16 App Router, React 19, `@react-google-maps/api` (novo), `@supabase/supabase-js`, Tailwind CSS, `node:test` + `tsx` para testes de código puro.

**Pré-descobertas do codebase (confirmadas antes de escrever este plano):**
- `vehicles` **não tem** coluna `is_primary`. Colunas: `brand`, `model`, `year`, `color`, `license_plate`, `is_active`, `category`. Fallback do spec: filtrar `is_active = true`, ordenar `updated_at DESC`, pegar o primeiro. Note também que o campo é `license_plate` (não `plate`).
- `users.role` é enum `user_role('client','provider','admin')`. Helper `public.get_user_role()` já existe.
- **RLS admin já cobre `driver_locations.SELECT`** via `public.get_user_role() = 'admin'` (migration `20260410120024` linhas 543-558). **Nenhuma migration nova é necessária.**
- Sidebar (`src/components/Sidebar.tsx`) usa SVG inline, não `lucide-react`. Novo item usará SVG inline seguindo o mesmo padrão dos itens existentes.
- Padrão de teste: `node --import tsx --test src/lib/<name>.test.ts`. `tsx` disponível via `npx`.
- Padrão realtime: `src/app/(dashboard)/viagens/page.tsx:148-198` (`supabase.channel(...).on('postgres_changes', ...).subscribe()`).
- `Trip.status` enum inclui `'started'` e `'scheduled'` como estados de trip ativa (para efeito visual, não usaremos aqui — usamos `driver_locations.trip_id IS NOT NULL` que é populado pelo prestador enquanto está em corrida).

---

## File Structure

**Novos:**
- `src/app/(dashboard)/mapa/page.tsx` — server component (auth herdado do layout)
- `src/app/(dashboard)/mapa/MapaClient.tsx` — client, orquestração
- `src/components/mapa/DriverMarker.tsx` — apresentação, foto + border
- `src/components/mapa/DriverPopup.tsx` — InfoWindow content
- `src/components/mapa/DriverSearchInput.tsx` — combobox de busca
- `src/components/mapa/ActiveDriverCounter.tsx` — contador stateless
- `src/lib/driver-locations.ts` — `ActiveDriverLocation` + `parseActiveDriverRow` + `fetchActiveDrivers` + `fetchDriverMeta`
- `src/lib/driver-locations.test.ts` — testes do parser
- `src/lib/google-maps-config.ts` — bounds + libraries constants
- `src/lib/google-maps-config.test.ts` — testes dos bounds (contêm pontos de referência)
- `src/lib/time-ago.ts` — formatter pt-BR
- `src/lib/time-ago.test.ts` — testes
- `docs/superpowers/plans/subprojeto-3-e2e-checklist.md` — checklist manual

**Modificados:**
- `src/components/Sidebar.tsx` — inserir item "Mapa" no array `navItems`
- `.env.local.example` — adicionar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `package.json` — adicionar `@react-google-maps/api` e `tsx` (devDependency)

---

## Task 1: Setup — dependência e env var

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`

- [ ] **Step 1: Instalar dependência e tsx**

```bash
npm install @react-google-maps/api
npm install --save-dev tsx
```

Expected: `package.json` gains `@react-google-maps/api` under `dependencies` e `tsx` under `devDependencies`; `package-lock.json` atualiza.

- [ ] **Step 2: Verificar que o build ainda passa**

```bash
npm run build
```

Expected: build completa sem erros.

- [ ] **Step 3: Adicionar env var ao example**

Ler `.env.local.example` (se existir); se não existir, criar. Adicionar no final:

```
# Google Maps JavaScript API key for /mapa (Subprojeto 3)
# IMPORTANTE: configure HTTP referrer restriction no GCP Console:
#   - localhost:3000 (dev)
#   - <domínio prod do admin>
# Escopo: só "Maps JavaScript API" (sem Places, Directions, Geocoding).
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore(mapa): add @react-google-maps/api + NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

Prep para Subprojeto 3 (mapa admin de motoristas em tempo real).
tsx adicionado como devDependency para rodar testes de código puro
via 'node --import tsx --test src/lib/<name>.test.ts'."
```

---

## Task 2: `time-ago.ts` (função pura)

**Files:**
- Create: `src/lib/time-ago.ts`
- Create: `src/lib/time-ago.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

```typescript
// src/lib/time-ago.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { formatTimeAgo } from "./time-ago.ts";

const NOW = new Date("2026-07-29T12:00:00.000Z").getTime();

test("formatTimeAgo: 0-59s retorna 'agora'", () => {
  assert.equal(formatTimeAgo(new Date(NOW - 0).toISOString(), NOW), "agora");
  assert.equal(formatTimeAgo(new Date(NOW - 30_000).toISOString(), NOW), "agora");
  assert.equal(formatTimeAgo(new Date(NOW - 59_000).toISOString(), NOW), "agora");
});

test("formatTimeAgo: 1-59m retorna 'há Xm'", () => {
  assert.equal(formatTimeAgo(new Date(NOW - 60_000).toISOString(), NOW), "há 1m");
  assert.equal(formatTimeAgo(new Date(NOW - 15 * 60_000).toISOString(), NOW), "há 15m");
  assert.equal(formatTimeAgo(new Date(NOW - 59 * 60_000).toISOString(), NOW), "há 59m");
});

test("formatTimeAgo: >=1h retorna 'há Xh'", () => {
  assert.equal(formatTimeAgo(new Date(NOW - 60 * 60_000).toISOString(), NOW), "há 1h");
  assert.equal(formatTimeAgo(new Date(NOW - 3 * 60 * 60_000).toISOString(), NOW), "há 3h");
});

test("formatTimeAgo: timestamp futuro (drift de clock) retorna 'agora'", () => {
  assert.equal(formatTimeAgo(new Date(NOW + 5000).toISOString(), NOW), "agora");
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
npx tsx --test src/lib/time-ago.test.ts
```

Expected: FAIL — módulo `./time-ago.ts` não encontrado.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/time-ago.ts
export function formatTimeAgo(isoTimestamp: string, nowMs: number = Date.now()): string {
  const then = new Date(isoTimestamp).getTime();
  const diffMs = nowMs - then;
  if (diffMs < 60_000) return "agora";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `há ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  return `há ${diffHr}h`;
}
```

- [ ] **Step 4: Rodar teste e ver passar**

```bash
npx tsx --test src/lib/time-ago.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time-ago.ts src/lib/time-ago.test.ts
git commit -m "feat(mapa): formatTimeAgo pt-BR ('agora' / 'há Xm' / 'há Xh')"
```

---

## Task 3: `google-maps-config.ts` — bounds SP→Campinas

**Files:**
- Create: `src/lib/google-maps-config.ts`
- Create: `src/lib/google-maps-config.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

```typescript
// src/lib/google-maps-config.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { SP_CAMPINAS_BOUNDS, GOOGLE_MAPS_LIBRARIES } from "./google-maps-config.ts";

function contains(bounds: typeof SP_CAMPINAS_BOUNDS, lat: number, lng: number): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

test("SP_CAMPINAS_BOUNDS contém pontos de referência da região", () => {
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.55, -46.63), "SP centro");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.46, -46.53), "Guarulhos");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.53, -46.79), "Osasco");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -22.90, -47.06), "Campinas centro");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.19, -46.88), "Jundiaí");
});

test("SP_CAMPINAS_BOUNDS NÃO contém pontos fora da região", () => {
  assert.ok(!contains(SP_CAMPINAS_BOUNDS, -22.90, -43.20), "Rio de Janeiro");
  assert.ok(!contains(SP_CAMPINAS_BOUNDS, -19.91, -43.94), "Belo Horizonte");
  assert.ok(!contains(SP_CAMPINAS_BOUNDS, -25.42, -49.27), "Curitiba");
});

test("GOOGLE_MAPS_LIBRARIES é uma lista vazia (sem Places/Directions)", () => {
  assert.deepEqual(GOOGLE_MAPS_LIBRARIES, []);
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
npx tsx --test src/lib/google-maps-config.test.ts
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/google-maps-config.ts
export const SP_CAMPINAS_BOUNDS = {
  south: -23.75, // abaixo de SP capital (~Diadema/São Bernardo)
  north: -22.83, // acima de Campinas
  west: -47.20,  // oeste de Campinas
  east: -46.30,  // leste da região metropolitana de SP (Mogi, Suzano)
} as const;

// Sem libraries extras — só Maps JS API core (redução de custo e superfície).
export const GOOGLE_MAPS_LIBRARIES: readonly ("places" | "geometry" | "drawing" | "visualization")[] = [];

export function assertGoogleMapsApiKey(key: string | undefined): asserts key is string {
  if (!key || key.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não configurada. Veja .env.local.example."
    );
  }
}
```

- [ ] **Step 4: Rodar teste e ver passar**

```bash
npx tsx --test src/lib/google-maps-config.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-maps-config.ts src/lib/google-maps-config.test.ts
git commit -m "feat(mapa): bounds SP→Campinas + assertGoogleMapsApiKey"
```

---

## Task 4: `driver-locations.ts` — tipo + `parseActiveDriverRow`

**Files:**
- Create: `src/lib/driver-locations.ts`
- Create: `src/lib/driver-locations.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

```typescript
// src/lib/driver-locations.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseActiveDriverRow } from "./driver-locations.ts";

test("parseActiveDriverRow normaliza row completo", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: -23.55,
    longitude: -46.63,
    heading: 90,
    trip_id: "trip-abc",
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "João Silva", avatar_url: "https://x.io/a.jpg" },
      },
      vehicles: [
        {
          brand: "Fiat",
          model: "Uno",
          color: "Prata",
          license_plate: "ABC1D23",
          is_active: true,
          updated_at: "2026-07-01T00:00:00Z",
        },
      ],
    },
  };
  assert.deepEqual(parseActiveDriverRow(row), {
    driverProfileId: "d1",
    fullName: "João Silva",
    avatarUrl: "https://x.io/a.jpg",
    latitude: -23.55,
    longitude: -46.63,
    heading: 90,
    updatedAt: "2026-07-29T12:00:00Z",
    tripId: "trip-abc",
    vehicle: { brand: "Fiat", model: "Uno", color: "Prata", licensePlate: "ABC1D23" },
  });
});

test("parseActiveDriverRow tolera avatar_url null", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: -23.55,
    longitude: -46.63,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "Maria", avatar_url: null },
      },
      vehicles: [
        { brand: "VW", model: "Gol", color: "Branco", license_plate: "XYZ2E34", is_active: true, updated_at: "2026-01-01T00:00:00Z" },
      ],
    },
  };
  const out = parseActiveDriverRow(row);
  assert.equal(out?.avatarUrl, null);
  assert.equal(out?.tripId, null);
  assert.equal(out?.heading, null);
});

test("parseActiveDriverRow retorna vehicle=null quando não há vehicles ativos", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: -23.55,
    longitude: -46.63,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "Ana", avatar_url: null },
      },
      vehicles: [],
    },
  };
  assert.equal(parseActiveDriverRow(row)?.vehicle, null);
});

test("parseActiveDriverRow escolhe o vehicle is_active=true mais recente", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "N", avatar_url: null },
      },
      vehicles: [
        { brand: "A", model: "1", color: "-", license_plate: "AAA1A11", is_active: false, updated_at: "2026-06-01T00:00:00Z" },
        { brand: "B", model: "2", color: "-", license_plate: "BBB2B22", is_active: true, updated_at: "2026-03-01T00:00:00Z" },
        { brand: "C", model: "3", color: "-", license_plate: "CCC3C33", is_active: true, updated_at: "2026-05-01T00:00:00Z" },
      ],
    },
  };
  assert.equal(parseActiveDriverRow(row)?.vehicle?.brand, "C");
});

test("parseActiveDriverRow retorna null se provider_profiles.status != 'approved' (defesa em profundidade)", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "pending",
        users: { full_name: "X", avatar_url: null },
      },
      vehicles: [],
    },
  };
  assert.equal(parseActiveDriverRow(row), null);
});

test("parseActiveDriverRow retorna null se dados essenciais faltarem", () => {
  const rowSemUser = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: { provider_profiles: { status: "approved", users: null }, vehicles: [] },
  };
  assert.equal(parseActiveDriverRow(rowSemUser), null);

  const rowSemProvider = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: { provider_profiles: null, vehicles: [] },
  };
  assert.equal(parseActiveDriverRow(rowSemProvider), null);
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
npx tsx --test src/lib/driver-locations.test.ts
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar tipo e parser**

```typescript
// src/lib/driver-locations.ts
export interface ActiveDriverLocation {
  driverProfileId: string;
  fullName: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  updatedAt: string;
  tripId: string | null;
  vehicle: {
    brand: string;
    model: string;
    color: string;
    licensePlate: string;
  } | null;
}

interface RawVehicle {
  brand: string;
  model: string;
  color: string;
  license_plate: string;
  is_active: boolean;
  updated_at: string;
}

interface RawUser {
  full_name: string;
  avatar_url: string | null;
}

interface RawProviderProfile {
  status: string;
  users: RawUser | null;
}

interface RawDriverProfile {
  provider_profiles: RawProviderProfile | null;
  vehicles: RawVehicle[];
}

interface RawDriverLocationRow {
  driver_profile_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  trip_id: string | null;
  updated_at: string;
  driver_profiles: RawDriverProfile;
}

export function parseActiveDriverRow(row: RawDriverLocationRow): ActiveDriverLocation | null {
  const provider = row.driver_profiles?.provider_profiles;
  if (!provider) return null;
  if (provider.status !== "approved") return null;
  const user = provider.users;
  if (!user) return null;

  const activeVehicles = (row.driver_profiles.vehicles ?? []).filter((v) => v.is_active === true);
  activeVehicles.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const mostRecent = activeVehicles[0];

  return {
    driverProfileId: row.driver_profile_id,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    latitude: row.latitude,
    longitude: row.longitude,
    heading: row.heading,
    updatedAt: row.updated_at,
    tripId: row.trip_id,
    vehicle: mostRecent
      ? {
          brand: mostRecent.brand,
          model: mostRecent.model,
          color: mostRecent.color,
          licensePlate: mostRecent.license_plate,
        }
      : null,
  };
}
```

- [ ] **Step 4: Rodar teste e ver passar**

```bash
npx tsx --test src/lib/driver-locations.test.ts
```

Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/driver-locations.ts src/lib/driver-locations.test.ts
git commit -m "feat(mapa): ActiveDriverLocation + parseActiveDriverRow

Normaliza rows do Supabase (snake_case + joins aninhados) em modelo
camelCase. Filtro defensivo por status='approved'. Vehicle picking:
is_active=true, ordenado por updated_at DESC."
```

---

## Task 5: `driver-locations.ts` — `fetchActiveDrivers` e `fetchDriverMeta`

**Files:**
- Modify: `src/lib/driver-locations.ts`

Sem teste unitário — é a fronteira de integração com Supabase. Cobertura vem do checklist e2e (Task 13).

- [ ] **Step 1: Adicionar helpers ao arquivo**

Anexar ao final de `src/lib/driver-locations.ts`:

```typescript
import { supabase } from "@/lib/supabase";

const ACTIVE_WINDOW_MINUTES = 10;

const SELECT_COLUMNS = `
  driver_profile_id,
  latitude,
  longitude,
  heading,
  trip_id,
  updated_at,
  driver_profiles!inner (
    provider_profiles!inner (
      status,
      users!inner ( full_name, avatar_url )
    ),
    vehicles ( brand, model, color, license_plate, is_active, updated_at )
  )
`;

export async function fetchActiveDrivers(): Promise<ActiveDriverLocation[]> {
  const cutoffIso = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("driver_locations")
    .select(SELECT_COLUMNS)
    .gt("updated_at", cutoffIso)
    .eq("driver_profiles.provider_profiles.status", "approved");

  if (error) throw error;
  if (!data) return [];
  return (data as unknown as RawDriverLocationRow[])
    .map(parseActiveDriverRow)
    .filter((d): d is ActiveDriverLocation => d !== null);
}

export async function fetchDriverMeta(driverProfileId: string): Promise<ActiveDriverLocation | null> {
  const { data, error } = await supabase
    .from("driver_locations")
    .select(SELECT_COLUMNS)
    .eq("driver_profile_id", driverProfileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseActiveDriverRow(data as unknown as RawDriverLocationRow);
}
```

- [ ] **Step 2: Verificar que o build TypeScript continua passando**

```bash
npm run build
```

Expected: build OK, sem erros TS. Se falhar por import de `@/lib/supabase`, verificar o alias no `tsconfig.json` e/ou o path exato do supabase client (grep por `createClient` em `src/lib/`).

- [ ] **Step 3: Verificar que os testes anteriores continuam passando**

```bash
npx tsx --test src/lib/driver-locations.test.ts
```

Expected: PASS — mesmos 6 tests passing (o novo código não é testado, mas não pode quebrar o parser).

- [ ] **Step 4: Commit**

```bash
git add src/lib/driver-locations.ts
git commit -m "feat(mapa): fetchActiveDrivers + fetchDriverMeta (Supabase)

Query com !inner joins para provider_profiles.status='approved' e
janela de 10min (updated_at > cutoff). Retorna ActiveDriverLocation[]."
```

---

## Task 6: `DriverMarker.tsx`

**Files:**
- Create: `src/components/mapa/DriverMarker.tsx`

Componente apresentacional, sem teste unitário (padrão do admin — cobertura via e2e checklist).

- [ ] **Step 1: Implementar**

```tsx
// src/components/mapa/DriverMarker.tsx
"use client";

import { OverlayView } from "@react-google-maps/api";
import type { ActiveDriverLocation } from "@/lib/driver-locations";

interface DriverMarkerProps {
  driver: ActiveDriverLocation;
  onClick: (driverProfileId: string) => void;
}

const GREEN = "#22C55E";
const BLUE = "#3B82F6";

export default function DriverMarker({ driver, onClick }: DriverMarkerProps) {
  const borderColor = driver.tripId ? BLUE : GREEN;
  const initial = driver.fullName.charAt(0).toUpperCase() || "?";

  return (
    <OverlayView
      position={{ lat: driver.latitude, lng: driver.longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
    >
      <button
        type="button"
        onClick={() => onClick(driver.driverProfileId)}
        className="w-10 h-10 rounded-full border-4 shadow-lg cursor-pointer overflow-hidden bg-gray-200 flex items-center justify-center"
        style={{ borderColor }}
        aria-label={`Motorista ${driver.fullName}`}
      >
        {driver.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driver.avatarUrl}
            alt={driver.fullName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-sm font-bold text-gray-700">{initial}</span>
        )}
      </button>
    </OverlayView>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/mapa/DriverMarker.tsx
git commit -m "feat(mapa): DriverMarker (foto circular + border verde/azul)"
```

---

## Task 7: `DriverPopup.tsx`

**Files:**
- Create: `src/components/mapa/DriverPopup.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/components/mapa/DriverPopup.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoWindow } from "@react-google-maps/api";
import type { ActiveDriverLocation } from "@/lib/driver-locations";
import { formatTimeAgo } from "@/lib/time-ago";

interface DriverPopupProps {
  driver: ActiveDriverLocation;
  onClose: () => void;
}

export default function DriverPopup({ driver, onClose }: DriverPopupProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const inTrip = driver.tripId !== null;
  const statusLabel = inTrip ? "Em corrida" : "Livre";
  const statusBg = inTrip ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700";
  const initial = driver.fullName.charAt(0).toUpperCase() || "?";

  return (
    <InfoWindow
      position={{ lat: driver.latitude, lng: driver.longitude }}
      onCloseClick={onClose}
      options={{ pixelOffset: new google.maps.Size(0, -24) }}
    >
      <div className="min-w-[220px] max-w-[280px] p-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
            {driver.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driver.avatarUrl}
                alt={driver.fullName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-700">{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{driver.fullName}</p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded ${statusBg}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-700 mb-1">
          {driver.vehicle ? (
            <>
              {driver.vehicle.brand} {driver.vehicle.model} · {driver.vehicle.licensePlate} · {driver.vehicle.color}
            </>
          ) : (
            <span className="text-gray-400 italic">Veículo não cadastrado</span>
          )}
        </div>

        <div className="text-xs text-gray-500 mb-2">
          Atualizado {formatTimeAgo(driver.updatedAt, nowMs)}
        </div>

        {inTrip && driver.tripId && (
          <Link
            href={`/viagens?openTrip=${driver.tripId}`}
            className="inline-block text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Abrir viagem →
          </Link>
        )}
      </div>
    </InfoWindow>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/mapa/DriverPopup.tsx
git commit -m "feat(mapa): DriverPopup com veículo, status, tempo e link p/ viagem"
```

---

## Task 8: `DriverSearchInput.tsx`

**Files:**
- Create: `src/components/mapa/DriverSearchInput.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/components/mapa/DriverSearchInput.tsx
"use client";

import { useMemo, useState } from "react";
import type { ActiveDriverLocation } from "@/lib/driver-locations";

interface DriverSearchInputProps {
  drivers: ActiveDriverLocation[];
  onSelect: (driverProfileId: string) => void;
}

export default function DriverSearchInput({ drivers, onSelect }: DriverSearchInputProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return drivers
      .filter((d) => d.fullName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [drivers, query]);

  return (
    <div className="relative w-64">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Buscar motorista por nome..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-dark placeholder-contrast focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((d) => (
            <li key={d.driverProfileId}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(d.driverProfileId);
                  setQuery(d.fullName);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-dark hover:bg-surface-hover"
              >
                {d.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/mapa/DriverSearchInput.tsx
git commit -m "feat(mapa): DriverSearchInput com autocomplete em memória"
```

---

## Task 9: `ActiveDriverCounter.tsx`

**Files:**
- Create: `src/components/mapa/ActiveDriverCounter.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/components/mapa/ActiveDriverCounter.tsx
interface ActiveDriverCounterProps {
  count: number;
}

export default function ActiveDriverCounter({ count }: ActiveDriverCounterProps) {
  const label = count === 1 ? "motorista ativo" : "motoristas ativos";
  return (
    <span className="text-sm text-contrast">
      <strong className="text-dark font-semibold">{count}</strong> {label}
    </span>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/mapa/ActiveDriverCounter.tsx
git commit -m "feat(mapa): ActiveDriverCounter (singular/plural pt-BR)"
```

---

## Task 10: `MapaClient.tsx` — orquestração

**Files:**
- Create: `src/app/(dashboard)/mapa/MapaClient.tsx`

Componente principal — combina state, realtime, timer e todos os componentes filhos.

- [ ] **Step 1: Implementar**

```tsx
// src/app/(dashboard)/mapa/MapaClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  fetchActiveDrivers,
  fetchDriverMeta,
  type ActiveDriverLocation,
} from "@/lib/driver-locations";
import {
  SP_CAMPINAS_BOUNDS,
  GOOGLE_MAPS_LIBRARIES,
  assertGoogleMapsApiKey,
} from "@/lib/google-maps-config";
import DriverMarker from "@/components/mapa/DriverMarker";
import DriverPopup from "@/components/mapa/DriverPopup";
import DriverSearchInput from "@/components/mapa/DriverSearchInput";
import ActiveDriverCounter from "@/components/mapa/ActiveDriverCounter";

const ACTIVE_WINDOW_MS = 10 * 60_000;
const EXPIRY_TICK_MS = 60_000;
const FOCUS_ZOOM = 15;

const MAP_CONTAINER_STYLE: React.CSSProperties = {
  width: "100%",
  height: "calc(100vh - 128px)",
};

export default function MapaClient() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  assertGoogleMapsApiKey(apiKey);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [drivers, setDrivers] = useState<ActiveDriverLocation[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    fetchActiveDrivers()
      .then((rows) => {
        if (!cancelled) setDrivers(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar motoristas");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const upsertDriver = async (driverProfileId: string) => {
      try {
        const meta = await fetchDriverMeta(driverProfileId);
        if (!meta) return;
        setDrivers((prev) => {
          const existing = prev.findIndex((d) => d.driverProfileId === driverProfileId);
          if (existing === -1) return [...prev, meta];
          const copy = [...prev];
          copy[existing] = meta;
          return copy;
        });
      } catch {
        // silent — próximo update tenta de novo
      }
    };

    const handler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const newRow = (payload.new ?? {}) as { driver_profile_id?: string };
      const oldRow = (payload.old ?? {}) as { driver_profile_id?: string };

      if (payload.eventType === "DELETE") {
        const id = oldRow.driver_profile_id;
        if (id) setDrivers((prev) => prev.filter((d) => d.driverProfileId !== id));
        return;
      }
      const id = newRow.driver_profile_id;
      if (id) void upsertDriver(id);
    };

    const channel = supabase
      .channel("admin-driver-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        handler
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Timer de expiração
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - ACTIVE_WINDOW_MS;
      setDrivers((prev) =>
        prev.filter((d) => new Date(d.updatedAt).getTime() >= cutoff)
      );
    }, EXPIRY_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.driverProfileId === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  );

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    const bounds = new google.maps.LatLngBounds(
      { lat: SP_CAMPINAS_BOUNDS.south, lng: SP_CAMPINAS_BOUNDS.west },
      { lat: SP_CAMPINAS_BOUNDS.north, lng: SP_CAMPINAS_BOUNDS.east }
    );
    map.fitBounds(bounds);
  }, []);

  const onSelectFromSearch = useCallback(
    (driverProfileId: string) => {
      const d = drivers.find((x) => x.driverProfileId === driverProfileId);
      if (!d || !mapRef.current) return;
      mapRef.current.panTo({ lat: d.latitude, lng: d.longitude });
      mapRef.current.setZoom(FOCUS_ZOOM);
      setSelectedDriverId(driverProfileId);
    },
    [drivers]
  );

  if (loadError) {
    return (
      <div className="p-8 text-red-600">
        Erro ao carregar Google Maps: {loadError.message}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark">Mapa em tempo real</h1>
          <ActiveDriverCounter count={drivers.length} />
        </div>
        <DriverSearchInput drivers={drivers} onSelect={onSelectFromSearch} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="rounded-lg overflow-hidden border border-border">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {drivers.map((d) => (
              <DriverMarker
                key={d.driverProfileId}
                driver={d}
                onClick={setSelectedDriverId}
              />
            ))}
            {selectedDriver && (
              <DriverPopup
                driver={selectedDriver}
                onClose={() => setSelectedDriverId(null)}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={MAP_CONTAINER_STYLE} className="bg-gray-100 flex items-center justify-center text-contrast">
            Carregando mapa…
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build OK. Se houver erro de tipagem em `google.maps.*`, verificar que `@react-google-maps/api` está instalado (Task 1) — ela re-exporta os tipos globais.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/mapa/MapaClient.tsx"
git commit -m "feat(mapa): MapaClient orquestra state + realtime + timer

- Fetch inicial via fetchActiveDrivers()
- Channel 'admin-driver-locations' em postgres_changes (INSERT/UPDATE/DELETE)
- Upsert por driverProfileId via fetchDriverMeta (cobre joins que o payload realtime não traz)
- Timer 60s remove markers com updated_at > 10min
- fitBounds SP→Campinas no onLoad
- Busca centraliza câmera + abre popup"
```

---

## Task 11: `page.tsx` — server wrapper

**Files:**
- Create: `src/app/(dashboard)/mapa/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(dashboard)/mapa/page.tsx
import MapaClient from "./MapaClient";

export const metadata = {
  title: "Mapa · KZ Serviços",
};

export default function MapaPage() {
  return <MapaClient />;
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build OK, rota `/mapa` listada nas rotas do Next.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/mapa/page.tsx"
git commit -m "feat(mapa): rota /mapa (server wrapper)"
```

---

## Task 12: Sidebar — item "Mapa" entre Viagens e Chats

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Localizar o item Viagens no array `navItems`**

Ler `src/components/Sidebar.tsx` e identificar o objeto com `href: "/viagens"` (linhas 29-38 no snapshot atual).

- [ ] **Step 2: Inserir o item "Mapa" IMEDIATAMENTE DEPOIS de Viagens (antes de Chats)**

Substituir o bloco:

```tsx
  {
    href: "/viagens",
    label: "Viagens",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/chats",
```

Por:

```tsx
  {
    href: "/viagens",
    label: "Viagens",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/mapa",
    label: "Mapa",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    href: "/chats",
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: build OK.

- [ ] **Step 4: Verificar visualmente (dev server)**

```bash
npm run dev
```

Abrir `http://localhost:3000` como admin. Confirmar que o item "Mapa" aparece no Sidebar entre "Viagens" e "Chats", com ícone de mapa dobrado.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(mapa): item 'Mapa' no Sidebar entre Viagens e Chats"
```

---

## Task 13: E2E checklist manual + verificação final

**Files:**
- Create: `docs/superpowers/plans/subprojeto-3-e2e-checklist.md`

- [ ] **Step 1: Escrever checklist**

Conteúdo exato do arquivo:

````markdown
# Subprojeto 3 — Mapa admin de motoristas em tempo real — Checklist manual e2e

**Pré-requisitos:**
- `.env.local` do admin com `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` válida (HTTP referrer restriction configurado no GCP para `localhost:3000` em dev).
- App admin (`kz-servicos-web-app-fork`) rodando (`npm run dev`).
- App prestador (`kz-servicos-app-prestador`) buildado em ≥2 dispositivos/emuladores, ambos logados como motoristas aprovados publicando GPS.
- Supabase local ou staging.

---

## Cenário 1 — Motorista aparece no mapa

1. Admin autenticado abre `/mapa` no menu lateral.
2. Verificar:
   - Sidebar destaca "Mapa" como ativo.
   - Header mostra "Mapa em tempo real" + contador "X motoristas ativos".
   - Mapa renderiza cobrindo SP → Campinas por default.
3. Motorista 1 publica GPS pela primeira vez (app prestador).
4. **Assertiva:** marker aparece no mapa em <5s (fetch inicial + realtime combinado).
5. Border do marker é verde (motorista livre, sem trip).

### Assertiva SQL

```sql
SELECT driver_profile_id, latitude, longitude, updated_at, trip_id
  FROM driver_locations
 WHERE updated_at > now() - INTERVAL '10 minutes'
   AND driver_profile_id = '<uuid-motorista-1>';
```

Esperado: 1 linha, `trip_id IS NULL`.

---

## Cenário 2 — Motorista fica offline

1. A partir do estado do Cenário 1, parar app prestador do Motorista 1 (kill process).
2. Aguardar >10min sem publicações.
3. Ao próximo tick do timer de expiração (60s), marker some do mapa.
4. Contador do header decrementa.

---

## Cenário 3 — Motorista aceita corrida (verde → azul)

1. Motorista 1 aceita uma trip (`trip_driver_candidates.status='accepted'` → prestador começa a publicar `driver_locations.trip_id`).
2. **Assertiva:** border do marker muda de verde → azul em <5s.
3. Clicar no marker → popup abre.
4. Popup mostra botão "Abrir viagem →".
5. Clicar no botão → navega para `/viagens?openTrip=<trip_id>` e abre o `TripDetailModal` da trip correta.

### Assertiva SQL

```sql
SELECT trip_id FROM driver_locations WHERE driver_profile_id = '<uuid-motorista-1>';
```

Esperado: `trip_id` populado com o UUID da corrida aceita.

---

## Cenário 4 — Motorista finaliza corrida (azul → verde)

1. Continuando do Cenário 3, motorista chega ao destino e clica "Finalizar" no app prestador.
2. `trips.status='finished'`, `driver_locations.trip_id` volta a NULL (a lógica de nullify já existe no prestador — se não voltar automaticamente, é bug separado).
3. **Assertiva:** border volta a verde em <5s.
4. Reabrir popup: botão "Abrir viagem" desaparece.

---

## Cenário 5 — Busca por nome

1. Admin digita parte do nome de Motorista 1 no input de busca (mínimo 2 caracteres).
2. Dropdown mostra sugestões filtradas.
3. Clicar em uma sugestão:
   - Câmera anima até o marker (`panTo` + `setZoom(15)`).
   - Popup abre automaticamente com dados do motorista.

---

## Cenário 6 — Popup: dados completos

Abrindo popup de qualquer motorista, verificar presença de:
- Foto grande (64px) ou inicial do nome se `avatar_url` ausente.
- Nome completo.
- Badge de status verde ("Livre") ou azul ("Em corrida").
- Veículo: `{brand} {model} · {license_plate} · {color}` OU "Veículo não cadastrado".
- Linha "Atualizado há Xs" que atualiza a cada 5s enquanto o popup está aberto.
- Se em corrida: botão "Abrir viagem →" com link correto.

---

## Cenário 7 — Zero motoristas ativos

1. Nenhum motorista publicando GPS na janela de 10min.
2. Página carrega em bounds SP→Campinas.
3. Contador mostra "0 motoristas ativos".
4. Busca não retorna sugestões.
5. Sem erros no console.

---

## Regressão obrigatória

Após Cenários 1-7, rodar smoke test dos fluxos que compartilham infraestrutura:

- [ ] `/viagens` continua carregando e recebendo realtime na tabela `trips` (não conflita com o novo canal `admin-driver-locations`).
- [ ] `/motoristas` lista carrega normal.
- [ ] Sidebar não quebrou visualmente com o novo item (verificar largura do sidebar em viewport md+).
- [ ] Deep-link `/viagens?openTrip=<id>` continua abrindo o modal (padrão existente).
- [ ] Nenhum outro build/lint quebrado por conta do novo dep `@react-google-maps/api`.

---

## Débitos identificados (podem ficar para pós-GA)

- [ ] Cluster de markers (Google Marker Clusterer) para >50 motoristas simultâneos.
- [ ] Trail/histórico das últimas N posições do motorista.
- [ ] Filtro por status (livre/em corrida) — decidido conscientemente ficar fora.
- [ ] Lista lateral de motoristas ativos — decidido conscientemente ficar fora.
- [ ] Heatmap de densidade.
- [ ] Métrica "tempo médio de resposta" agregada no header.
- [ ] Handler de realtime sob throttle (agrupar updates em janela de 500ms) — só implementar se profiling mostrar problema com muitos motoristas.

---

## Execução

- [ ] Cenário 1 — Motorista aparece
- [ ] Cenário 2 — Motorista offline
- [ ] Cenário 3 — Aceita corrida (verde → azul)
- [ ] Cenário 4 — Finaliza corrida (azul → verde)
- [ ] Cenário 5 — Busca por nome
- [ ] Cenário 6 — Popup completo
- [ ] Cenário 7 — Zero motoristas
- [ ] Regressão obrigatória
- [ ] Registrar bugs em `docs/superpowers/plans/subprojeto-3-e2e-bugs.md` (criar sob demanda)
````

- [ ] **Step 2: Rodar TODOS os testes puros para verificar suite verde**

```bash
npx tsx --test src/lib/time-ago.test.ts src/lib/google-maps-config.test.ts src/lib/driver-locations.test.ts
```

Expected: PASS — 4 + 3 + 6 = 13 tests passing.

- [ ] **Step 3: Rodar build final**

```bash
npm run build
```

Expected: build OK, sem erros TS ou lint blockers.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/subprojeto-3-e2e-checklist.md
git commit -m "docs(mapa): checklist manual e2e do Subprojeto 3

7 cenários (motorista aparece, offline, verde→azul, azul→verde,
busca, popup completo, zero motoristas) + regressão obrigatória +
débitos deferidos documentados."
```

---

## Verificação global pós-execução

Após todas as tasks:

- [ ] `git log --oneline develop..HEAD` mostra ~13 commits (1 por task, exceto Tasks 5 e 12 que compartilham path com Task 4/base).
- [ ] `npm run build` limpo.
- [ ] Suite de testes puros verde: `npx tsx --test src/lib/{time-ago,google-maps-config,driver-locations}.test.ts`
- [ ] E2E checklist executado ao menos parcialmente antes de merge (Cenários 1 + 5 + 6 mínimos).
- [ ] Advisor Supabase confirma que nenhuma nova RLS foi criada e nenhum alerta novo apareceu:
  ```
  mcp__supabase__get_advisors
  ```
