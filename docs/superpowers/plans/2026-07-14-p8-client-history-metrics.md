# P8 — Client History & Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar no nome de um cliente na tela Clientes, abrir modal com contadores (finished, cancelled, totalSpent, averageRating), seletor de período (today/week/month/year), lista de trips do período; clique em trip abre o `TripDetailModal` existente.

**Architecture:** Copiar o padrão do Motoristas: novo `src/lib/client-metrics.ts` (análogo a `driver-metrics.ts`), nova função `fetchClientPerformance` em `api.ts`, novo componente `ClientTripHistoryModal` e integração em `clientes/page.tsx`.

**Tech Stack:** Next.js, TypeScript, Supabase JS client. Sem novas dependências.

**Spec:** `docs/superpowers/specs/2026-07-14-p8-client-history-metrics-design.md`

**SQL:** nenhum.

**Testes automatizados:** nenhum novo.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/types/database.ts` | modificar | Adicionar `ClientMetrics` e `ClientTripHistoryEntry` |
| `src/lib/client-metrics.ts` | criar | `buildClientMetrics` — análogo a `driver-metrics.ts` |
| `src/lib/api.ts` | modificar | `fetchClientPerformance(clientId, period)` |
| `src/components/ClientTripHistoryModal.tsx` | criar | Modal com contadores + seletor + lista + integração com TripDetailModal |
| `src/app/(dashboard)/clientes/page.tsx` | modificar | Trigger no click do nome, state, render do modal |

---

### Task 1: Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Adicionar `ClientMetrics` logo após `DriverMetrics`**

Localizar `DriverMetrics` (linha ~108). Adicionar logo depois:

```ts
export interface ClientMetrics {
  finishedTrips: number;
  cancelledTrips: number;
  totalSpent: number;
  averageRating: number;
}
```

- [ ] **Step 2: Adicionar `ClientTripHistoryEntry` logo após `DriverTripHistoryEntry`**

Localizar `DriverTripHistoryEntry` (linha ~360). Adicionar logo depois:

```ts
export interface ClientTripHistoryEntry {
  trip: Trip;
  ratings: Rating[];
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/types/database.ts`
Expected: sem erros.

---

### Task 2: Criar `src/lib/client-metrics.ts`

**Files:**
- Create: `src/lib/client-metrics.ts`

- [ ] **Step 1: Criar o arquivo completo**

Conteúdo:

```ts
import type { ClientMetrics, DriverMetricPeriod } from "@/types/database";
import { getDriverMetricPeriodRange } from "@/lib/driver-metrics";

type Range = { start: Date; end: Date };

type MetricTrip = {
  id: string;
  status: string;
  client_id: string;
  final_price: number | string | null;
  estimated_price: number | string | null;
  finished_at?: string | null;
  cancelled_at?: string | null;
  updated_at?: string | null;
  scheduled_datetime?: string | null;
};

type MetricRating = {
  id: string;
  rated_id: string;
  rating: number;
  created_at: string;
};

function inRange(iso: string | null | undefined, range: Range): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

function tripEffectiveDate(trip: MetricTrip): string | null | undefined {
  if (trip.status === "finished") return trip.finished_at ?? trip.updated_at;
  if (trip.status === "cancelled") return trip.cancelled_at ?? trip.updated_at;
  return trip.scheduled_datetime ?? trip.updated_at;
}

export function getClientMetricPeriodRange(
  period: DriverMetricPeriod,
  anchor = new Date(),
): Range {
  return getDriverMetricPeriodRange(period, anchor);
}

export function buildClientMetrics(input: {
  clientId: string;
  range: Range;
  trips: MetricTrip[];
  ratings: MetricRating[];
}): ClientMetrics {
  const tripsInRange = input.trips.filter(
    (trip) =>
      trip.client_id === input.clientId &&
      inRange(tripEffectiveDate(trip), input.range),
  );

  const finished = tripsInRange.filter((trip) => trip.status === "finished");
  const cancelled = tripsInRange.filter((trip) => trip.status === "cancelled");

  const totalSpent = finished.reduce((sum, trip) => {
    const raw = trip.final_price ?? trip.estimated_price ?? 0;
    const value = typeof raw === "string" ? Number(raw) : raw;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const ratingsInRange = input.ratings.filter(
    (rating) =>
      rating.rated_id === input.clientId &&
      inRange(rating.created_at, input.range),
  );
  const averageRating =
    ratingsInRange.length > 0
      ? Number(
          (
            ratingsInRange.reduce(
              (sum, rating) => sum + Number(rating.rating),
              0,
            ) / ratingsInRange.length
          ).toFixed(1),
        )
      : 0;

  return {
    finishedTrips: finished.length,
    cancelledTrips: cancelled.length,
    totalSpent,
    averageRating,
  };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint -- src/lib/client-metrics.ts`
Expected: sem erros.

---

### Task 3: Adicionar `fetchClientPerformance` em `api.ts`

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Adicionar imports faltantes**

Localizar o `import type { ... } from "@/types/database";` (topo do arquivo). Adicionar `ClientMetrics` e `ClientTripHistoryEntry` à lista de imports.

- [ ] **Step 2: Adicionar import de `buildClientMetrics`**

Adicionar no topo, junto dos outros imports locais:

```ts
import { buildClientMetrics, getClientMetricPeriodRange } from "@/lib/client-metrics";
```

- [ ] **Step 3: Adicionar a função ao final da seção de trips (após `fetchClientAddressHistory`)**

Localizar o final da função `fetchClientAddressHistory` (adicionada em P6). Adicionar imediatamente depois:

```ts
export async function fetchClientPerformance(
  clientId: string,
  period: DriverMetricPeriod,
): Promise<{ metrics: ClientMetrics; history: ClientTripHistoryEntry[] }> {
  const range = getClientMetricPeriodRange(period);
  const rangeStart = range.start.toISOString();

  const [tripsResult, ratingsResult] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
      )
      .eq("client_id", clientId)
      .gte("updated_at", rangeStart)
      .order("updated_at", { ascending: false }),
    supabase
      .from("ratings")
      .select(
        "*, rater:users!rater_id(id, full_name, email), rated:users!rated_id(id, full_name, email)",
      )
      .eq("rated_id", clientId)
      .gte("created_at", rangeStart)
      .order("created_at", { ascending: false }),
  ]);

  if (tripsResult.error) throw tripsResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const tripRows = (tripsResult.data ?? []) as Trip[];
  const ratings = (ratingsResult.data ?? []) as Rating[];

  const metrics = buildClientMetrics({
    clientId,
    range,
    trips: tripRows.map((trip) => ({
      id: trip.id,
      status: trip.status,
      client_id: trip.client_id,
      final_price: trip.final_price,
      estimated_price: trip.estimated_price,
      finished_at: trip.finished_at,
      cancelled_at: trip.cancelled_at,
      updated_at: trip.updated_at,
      scheduled_datetime: trip.scheduled_datetime,
    })),
    ratings: ratings.map((rating) => ({
      id: rating.id,
      rated_id: rating.rated_id,
      rating: Number(rating.rating),
      created_at: rating.created_at,
    })),
  });

  const ratingsByTrip = new Map<string, Rating[]>();
  for (const rating of ratings) {
    if (!rating.trip_id) continue;
    ratingsByTrip.set(rating.trip_id, [
      ...(ratingsByTrip.get(rating.trip_id) ?? []),
      rating,
    ]);
  }

  return {
    metrics,
    history: tripRows.map((trip) => ({
      trip,
      ratings: ratingsByTrip.get(trip.id) ?? [],
    })),
  };
}
```

- [ ] **Step 4: Lint**

Run: `npm run lint -- src/lib/api.ts`
Expected: sem erros.

---

### Task 4: Criar `ClientTripHistoryModal`

**Files:**
- Create: `src/components/ClientTripHistoryModal.tsx`

- [ ] **Step 1: Criar o arquivo**

Conteúdo:

```tsx
"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import TripDetailModal from "@/components/TripDetailModal";
import { formatBrazilDateTime } from "@/lib/brazil-time";
import { labelForTripStatus } from "@/lib/notifications";
import type {
  ClientMetrics,
  ClientTripHistoryEntry,
  DriverMetricPeriod,
  Trip,
  User,
} from "@/types/database";

interface Props {
  client: User | null;
  open: boolean;
  onClose: () => void;
  metrics: ClientMetrics | null;
  history: ClientTripHistoryEntry[];
  period: DriverMetricPeriod;
  onPeriodChange: (period: DriverMetricPeriod) => void;
  loading: boolean;
  onTripUpdated?: () => void;
}

const periodOptions: { value: DriverMetricPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Ano" },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function shortAddr(addr: string | undefined | null): string {
  if (!addr) return "—";
  return addr.split(",")[0]?.trim() ?? addr;
}

export default function ClientTripHistoryModal({
  client,
  open,
  onClose,
  metrics,
  history,
  period,
  onPeriodChange,
  loading,
  onTripUpdated,
}: Props) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={client ? `Histórico de ${client.full_name}` : "Histórico"}
      >
        <div className="flex flex-col gap-4 p-4">
          {/* Contadores */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Realizadas</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {metrics?.finishedTrips ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Canceladas</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {metrics?.cancelledTrips ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Total gasto</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {formatBRL(metrics?.totalSpent ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Avaliacao</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {metrics && metrics.averageRating > 0
                  ? metrics.averageRating.toFixed(1)
                  : "—"}
              </p>
            </div>
          </div>

          {/* Periodo */}
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPeriodChange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-heading font-bold transition-colors ${
                  period === opt.value
                    ? "bg-primary text-background"
                    : "border border-border text-dark hover:bg-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Lista de corridas */}
          {loading ? (
            <p className="py-8 text-center text-sm text-contrast">
              Carregando historico...
            </p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-contrast">
              Nenhuma corrida no periodo selecionado.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((entry) => (
                <li key={entry.trip.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTrip(entry.trip)}
                    className="w-full rounded-lg border border-border bg-surface p-3 text-left hover:border-primary/40 hover:bg-background"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-bold text-dark">
                          {shortAddr(entry.trip.pickup_address?.formatted_address)} →{" "}
                          {shortAddr(entry.trip.dropoff_address?.formatted_address)}
                        </p>
                        <p className="mt-1 text-xs text-contrast">
                          {formatBrazilDateTime(entry.trip.scheduled_datetime)}
                        </p>
                        <p className="mt-1 text-xs text-contrast">
                          Motorista:{" "}
                          {entry.trip.driver_profiles?.provider_profiles?.users
                            ?.full_name ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-dark">
                          {labelForTripStatus(entry.trip.status)}
                        </span>
                        {entry.trip.final_price ? (
                          <span className="text-xs font-heading font-bold text-dark">
                            {formatBRL(Number(entry.trip.final_price))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        onUpdate={() => {
          onTripUpdated?.();
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint -- src/components/ClientTripHistoryModal.tsx`
Expected: sem erros. Se `Modal` não aceitar os props usados (sem `footer` etc.), ajustar conforme a assinatura real do componente `src/components/Modal.tsx` — ler o arquivo e adaptar.

---

### Task 5: Integrar em `clientes/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/clientes/page.tsx`

- [ ] **Step 1: Ler o arquivo para entender estrutura atual**

Run: (via Read tool) `src/app/(dashboard)/clientes/page.tsx`

Localizar:
- Bloco de imports.
- Definição do componente e useState.
- Render dos cards/tabela — onde o nome do cliente aparece como texto ou botão.
- Onde já existem outros modais (ex.: ratings).

- [ ] **Step 2: Adicionar imports**

Adicionar ao bloco de imports:

```tsx
import ClientTripHistoryModal from "@/components/ClientTripHistoryModal";
import { fetchClientPerformance } from "@/lib/api";
import type {
  ClientMetrics,
  ClientTripHistoryEntry,
  DriverMetricPeriod,
} from "@/types/database";
```

- [ ] **Step 3: Adicionar estados**

Dentro do componente principal:

```tsx
const [historyClient, setHistoryClient] = useState<User | null>(null);
const [historyPeriod, setHistoryPeriod] = useState<DriverMetricPeriod>("month");
const [historyMetrics, setHistoryMetrics] = useState<ClientMetrics | null>(null);
const [historyEntries, setHistoryEntries] = useState<ClientTripHistoryEntry[]>([]);
const [historyLoading, setHistoryLoading] = useState(false);
```

- [ ] **Step 4: Adicionar useEffect que fetcha**

```tsx
useEffect(() => {
  if (!historyClient) return;
  let cancelled = false;
  setHistoryLoading(true);
  fetchClientPerformance(historyClient.id, historyPeriod)
    .then(({ metrics, history }) => {
      if (cancelled) return;
      setHistoryMetrics(metrics);
      setHistoryEntries(history);
    })
    .catch(() => {
      if (cancelled) return;
      setHistoryMetrics(null);
      setHistoryEntries([]);
    })
    .finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });
  return () => {
    cancelled = true;
  };
}, [historyClient, historyPeriod]);
```

- [ ] **Step 5: Fazer o nome do cliente ser clicável**

Localizar onde o nome do cliente é renderizado nos cards E na tabela. Envolver com `<button type="button" onClick={() => setHistoryClient(client)}>` mantendo o mesmo estilo/classes.

Verificar visualmente: nomes precisam ficar clicáveis nas duas views (card e tabela).

- [ ] **Step 6: Renderizar o modal**

Antes do fechamento do componente, adicionar:

```tsx
<ClientTripHistoryModal
  client={historyClient}
  open={!!historyClient}
  onClose={() => setHistoryClient(null)}
  metrics={historyMetrics}
  history={historyEntries}
  period={historyPeriod}
  onPeriodChange={setHistoryPeriod}
  loading={historyLoading}
  onTripUpdated={() => {
    if (historyClient) {
      fetchClientPerformance(historyClient.id, historyPeriod)
        .then(({ metrics, history }) => {
          setHistoryMetrics(metrics);
          setHistoryEntries(history);
        })
        .catch(() => {});
    }
  }}
/>
```

- [ ] **Step 7: Lint**

Run: `npm run lint -- "src/app/(dashboard)/clientes/page.tsx"`
Expected: sem erros.

---

### Task 6: Build de produção

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build passa sem erros.

- [ ] **Step 2: Diff**

Run: `git diff --stat -- src/types/database.ts src/lib/client-metrics.ts src/lib/api.ts src/components/ClientTripHistoryModal.tsx "src/app/(dashboard)/clientes/page.tsx"`
Expected: os 5 arquivos aparecem.

---

### Task 7: Checklist manual (backlog)

1. Abrir Clientes → clicar no nome de um cliente com histórico → modal abre com contadores.
2. Trocar período (today/week/month/year) → contadores e lista atualizam.
3. Clicar em uma trip da lista → TripDetailModal abre.
4. Fechar TripDetailModal → volta ao modal do cliente aberto.
5. Cliente sem trips → contadores 0 e mensagem "Nenhuma corrida no período".
6. Botão "Editar" continua abrindo NovoClienteForm.
7. Nome do cliente clicável tanto no card (mobile) quanto na tabela (desktop).

---

## Notas para o executor

- Se `src/components/Modal.tsx` tiver assinatura diferente (ex.: exige `footer` obrigatório), adaptar o `ClientTripHistoryModal` para casar. Preferir ajustar o modal em vez de forçar assinatura.
- O reuso de `TripDetailModal` está pronto — a assinatura já existe em `viagens/page.tsx` como referência.
- `labelForTripStatus` vem de `@/lib/notifications`; confirmar path no arquivo lido antes de importar.
- Se o `Trip` type não expuser `final_price` ou `estimated_price`, verificar em `src/types/database.ts` — ajustar o `client-metrics.ts` conforme campos reais.
