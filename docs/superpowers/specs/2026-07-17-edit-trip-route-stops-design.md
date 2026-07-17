# Editar paradas e ida-e-volta em viagem já criada

**Data:** 2026-07-17
**Status:** Aprovado para implementação

## Problema

Depois que uma viagem é criada, o admin só consegue editar embarque, destino e data/hora (`EditTripBasicsModal` + `adminUpdateTripBasics`). Paradas (`trip_stops`) e ida-e-volta (`trips.is_round_trip` + `trips.return_datetime`) só podem ser definidas na criação (`NovaViagemForm` + `POST /api/trips`). O admin precisa de edição completa da rota pós-criação: adicionar, remover e reordenar paradas; ligar/desligar ida-e-volta e editar a data/hora de retorno.

## Decisões de produto (confirmadas com o usuário)

- **Quando:** paradas e ida-e-volta só podem ser alteradas **antes de a viagem iniciar** (status diferente de `started`, `finished`, `cancelled`). Embarque/destino/data continuam editáveis em qualquer status (comportamento P4 preservado).
- **Escopo:** edição completa (adicionar/remover/reordenar paradas; ativar/desativar ida-e-volta).
- **Notificação:** nenhuma. Motorista confirmado vê a rota nova ao abrir os detalhes.

## Arquitetura (abordagem C — PATCH unificado)

Uma nova rota `PATCH /api/trips/[id]` com service role passa a cuidar de **toda** a edição da viagem (local, data, paradas, ida-e-volta) em uma única chamada. `adminUpdateTripBasics` é substituída. Validação de status no servidor, sem mudanças de RLS (`trip_stops` não tem policy de UPDATE/DELETE para admin — motivo de não usar o caminho client-side).

### Nova rota: `src/app/api/trips/[id]/route.ts`

```ts
PATCH /api/trips/[id]
Authorization: Bearer <access_token do admin>

{
  pickup?: GooglePlaceAddress;
  dropoff?: GooglePlaceAddress;
  scheduled_datetime?: string;        // ISO
  stops?: GooglePlaceAddress[];       // lista COMPLETA substituta (vazia = remover todas)
  is_round_trip?: boolean;
  return_datetime?: string | null;    // ISO
}
```

Fluxo no servidor:

1. **Auth:** valida o Bearer token via `auth.getUser(token)` e confere `users.role = 'admin'`. Sem token → 401; não-admin → 403. (O `POST /api/trips` hoje não tem essa checagem; fica fora deste escopo, mas a rota nova já nasce protegida.)
2. Carrega a viagem (com `trip_stops`); inexistente → 404.
3. Se o body tocar em `stops`/`is_round_trip`/`return_datetime` e o status for `started`/`finished`/`cancelled` → 409 ("Paradas e ida e volta não podem ser alteradas após o início da viagem").
4. Valida o **estado final** (valores do body mesclados com os atuais): ida-e-volta ativa exige `return_datetime` → senão 400; `is_round_trip: false` zera `return_datetime`.
5. Insere endereços novos em `addresses` para pickup/dropoff/stops presentes no body (mesmo padrão do POST; endereços antigos não são deletados).
6. `UPDATE trips` com os campos alterados.
7. Substitui paradas (por último): `DELETE trip_stops WHERE trip_id` e `INSERT` da lista nova com `stop_order` 1..n. Se o insert falhar, reinsere as paradas antigas (rollback best-effort, padrão do POST).

### Client: `src/lib/api.ts`

`adminUpdateTripBasics` → renomeada/substituída por `adminUpdateTrip(tripId, updates)`:

- Faz `fetch("/api/trips/" + tripId, { method: "PATCH", ... })` com o access token da sessão Supabase no header.
- Mantém `logAdminAction("Viagem editada", tripId, payload)` após sucesso (comportamento atual preservado).
- Erros da API são lançados com a mensagem pt-BR retornada, exibidos via toast no modal.

### Regras puras: `src/lib/trip-edit.ts`

Funções puras, testáveis com `node:test`:

- `canEditTripRoute(status: TripStatus): boolean` — `false` para `started`/`finished`/`cancelled`, `true` para os demais.
- `validateTripPatch(patch, current)` — regra do retorno obrigatório com ida-e-volta ativa; normaliza `return_datetime = null` quando desativada. Retorna erro em pt-BR ou `null`.
- `buildTripPatchPayload(original, edited)` — diff: inclui apenas campos alterados; `stops` entra completo quando qualquer parada mudou (conteúdo, quantidade ou ordem); retorna `null` se nada mudou.

A rota PATCH e o modal ficam finos por cima dessas funções.

### UI: `src/components/EditTripBasicsModal.tsx`

Abaixo do campo de data/hora:

1. **Paradas no percurso** — lista carregada de `trip.trip_stops` (ordenada por `stop_order`), cada item com `AddressAutocompleteField`, botão remover e setas ↑/↓ para reordenar; botão "+ Adicionar parada".
2. **Ida e volta** — checkbox + campo `datetime-local` "Data/hora retorno" visível quando marcado (obrigatório), espelhando a criação.
3. **Trava de status** — quando `!canEditTripRoute(trip.status)`, os controles de paradas/ida-e-volta ficam desabilitados com o aviso "Paradas e ida e volta não podem ser alteradas após o início da viagem". Embarque/destino/data seguem editáveis.

`handleSave`: `buildTripPatchPayload` → `null` fecha o modal sem chamada; senão `adminUpdateTrip` → toast → `onSaved()` → `onClose()`.

Pré-requisito a verificar na implementação: o fetch da viagem usada pelo `TripDetailModal` já inclui `trip_stops` com `addresses` (o tipo `Trip.trip_stops` existe; confirmar o select).

## Data flow

```
Admin abre "Editar viagem" → modal popula básicos + paradas + ida-e-volta
Admin edita → handleSave → buildTripPatchPayload (diff)
  → null → fecha modal (sem request)
  → payload → adminUpdateTrip → PATCH /api/trips/[id]
      → auth admin → valida status/regras → INSERT addresses
      → UPDATE trips → substitui trip_stops (rollback best-effort)
  → logAdminAction → toast success → onSaved() → refetch
```

## Tratamento de erros

| Caso | Comportamento |
|---|---|
| Ida-e-volta marcada sem retorno | Aviso no campo (UI) e 400 na API |
| Parada em branco | Ignorada na montagem do payload |
| Nada mudou | Modal fecha sem request |
| Token ausente / não-admin | 401 / 403 |
| Viagem inexistente | 404 |
| Viagem iniciada/finalizada/cancelada + mudança de rota | 409 |
| Falha no insert das paradas novas | Reinsere as antigas; 400 com mensagem |
| Erro em qualquer etapa | Toast danger, modal permanece aberto |

Mensagens em pt-BR.

## Testes

**Automatizados (`src/lib/trip-edit.test.ts`, node:test, TDD):**

- `canEditTripRoute`: todos os `TripStatus` (pré-início → `true`; `started`/`finished`/`cancelled` → `false`).
- `validateTripPatch`: ida-e-volta ativa sem retorno → erro; desativação zera retorno; patch sem mudança de rota não valida retorno.
- `buildTripPatchPayload`: sem mudanças → `null`; só datetime; adicionar/remover/reordenar parada → `stops` completo; toggle ida-e-volta.

**Checklist manual (navegador):**

1. Viagem `scheduled`: adicionar 2 paradas, salvar, reabrir → paradas na ordem certa.
2. Reordenar paradas com ↑/↓, salvar → ordem persiste.
3. Remover todas as paradas, salvar → viagem sem paradas.
4. Ativar ida-e-volta sem data de retorno → bloqueado com aviso.
5. Ativar ida-e-volta com retorno, salvar; desativar, salvar → `return_datetime` limpo.
6. Viagem `started`: controles de rota desabilitados com aviso; embarque/data ainda editáveis.
7. Editar só o embarque (sem tocar em paradas) → nenhuma escrita em `trip_stops`.

## SQL

**Nenhum.** A rota usa service role; RLS não muda.

## Fora do escopo

- Notificar cliente/motorista sobre mudança de rota.
- Editar paradas durante a execução (viagem `started`).
- Auth no `POST /api/trips` existente.
- Recalcular preço/proposta por causa da rota nova.
