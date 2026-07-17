# Edit Trip Route & Stops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o admin adicione/remova/reordene paradas e configure ida-e-volta em viagens já criadas, via modal de edição unificado e nova rota PATCH `/api/trips/[id]`.

**Architecture:** Lógica pura (`src/lib/trip-edit.ts`) ← testada com TDD; rota PATCH com service role valida auth, status e regras de negócio; função cliente `adminUpdateTrip` em `api.ts` substitui `adminUpdateTripBasics`; modal `EditTripBasicsModal` ganha seções de paradas e ida-e-volta.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role para PATCH), Tailwind CSS, node:test para testes unitários.

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Criar | `src/lib/trip-edit.ts` — funções puras |
| Criar | `src/lib/trip-edit.test.ts` — testes unitários |
| Criar | `src/app/api/trips/[id]/route.ts` — rota PATCH |
| Modificar | `src/lib/api.ts` — substituir `adminUpdateTripBasics` por `adminUpdateTrip` |
| Modificar | `src/components/EditTripBasicsModal.tsx` — UI de paradas e ida-e-volta |

---

## Task 1: Funções puras em `src/lib/trip-edit.ts` (TDD)

**Files:**
- Create: `src/lib/trip-edit.ts`
- Create: `src/lib/trip-edit.test.ts`

### 1.1 — Escrever o arquivo de testes com todos os casos RED

- [ ] Criar `src/lib/trip-edit.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditTripRoute,
  validateTripPatch,
  buildTripPatchPayload,
  type TripPatch,
  type TripPatchCurrent,
} from "./trip-edit.ts";

// ── canEditTripRoute ────────────────────────────────────────────────

test("canEditTripRoute: false para started", () => {
  assert.equal(canEditTripRoute("started"), false);
});

test("canEditTripRoute: false para finished", () => {
  assert.equal(canEditTripRoute("finished"), false);
});

test("canEditTripRoute: false para cancelled", () => {
  assert.equal(canEditTripRoute("cancelled"), false);
});

test("canEditTripRoute: true para open", () => {
  assert.equal(canEditTripRoute("open"), true);
});

test("canEditTripRoute: true para scheduled", () => {
  assert.equal(canEditTripRoute("scheduled"), true);
});

test("canEditTripRoute: true para searching_drivers", () => {
  assert.equal(canEditTripRoute("searching_drivers"), true);
});

test("canEditTripRoute: true para awaiting_client_confirmation", () => {
  assert.equal(canEditTripRoute("awaiting_client_confirmation"), true);
});

test("canEditTripRoute: true para awaiting_driver_confirmation", () => {
  assert.equal(canEditTripRoute("awaiting_driver_confirmation"), true);
});

test("canEditTripRoute: true para under_review", () => {
  assert.equal(canEditTripRoute("under_review"), true);
});

test("canEditTripRoute: true para review_rejected", () => {
  assert.equal(canEditTripRoute("review_rejected"), true);
});

// ── validateTripPatch ──────────────────────────────────────────────

const baseCurrent: TripPatchCurrent = {
  is_round_trip: false,
  return_datetime: null,
};

test("validateTripPatch: ida-e-volta ativa sem return_datetime retorna erro", () => {
  const patch: TripPatch = { is_round_trip: true };
  const err = validateTripPatch(patch, baseCurrent);
  assert.ok(err, "deveria retornar erro");
  assert.ok(err!.includes("retorno"), `mensagem inesperada: ${err}`);
});

test("validateTripPatch: ida-e-volta ativa COM return_datetime retorna null", () => {
  const patch: TripPatch = { is_round_trip: true, return_datetime: "2026-08-01T10:00:00.000Z" };
  assert.equal(validateTripPatch(patch, baseCurrent), null);
});

test("validateTripPatch: desativar ida-e-volta ignora return_datetime ausente", () => {
  const current: TripPatchCurrent = { is_round_trip: true, return_datetime: "2026-08-01T10:00:00.000Z" };
  const patch: TripPatch = { is_round_trip: false };
  assert.equal(validateTripPatch(patch, current), null);
});

test("validateTripPatch: patch sem is_round_trip com current active + return_datetime presente retorna null", () => {
  const current: TripPatchCurrent = { is_round_trip: true, return_datetime: "2026-08-01T10:00:00.000Z" };
  const patch: TripPatch = { scheduled_datetime: "2026-09-01T08:00:00.000Z" };
  assert.equal(validateTripPatch(patch, current), null);
});

test("validateTripPatch: patch sem is_round_trip com current active SEM return_datetime retorna erro", () => {
  const current: TripPatchCurrent = { is_round_trip: true, return_datetime: null };
  const patch: TripPatch = { scheduled_datetime: "2026-09-01T08:00:00.000Z" };
  const err = validateTripPatch(patch, current);
  assert.ok(err, "deveria retornar erro");
});

// ── buildTripPatchPayload ───────────────────────────────────────────

const addr1 = { formatted_address: "Rua A, 1", google_place_id: "p1" };
const addr2 = { formatted_address: "Rua B, 2", google_place_id: "p2" };
const addr3 = { formatted_address: "Rua C, 3", google_place_id: "p3" };

const baseOriginal = {
  pickup: addr1,
  dropoff: addr2,
  scheduled_datetime: "2026-08-01T08:00:00.000Z",
  stops: [] as typeof addr1[],
  is_round_trip: false,
  return_datetime: null as string | null,
};

test("buildTripPatchPayload: sem mudanças retorna null", () => {
  const result = buildTripPatchPayload(baseOriginal, baseOriginal);
  assert.equal(result, null);
});

test("buildTripPatchPayload: só datetime mudou", () => {
  const edited = { ...baseOriginal, scheduled_datetime: "2026-09-01T08:00:00.000Z" };
  const result = buildTripPatchPayload(baseOriginal, edited);
  assert.ok(result);
  assert.equal(result!.scheduled_datetime, "2026-09-01T08:00:00.000Z");
  assert.equal("stops" in result!, false, "stops não deve estar no payload");
});

test("buildTripPatchPayload: pickup mudou inclui pickup no payload", () => {
  const edited = { ...baseOriginal, pickup: addr3 };
  const result = buildTripPatchPayload(baseOriginal, edited);
  assert.ok(result);
  assert.deepEqual(result!.pickup, addr3);
});

test("buildTripPatchPayload: adicionar parada inclui stops completo", () => {
  const edited = { ...baseOriginal, stops: [addr3] };
  const result = buildTripPatchPayload(baseOriginal, edited);
  assert.ok(result);
  assert.deepEqual(result!.stops, [addr3]);
});

test("buildTripPatchPayload: remover todas as paradas inclui stops vazio", () => {
  const original = { ...baseOriginal, stops: [addr3] };
  const edited = { ...baseOriginal, stops: [] };
  const result = buildTripPatchPayload(original, edited);
  assert.ok(result);
  assert.deepEqual(result!.stops, []);
});

test("buildTripPatchPayload: reordenar paradas inclui stops completo", () => {
  const original = { ...baseOriginal, stops: [addr1, addr2] };
  const edited = { ...baseOriginal, stops: [addr2, addr1] };
  const result = buildTripPatchPayload(original, edited);
  assert.ok(result);
  assert.deepEqual(result!.stops, [addr2, addr1]);
});

test("buildTripPatchPayload: ativar ida-e-volta inclui is_round_trip e return_datetime", () => {
  const edited = { ...baseOriginal, is_round_trip: true, return_datetime: "2026-08-10T10:00:00.000Z" };
  const result = buildTripPatchPayload(baseOriginal, edited);
  assert.ok(result);
  assert.equal(result!.is_round_trip, true);
  assert.equal(result!.return_datetime, "2026-08-10T10:00:00.000Z");
});

test("buildTripPatchPayload: desativar ida-e-volta zera return_datetime no payload", () => {
  const original = { ...baseOriginal, is_round_trip: true, return_datetime: "2026-08-10T10:00:00.000Z" };
  const edited = { ...original, is_round_trip: false, return_datetime: null };
  const result = buildTripPatchPayload(original, edited);
  assert.ok(result);
  assert.equal(result!.is_round_trip, false);
  assert.equal(result!.return_datetime, null);
});
```

- [ ] Rodar para confirmar que TUDO falha (arquivo ainda não existe):

```
node --test src/lib/trip-edit.test.ts
```

Esperado: erro de módulo não encontrado.

### 1.2 — Implementar `src/lib/trip-edit.ts`

- [ ] Criar `src/lib/trip-edit.ts`:

```ts
import type { TripStatus } from "@/types/database";
import type { GooglePlaceAddress } from "@/lib/google-places";

export interface TripPatchCurrent {
  is_round_trip: boolean;
  return_datetime: string | null;
}

export interface TripPatch {
  pickup?: GooglePlaceAddress;
  dropoff?: GooglePlaceAddress;
  scheduled_datetime?: string;
  stops?: GooglePlaceAddress[];
  is_round_trip?: boolean;
  return_datetime?: string | null;
}

const BLOCKED_STATUSES: TripStatus[] = ["started", "finished", "cancelled"];

export function canEditTripRoute(status: TripStatus): boolean {
  return !BLOCKED_STATUSES.includes(status);
}

export function validateTripPatch(
  patch: TripPatch,
  current: TripPatchCurrent,
): string | null {
  const roundTripActive =
    patch.is_round_trip !== undefined
      ? patch.is_round_trip
      : current.is_round_trip;

  if (!roundTripActive) return null;

  const returnDatetime =
    patch.return_datetime !== undefined
      ? patch.return_datetime
      : current.return_datetime;

  if (!returnDatetime) {
    return "Data/hora de retorno é obrigatória para viagens de ida e volta.";
  }
  return null;
}

export function buildTripPatchPayload(
  original: {
    pickup: GooglePlaceAddress;
    dropoff: GooglePlaceAddress;
    scheduled_datetime: string;
    stops: GooglePlaceAddress[];
    is_round_trip: boolean;
    return_datetime: string | null;
  },
  edited: {
    pickup: GooglePlaceAddress;
    dropoff: GooglePlaceAddress;
    scheduled_datetime: string;
    stops: GooglePlaceAddress[];
    is_round_trip: boolean;
    return_datetime: string | null;
  },
): TripPatch | null {
  const payload: TripPatch = {};

  if (!isSameAddress(original.pickup, edited.pickup)) {
    payload.pickup = edited.pickup;
  }
  if (!isSameAddress(original.dropoff, edited.dropoff)) {
    payload.dropoff = edited.dropoff;
  }
  if (original.scheduled_datetime !== edited.scheduled_datetime) {
    payload.scheduled_datetime = edited.scheduled_datetime;
  }
  if (stopsChanged(original.stops, edited.stops)) {
    payload.stops = edited.stops;
  }
  if (original.is_round_trip !== edited.is_round_trip) {
    payload.is_round_trip = edited.is_round_trip;
    payload.return_datetime = edited.is_round_trip ? edited.return_datetime : null;
  } else if (original.return_datetime !== edited.return_datetime) {
    payload.return_datetime = edited.return_datetime;
  }

  return Object.keys(payload).length === 0 ? null : payload;
}

function isSameAddress(a: GooglePlaceAddress, b: GooglePlaceAddress): boolean {
  if (a.google_place_id && b.google_place_id) {
    return a.google_place_id === b.google_place_id;
  }
  return a.formatted_address === b.formatted_address;
}

function stopsChanged(
  original: GooglePlaceAddress[],
  edited: GooglePlaceAddress[],
): boolean {
  if (original.length !== edited.length) return true;
  return original.some((stop, i) => !isSameAddress(stop, edited[i]));
}
```

- [ ] Rodar testes:

```
node --test src/lib/trip-edit.test.ts
```

Esperado: todos os testes passando (0 fail).

### 1.3 — Commitar

- [ ] Commitar:

```bash
git add src/lib/trip-edit.ts src/lib/trip-edit.test.ts
git commit -m "feat: add trip-edit pure functions (canEditTripRoute, validateTripPatch, buildTripPatchPayload)"
```

---

## Task 2: Rota PATCH `/api/trips/[id]`

**Files:**
- Create: `src/app/api/trips/[id]/route.ts`

### 2.1 — Criar a rota

- [ ] Criar pasta `src/app/api/trips/[id]/` e o arquivo `route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canEditTripRoute, validateTripPatch } from "@/lib/trip-edit";
import type { GooglePlaceAddress } from "@/lib/google-places";
import type { TripStatus } from "@/types/database";

type AddressRow = {
  formatted_address: string;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

function toAddressRow(addr: GooglePlaceAddress): AddressRow {
  return {
    formatted_address: addr.formatted_address,
    google_place_id: addr.google_place_id ?? null,
    latitude: addr.latitude ?? null,
    longitude: addr.longitude ?? null,
    street: addr.street ?? null,
    number: addr.number ?? null,
    neighborhood: addr.neighborhood ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    zip_code: addr.zip_code ?? null,
  };
}

async function insertAddress(
  admin: ReturnType<typeof getSupabaseAdmin>,
  addr: GooglePlaceAddress,
): Promise<string> {
  const { data, error } = await admin
    .from("addresses")
    .insert(toAddressRow(addr))
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao inserir endereço");
  return data.id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = getSupabaseAdmin();
    const { id: tripId } = await params;

    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (userError || userData?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ── Carregar viagem ───────────────────────────────────────────
    const { data: trip, error: tripError } = await admin
      .from("trips")
      .select("id, status, is_round_trip, return_datetime, trip_stops(id, stop_order, address_id)")
      .eq("id", tripId)
      .single();
    if (tripError || !trip) {
      return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });
    }

    // ── Parse body ────────────────────────────────────────────────
    const body = (await request.json().catch(() => ({}))) as {
      pickup?: GooglePlaceAddress;
      dropoff?: GooglePlaceAddress;
      scheduled_datetime?: string;
      stops?: GooglePlaceAddress[];
      is_round_trip?: boolean;
      return_datetime?: string | null;
    };

    const touchesRoute =
      "stops" in body || "is_round_trip" in body || "return_datetime" in body;

    // ── Verificar status para edição de rota ──────────────────────
    if (touchesRoute && !canEditTripRoute(trip.status as TripStatus)) {
      return NextResponse.json(
        { error: "Paradas e ida e volta não podem ser alteradas após o início da viagem" },
        { status: 409 },
      );
    }

    // ── Validar regras de negócio ─────────────────────────────────
    const validationError = validateTripPatch(body, {
      is_round_trip: trip.is_round_trip,
      return_datetime: trip.return_datetime,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // ── Inserir endereços e montar payload do UPDATE ──────────────
    const tripPayload: Record<string, unknown> = {};

    if (body.pickup) {
      tripPayload.pickup_address_id = await insertAddress(admin, body.pickup);
    }
    if (body.dropoff) {
      tripPayload.dropoff_address_id = await insertAddress(admin, body.dropoff);
    }
    if (body.scheduled_datetime !== undefined) {
      tripPayload.scheduled_datetime = body.scheduled_datetime;
    }
    if (body.is_round_trip !== undefined) {
      tripPayload.is_round_trip = body.is_round_trip;
      tripPayload.return_datetime = body.is_round_trip
        ? (body.return_datetime ?? null)
        : null;
    } else if ("return_datetime" in body) {
      tripPayload.return_datetime = body.return_datetime ?? null;
    }

    // ── UPDATE trips ──────────────────────────────────────────────
    if (Object.keys(tripPayload).length > 0) {
      const { error: updateError } = await admin
        .from("trips")
        .update(tripPayload)
        .eq("id", tripId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    // ── Substituir paradas ────────────────────────────────────────
    if ("stops" in body) {
      const oldStops = (trip.trip_stops ?? []) as { id: string; stop_order: number; address_id: string }[];

      const { error: deleteError } = await admin
        .from("trip_stops")
        .delete()
        .eq("trip_id", tripId);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 });
      }

      if (body.stops && body.stops.length > 0) {
        const newAddressIds: string[] = [];
        for (const stop of body.stops) {
          if (!stop.formatted_address?.trim()) continue;
          newAddressIds.push(await insertAddress(admin, stop));
        }

        if (newAddressIds.length > 0) {
          const stopRows = newAddressIds.map((address_id, index) => ({
            trip_id: tripId,
            address_id,
            stop_order: index + 1,
          }));
          const { error: insertError } = await admin.from("trip_stops").insert(stopRows);
          if (insertError) {
            // Rollback best-effort: reinsere as paradas antigas
            if (oldStops.length > 0) {
              await admin.from("trip_stops").insert(
                oldStops.map((s) => ({
                  trip_id: tripId,
                  address_id: s.address_id,
                  stop_order: s.stop_order,
                })),
              );
            }
            return NextResponse.json({ error: insertError.message }, { status: 400 });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] Verificar que o TypeScript aceita o arquivo (sem erros nesta linha):

```
npx tsc --noEmit 2>&1 | grep "trips/\[id\]"
```

Esperado: nenhuma saída (sem erros no arquivo novo).

### 2.2 — Commitar

- [ ] Commitar:

```bash
git add src/app/api/trips/[id]/route.ts
git commit -m "feat: add PATCH /api/trips/[id] route for admin trip editing"
```

---

## Task 3: Função cliente `adminUpdateTrip` em `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts`

### 3.1 — Substituir `adminUpdateTripBasics` por `adminUpdateTrip`

- [ ] Em `src/lib/api.ts`, localizar a função `adminUpdateTripBasics` (linha ~292) e substituí-la por `adminUpdateTrip`:

```ts
export async function adminUpdateTrip(
  tripId: string,
  updates: {
    pickup?: GooglePlaceAddress;
    dropoff?: GooglePlaceAddress;
    scheduled_datetime?: string;
    stops?: GooglePlaceAddress[];
    is_round_trip?: boolean;
    return_datetime?: string | null;
  },
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão inválida");

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Erro ao atualizar viagem");

  logAdminAction("Viagem editada", tripId, updates);
}
```

**Remover** o bloco antigo de `adminUpdateTripBasics` (as ~65 linhas que fazem INSERT direto via supabase client).

- [ ] Verificar que o TypeScript compila sem erros na função nova:

```
npx tsc --noEmit 2>&1 | grep "api.ts"
```

Esperado: sem erros novos em `api.ts`.

### 3.2 — Atualizar `EditTripBasicsModal` para usar o novo nome

A chamada `adminUpdateTripBasics` no modal será substituída no Task 4. Por agora, anotar que o import vai mudar de `adminUpdateTripBasics` para `adminUpdateTrip`.

### 3.3 — Commitar

- [ ] Commitar:

```bash
git add src/lib/api.ts
git commit -m "refactor: replace adminUpdateTripBasics with adminUpdateTrip (calls PATCH route)"
```

---

## Task 4: UI — expandir `EditTripBasicsModal`

**Files:**
- Modify: `src/components/EditTripBasicsModal.tsx`

### 4.1 — Reescrever o modal

O modal atual tem ~200 linhas. Abaixo está o arquivo completo reescrito com as novas seções. Substitua o conteúdo inteiro de `src/components/EditTripBasicsModal.tsx`:

```tsx
"use client";

import { useEffect, useId, useState } from "react";
import Modal from "@/components/Modal";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import { useToast } from "@/components/Toast";
import { adminUpdateTrip } from "@/lib/api";
import {
  buildTripPatchPayload,
  canEditTripRoute,
  validateTripPatch,
} from "@/lib/trip-edit";
import type { GooglePlaceAddress } from "@/lib/google-places";
import type { Trip } from "@/types/database";

interface Props {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface StopEntry {
  id: string;
  address: GooglePlaceAddress | null;
}

function addressToGoogle(
  addr:
    | {
        formatted_address: string;
        google_place_id: string | null;
        latitude: number | null;
        longitude: number | null;
        street: string | null;
        number: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
      }
    | null
    | undefined,
): GooglePlaceAddress | null {
  if (!addr) return null;
  return {
    formatted_address: addr.formatted_address,
    google_place_id: addr.google_place_id,
    latitude: addr.latitude,
    longitude: addr.longitude,
    street: addr.street,
    number: addr.number,
    neighborhood: addr.neighborhood,
    city: addr.city,
    state: addr.state,
    zip_code: addr.zip_code,
  };
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

let stopCounter = 0;
function newStopId(): string {
  return `stop-${++stopCounter}`;
}

export default function EditTripBasicsModal({
  trip,
  open,
  onClose,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const roundtripId = useId();
  const [saving, setSaving] = useState(false);

  // Básicos
  const [pickup, setPickup] = useState<GooglePlaceAddress | null>(null);
  const [dropoff, setDropoff] = useState<GooglePlaceAddress | null>(null);
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [originalPickup, setOriginalPickup] = useState<GooglePlaceAddress | null>(null);
  const [originalDropoff, setOriginalDropoff] = useState<GooglePlaceAddress | null>(null);
  const [originalDatetime, setOriginalDatetime] = useState("");

  // Paradas
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [originalStops, setOriginalStops] = useState<GooglePlaceAddress[]>([]);

  // Ida e volta
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDatetime, setReturnDatetime] = useState("");
  const [returnError, setReturnError] = useState(false);
  const [originalIsRoundTrip, setOriginalIsRoundTrip] = useState(false);
  const [originalReturnDatetime, setOriginalReturnDatetime] = useState("");

  const routeEditable = trip ? canEditTripRoute(trip.status) : false;

  useEffect(() => {
    if (!open || !trip) return;

    const p = addressToGoogle(trip.pickup_address);
    const d = addressToGoogle(trip.dropoff_address);
    const dt = isoToLocalInput(trip.scheduled_datetime);
    setPickup(p);
    setDropoff(d);
    setScheduledDatetime(dt);
    setOriginalPickup(p);
    setOriginalDropoff(d);
    setOriginalDatetime(dt);

    const sortedStops = [...(trip.trip_stops ?? [])].sort(
      (a, b) => a.stop_order - b.stop_order,
    );
    const stopAddresses = sortedStops.map((s) =>
      addressToGoogle(s.addresses ?? null),
    );
    const stopEntries: StopEntry[] = stopAddresses
      .filter((a): a is GooglePlaceAddress => a !== null)
      .map((a) => ({ id: newStopId(), address: a }));
    setStops(stopEntries);
    setOriginalStops(stopAddresses.filter((a): a is GooglePlaceAddress => a !== null));

    setIsRoundTrip(trip.is_round_trip);
    setOriginalIsRoundTrip(trip.is_round_trip);
    const rt = isoToLocalInput(trip.return_datetime);
    setReturnDatetime(rt);
    setOriginalReturnDatetime(rt);
    setReturnError(false);
  }, [open, trip]);

  async function handleSave() {
    if (!trip) return;
    if (!pickup) {
      toast("warning", "Endereço de embarque é obrigatório.");
      return;
    }
    if (!dropoff) {
      toast("warning", "Endereço de destino é obrigatório.");
      return;
    }
    if (!scheduledDatetime) {
      toast("warning", "Data e hora são obrigatórias.");
      return;
    }

    const validStops = stops
      .map((s) => s.address)
      .filter((a): a is GooglePlaceAddress => a !== null);

    const returnIso = isRoundTrip && returnDatetime
      ? localInputToIso(returnDatetime)
      : null;

    const patchError = validateTripPatch(
      {
        is_round_trip: isRoundTrip,
        return_datetime: returnIso,
        stops: routeEditable ? validStops : undefined,
      },
      { is_round_trip: trip.is_round_trip, return_datetime: trip.return_datetime },
    );
    if (patchError) {
      setReturnError(true);
      toast("warning", patchError);
      return;
    }
    setReturnError(false);

    const payload = buildTripPatchPayload(
      {
        pickup: originalPickup!,
        dropoff: originalDropoff!,
        scheduled_datetime: originalDatetime ? localInputToIso(originalDatetime) : trip.scheduled_datetime,
        stops: originalStops,
        is_round_trip: originalIsRoundTrip,
        return_datetime: originalReturnDatetime ? localInputToIso(originalReturnDatetime) : trip.return_datetime,
      },
      {
        pickup: pickup!,
        dropoff: dropoff!,
        scheduled_datetime: localInputToIso(scheduledDatetime),
        stops: routeEditable ? validStops : originalStops,
        is_round_trip: routeEditable ? isRoundTrip : originalIsRoundTrip,
        return_datetime: routeEditable
          ? (isRoundTrip && returnDatetime ? localInputToIso(returnDatetime) : null)
          : (trip.return_datetime),
      },
    );

    if (!payload) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await adminUpdateTrip(trip.id, payload);
      toast("success", "Viagem atualizada.");
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast("danger", message || "Erro ao atualizar viagem.");
    } finally {
      setSaving(false);
    }
  }

  function moveStop(index: number, direction: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const footer = (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="px-4 py-2 text-sm font-body text-contrast hover:text-dark disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Editar viagem" footer={footer}>
      <div className="flex flex-col gap-4">
        {/* Básicos */}
        <AddressAutocompleteField
          label="Endereço de embarque"
          value={pickup}
          onChange={setPickup}
          disabled={saving}
        />
        <AddressAutocompleteField
          label="Endereço de destino"
          value={dropoff}
          onChange={setDropoff}
          disabled={saving}
        />
        <div>
          <label className="block text-sm font-body text-contrast mb-1">
            Data e hora
          </label>
          <input
            type="datetime-local"
            value={scheduledDatetime}
            onChange={(e) => setScheduledDatetime(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg bg-background border border-border text-dark focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-sm font-body disabled:opacity-50"
          />
        </div>

        {/* Aviso de bloqueio */}
        {!routeEditable && (
          <p className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-body text-contrast">
            Paradas e ida e volta não podem ser alteradas após o início da viagem.
          </p>
        )}

        {/* Paradas */}
        <div>
          <p className="text-sm font-body text-contrast mb-2">Paradas no percurso</p>
          <div className="flex flex-col gap-2">
            {stops.map((stop, index) => (
              <div
                key={stop.id}
                className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-body text-contrast">
                    Parada {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveStop(index, -1)}
                      disabled={saving || !routeEditable || index === 0}
                      className="px-1.5 py-0.5 text-xs rounded border border-border hover:bg-surface-hover disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStop(index, 1)}
                      disabled={saving || !routeEditable || index === stops.length - 1}
                      className="px-1.5 py-0.5 text-xs rounded border border-border hover:bg-surface-hover disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStops((prev) => prev.filter((s) => s.id !== stop.id))
                      }
                      disabled={saving || !routeEditable}
                      className="px-1.5 py-0.5 text-xs rounded border border-border text-danger hover:bg-surface-hover disabled:opacity-30"
                      aria-label="Remover parada"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <AddressAutocompleteField
                  label=""
                  placeholder="Endereço da parada"
                  value={stop.address}
                  onChange={(addr) =>
                    setStops((prev) =>
                      prev.map((s) =>
                        s.id === stop.id ? { ...s, address: addr } : s,
                      ),
                    )
                  }
                  disabled={saving || !routeEditable}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setStops((prev) => [...prev, { id: newStopId(), address: null }])
            }
            disabled={saving || !routeEditable}
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-heading font-bold text-dark hover:border-primary hover:text-primary disabled:opacity-30"
          >
            + Adicionar parada
          </button>
        </div>

        {/* Ida e volta */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id={roundtripId}
              type="checkbox"
              checked={isRoundTrip}
              onChange={(e) => {
                setIsRoundTrip(e.target.checked);
                if (!e.target.checked) {
                  setReturnDatetime("");
                  setReturnError(false);
                }
              }}
              disabled={saving || !routeEditable}
              className="rounded border-border bg-background text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
            />
            <span className="text-sm font-body text-dark">Ida e volta</span>
          </label>

          {isRoundTrip && (
            <div>
              <label className="block text-sm font-body text-contrast mb-1">
                Data/hora retorno
              </label>
              <input
                type="datetime-local"
                value={returnDatetime}
                onChange={(e) => {
                  setReturnDatetime(e.target.value);
                  setReturnError(false);
                }}
                disabled={saving || !routeEditable}
                className={`w-full rounded-lg bg-background border text-dark focus:ring-1 focus:outline-none px-3 py-2 text-sm font-body disabled:opacity-50 ${returnError ? "border-danger focus:ring-danger" : "border-border focus:ring-primary"}`}
              />
              {returnError && (
                <p className="mt-1 text-xs text-danger font-body">
                  Data/hora de retorno é obrigatória.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

### 4.2 — Verificar TypeScript no modal

- [ ] Rodar:

```
npx tsc --noEmit 2>&1 | grep "EditTripBasicsModal"
```

Esperado: sem erros.

### 4.3 — Commitar

- [ ] Commitar:

```bash
git add src/components/EditTripBasicsModal.tsx
git commit -m "feat: expand EditTripBasicsModal with stops and round-trip editing"
```

---

## Task 5: Verificação completa (testes + lint + manual)

**Files:** nenhum novo — só verificação.

### 5.1 — Rodar toda a suíte de testes

- [ ] Rodar:

```
node --test "src/lib/*.test.ts"
```

Esperado: todos passando, 0 fail.

### 5.2 — Verificar TypeScript do projeto

- [ ] Rodar:

```
npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "error" | head -20
```

Esperado: apenas os erros pré-existentes (não relacionados a arquivos deste feature — `trip-edit.ts`, `route.ts`, `api.ts`, `EditTripBasicsModal.tsx` sem erros).

### 5.3 — Checklist manual no navegador

Com o servidor rodando (`npm run dev`), abrir o painel de viagens:

- [ ] **Paradas:** abrir viagem `scheduled` → clicar "Editar viagem" → adicionar 2 paradas → salvar → reabrir → paradas na ordem correta.
- [ ] **Reordenar:** usar ↑/↓ para trocar ordem → salvar → reabrir → ordem persiste.
- [ ] **Remover:** remover todas as paradas → salvar → viagem sem paradas.
- [ ] **Ida-e-volta sem retorno:** marcar "Ida e volta" sem preencher data → clicar salvar → aviso aparece no campo.
- [ ] **Ida-e-volta completo:** marcar + preencher retorno → salvar → desmarcar → salvar → `return_datetime` sumiu.
- [ ] **Viagem `started`:** seção de paradas/ida-e-volta mostra aviso e botões desabilitados; embarque e data seguem editáveis.
- [ ] **Sem mudanças:** abrir e fechar sem alterar nada → nenhuma request PATCH enviada.

### 5.4 — Commit final

- [ ] Commitar se necessário (arquivos de ajuste):

```bash
git add -p
git commit -m "fix: post-review adjustments for trip route editing"
```
