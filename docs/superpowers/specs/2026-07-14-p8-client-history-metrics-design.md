# P8 — Histórico e contadores no detalhe do cliente

**Data:** 2026-07-14
**Autor:** Claude (kz-dev)
**Status:** Aprovado para implementação

## Problema

Na tela de Clientes hoje não há visão detalhada por cliente: sem histórico de corridas, sem contadores. O padrão já existe em Motoristas — precisamos replicá-lo para Clientes.

## Design

### Métricas do cliente

Novo tipo `ClientMetrics` e função `buildClientMetrics` análogos ao existente `driver-metrics`. Retorna:

```ts
interface ClientMetrics {
  finishedTrips: number;      // trips com status='finished'
  cancelledTrips: number;     // trips com status='cancelled'
  totalSpent: number;         // soma de (final_price ?? estimated_price ?? 0) nas finished
  averageRating: number;      // média de ratings onde rated_id = clientId
}
```

Filtro por período (today | week | month | year): mesmas funções auxiliares que existem em `driver-metrics.ts` (reusar helpers `getDriverMetricPeriodRange`).

### Nova API: `fetchClientPerformance`

**Arquivo:** `src/lib/api.ts` (após `fetchClientAddressHistory`)

```ts
export async function fetchClientPerformance(
  clientId: string,
  period: DriverMetricPeriod,
): Promise<{ metrics: ClientMetrics; history: ClientTripHistoryEntry[] }>;
```

Duas queries em paralelo:
1. `SELECT trips (com joins de address/service/driver) WHERE client_id = ? AND created_at >= <period_start>` — ordenado desc por `created_at`.
2. `SELECT ratings (com rater expandido) WHERE rated_id = ? AND created_at >= <period_start>`.

`ClientTripHistoryEntry = { trip: Trip; ratings: Rating[] }` (mesma forma do driver, apenas o filtro dos ratings muda: para cada trip, pegar os ratings desse trip que foram dados AO cliente).

Cast do resultado usa mesmo padrão de `fetchDriverPerformance`.

### Nova biblioteca: `src/lib/client-metrics.ts`

Exporta:
```ts
export function buildClientMetrics(input: {
  clientId: string;
  range: { start: Date; end: Date };
  trips: Trip[];
  ratings: Rating[];
}): ClientMetrics;
```

Lógica:
- `finishedTrips = trips.filter(t => t.status === 'finished' && dentro do range).length`
- `cancelledTrips = trips.filter(t => t.status === 'cancelled' && dentro do range).length`
- `totalSpent = sum(trip.final_price ?? trip.estimated_price ?? 0) para finished no range`
- `averageRating = average(ratings.filter(r => r.rated_id === clientId && dentro do range).rating)` ou 0 se vazio

### UI: modal de histórico

**Arquivo modificado:** `src/app/(dashboard)/clientes/page.tsx`

- Novo estado `historyClient: User | null` e `historyPeriod: DriverMetricPeriod`.
- `handleOpenHistory(client)` seta `historyClient(client)` e período default `'month'`.
- `useEffect(historyClient, historyPeriod)`: fetch `fetchClientPerformance(historyClient.id, historyPeriod)` → armazena `metrics` e `history`.
- Novo modal `ClientTripHistoryModal` (componente próprio) que recebe: `client`, `open`, `onClose`, `metrics`, `history`, `period`, `onPeriodChange`, `loading`.
- Interior do modal: cards de contadores (4 cards) + seletor de período + lista de cards de trip (reaproveita layout do driver).
- Ao clicar em um item da lista: seta `selectedTrip = item.trip` e abre `TripDetailModal` (já existente e reutilizável).
- **Trigger:** clicar no nome do cliente no card/tabela chama `handleOpenHistory(client)`. Botão "Editar" segue funcionando separado.

### Componente novo: `ClientTripHistoryModal`

**Arquivo:** `src/components/ClientTripHistoryModal.tsx`

Client component. Estrutura reduzida (não é copy-paste do driver — extrai só o necessário):
- Header: nome do cliente + botão fechar.
- Grid de 4 cards de contadores (finished, cancelled, totalSpent formatado em BRL, averageRating com estrela).
- Seletor de período (4 botões).
- Lista de trips: cada card mostra data, endereços (pickup → dropoff), motorista, preço, status badge. Click abre `TripDetailModal`.
- Estado vazio: "Nenhuma corrida no período selecionado".
- Loading skeleton simples.

Reutiliza `TripDetailModal` para detalhes (não duplica).

### Types atualizados

`src/types/database.ts`:
- `ClientMetrics` (nova interface)
- `ClientTripHistoryEntry = { trip: Trip; ratings: Rating[] }` (nova, análoga a `DriverTripHistoryEntry`)

## Data flow

```
Admin lista Clientes →
Click no nome do cliente →
  setHistoryClient(client) + setHistoryPeriod('month')
  ↓
useEffect (historyClient) → fetchClientPerformance(id, period) →
  { metrics, history }
  ↓
Modal renderiza contadores + lista
  ↓
Admin clica em trip da lista →
  setSelectedTrip(trip) → TripDetailModal abre
  ↓
Admin muda período → useEffect refetcha com novo range
```

## Edge cases cobertos

- Cliente sem trips → contadores todos 0, lista vazia com mensagem.
- Cliente sem ratings recebidos → averageRating = 0.
- Trip finished sem `final_price` → usa `estimated_price` ou 0.
- Modal aberto + admin edita o cliente noutra aba → refresh não é automático; ok para escopo.
- Trip aberta via TripDetailModal e atualizada → `onUpdate` já é passado e chama refresh; podemos passar handler que refaz `fetchClientPerformance`.
- Realtime não requerido (padrão de motoristas também não usa).

## Testes

**Automatizados:** nenhum novo.

### Checklist manual

1. Abrir Clientes.
2. Clicar no nome de um cliente com histórico → modal abre com 4 contadores populados e lista das últimas trips do mês.
3. Trocar período para "hoje" / "semana" / "ano" → contadores e lista mudam.
4. Clicar em uma trip da lista → TripDetailModal abre com detalhes completos.
5. Fechar TripDetailModal → volta para o histórico (modal do cliente permanece aberto).
6. Cliente sem corridas → modal mostra "Nenhuma corrida no período".
7. Botão "Editar" no card do cliente segue abrindo o `NovoClienteForm` normalmente.
8. `SavedAddressesSummary` (Casa/Trabalho) continua exibido no card do cliente.

## SQL

**Nenhum.** Schema atual já suporta tudo (trips, ratings com rated_id).

## Fora do escopo

- Detalhamento fine-grained no card (ex.: gráfico de gastos por mês).
- Exportar histórico em CSV.
- Filtros adicionais (por endereço, motorista, etc).
- Ratings em duplo sentido além do que já existe.
- Refactor do detalhe de motoristas para reusar componentes — ficaria fora do escopo.
