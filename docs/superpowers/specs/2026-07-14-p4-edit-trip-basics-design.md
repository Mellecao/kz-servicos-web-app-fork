# P4 — Editar viagem em qualquer status (endereço + data/hora)

**Data:** 2026-07-14
**Status:** Aprovado para implementação

## Problema

Hoje o `TripDetailModal.tsx` mostra endereço de embarque, endereço de destino e data/hora como somente-leitura (`InfoRow`). Não existe UI de edição em nenhum status. O admin precisa poder editar esses três campos em qualquer status (open, under_review, searching_drivers, awaiting_client_confirmation, awaiting_driver_confirmation, scheduled, started, finished, cancelled — sim, mesmo em finished/cancelled, se ele quiser corrigir histórico).

Escopo restrito: **apenas endereço de embarque, endereço de destino e data/hora**. Motorista fica fora (implica notificar/invalidar candidatos, ciclo separado).

## Design

### Nova função em `src/lib/api.ts`

```ts
export async function adminUpdateTripBasics(
  tripId: string,
  updates: {
    pickup?: GooglePlaceAddress;
    dropoff?: GooglePlaceAddress;
    scheduled_datetime?: string;
  },
): Promise<void>;
```

**Implementação:**
1. Se `pickup` presente, faz `INSERT addresses ...` e armazena `pickup_address_id`.
2. Idem para `dropoff` → `dropoff_address_id`.
3. Monta payload de update contendo apenas o que mudou (address ids + `scheduled_datetime`).
4. Se payload não vazio: `UPDATE trips SET ... WHERE id = ?`.
5. `logAdminAction('Viagem editada', tripId, payload)`.

### Novo componente: `EditTripBasicsModal`

**Arquivo:** `src/components/EditTripBasicsModal.tsx`

Client component. Props:
```ts
interface Props {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}
```

Interno:
- Estados `pickup`, `dropoff`, `scheduledDatetime`, `originalPickup`, `originalDropoff`, `originalDatetime`.
- Popula no `useEffect(open, trip)` a partir de `trip.pickup_address`, `trip.dropoff_address`, `trip.scheduled_datetime` (converter ISO → formato `datetime-local`).
- Renderiza dentro de `<Modal>` (reusa componente existente):
  - `<AddressAutocompleteField label="Embarque" value={pickup} onChange={setPickup} />`
  - `<AddressAutocompleteField label="Destino" value={dropoff} onChange={setDropoff} />`
  - `<input type="datetime-local" value={scheduledDatetime} onChange={...} />`
  - Footer: botões Cancelar e Salvar.
- `handleSave`: computa diff (só passa campos que mudaram), chama `adminUpdateTripBasics`, toast success, `onSaved()`, `onClose()`.

Reuso: `AddressAutocompleteField` já foi criado em P5.

### Alteração em `TripDetailModal.tsx`

Adicionar botão "Editar viagem" próximo ao header ou logo antes do bloco de InfoRows. Visível em qualquer status.

Ao clicar: `setEditModalOpen(true)`.

Renderizar `<EditTripBasicsModal trip={t} open={editModalOpen} onClose={() => setEditModalOpen(false)} onSaved={onUpdate} />`.

`onUpdate` já existe como prop do TripDetailModal e refetch a trip (padrão dos outros handlers do arquivo).

## Data flow

```
Admin clica "Editar viagem" →
  EditTripBasicsModal abre com valores atuais
Admin altera pickup / dropoff / datetime →
  handleSave → diff → adminUpdateTripBasics
    → INSERT novos addresses se pickup/dropoff mudou
    → UPDATE trips com novos ids/datetime
  → toast success → onSaved() (= TripDetailModal.onUpdate) → refetch
```

## Edge cases cobertos

- Nenhum campo alterado → botão Salvar chama diff vazio → não faz UPDATE, só fecha modal.
- Somente datetime mudou → UPDATE apenas do campo, sem INSERT em addresses.
- Address antigo não é deletado (pode estar em uso por outras trips ou histórico).
- Erro no save → toast danger, modal permanece aberto.
- Trip null (segurança) → modal não renderiza corpo.

## Testes

**Automatizados:** nenhum.

### Checklist manual

1. Abrir uma trip com status `scheduled`. Clicar "Editar viagem". Mudar endereço de embarque. Salvar. Modal fecha, InfoRow atualiza para novo endereço.
2. Repetir com trip status `finished` — deve funcionar igual (permite corrigir histórico).
3. Editar apenas data/hora sem mexer nos endereços. Salvar. Só datetime muda.
4. Abrir edit, não mudar nada, salvar. Modal fecha, nenhuma request de update.
5. Endereço mudado no `AddressAutocompleteField` mostra botão Limpar. Limpar não deveria ser aceito no save (endereço obrigatório) — validar no `handleSave`.

## SQL

**Nenhum.** RLS de admin já permite UPDATE em trips (`20260410120024_create_rls_policies.sql:244`).

## Fora do escopo

- Editar motorista, paradas, passageiros, malas, observações, cliente, categoria, preços, ida-e-volta.
- Notificar cliente/motorista sobre mudança.
- Auditoria detalhada além do `logAdminAction` já existente.
