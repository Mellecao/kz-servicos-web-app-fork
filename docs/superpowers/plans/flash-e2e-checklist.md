# Flash — Checklist manual e2e

**Pré-requisitos:**
- `supabase start` local rodando (ou ambiente staging).
- 3 usuários seed:
  - 1 cliente autenticado no app cliente (`kz-servicos-app-cliente`).
  - 2 motoristas aprovados (`is_approved=true`) autenticados no app prestador (`kz-servicos-app-prestador`).
- Web admin (`kz-servicos-web-app-fork`) rodando (`npm run dev`).
- Ambos apps Flutter buildados em dispositivos/emuladores separados.

**Observação de wiring pendente (Fase 5):** o fluxo `_openSearch()` do app cliente hoje mostra apenas um snackbar quando o usuário escolhe "flash" — a conversão `endereço place_id/coord → address_id (UUID)` e o passo de categoria ainda precisam ser costurados antes que a Task 25 (`FlashDetailsPage`) receba dados reais. Para os cenários abaixo, criar a `trip` Flash diretamente via SQL (`SELECT create_flash_trip(...)` autenticado como cliente) enquanto o wiring não está pronto.

---

## Cenário 1 — Happy path

1. **Cliente**: tap na barra de endereço → escolher "Preciso de uma viagem agora".
   *(temporário: enquanto o wiring está pendente, invocar `create_flash_trip` via SQL como cliente para gerar `trip_id`.)*
2. Preencher pickup + dropoff → categoria → detalhes (1 passageiro) → **Solicitar Flash**.
3. Verificar: cliente vai para tela **"Buscando motoristas"** (`/flash/searching/:tripId`).
4. **Motorista 1**: recebe push `⚡ CORRIDA FLASH!` (Task 12/13 do plano — trigger + edge function).
5. Motorista 1 abre a notificação → cai em `/flash/incoming?tripId=...` (Task 33).
6. Motorista 1 digita **R$ 40** no `FlashPriceInput` → **Enviar proposta** → vai para `/flash/awaiting/:tripId` (Task 34).
7. **Cliente**: proposta aparece como card na tela (ordenada pela mais recente no topo — Task 21).
8. Cliente tap no card → `FlashDriverProfileModal` (Task 24) → **Aceitar proposta** → RPC `client_accept_flash_proposal`.
9. **Motorista 1**: watchTripStatus detecta `awaiting_driver_confirmation` + `driver_profile_id` == mim → auto-navegação para `/flash/recheck/:tripId` (Task 34).
10. Motorista 1: **Iniciar corrida** → RPC `driver_flash_recheck_confirm` → status vira `started` → cai em `/home?activeTripId=...`.
11. Cliente: cubit detecta `status='started'` → estado `FlashSearchingReadyToStart` → navega para `/active-trip?tripId=...`.
12. Ambos ficam na tela de corrida em andamento.

### Assertivas SQL após cenário 1

```sql
SELECT id, status, trip_type, driver_profile_id, final_price
  FROM trips ORDER BY created_at DESC LIMIT 1;
-- esperado: status='started', trip_type='flash', driver_profile_id=<motorista1>, final_price=40

SELECT trip_id, driver_profile_id, status, offered_price, last_push_at
  FROM trip_driver_candidates
  WHERE trip_id = '<uuid-cenário-1>'
  ORDER BY created_at DESC;
-- esperado: motorista1 status='accepted' com offered_price=40; demais candidatos 'rejected' ou 'timed_out'
```

---

## Cenário 2 — Motorista desiste no re-check

1. Repetir passos 1-9 do Cenário 1.
2. **Motorista 1** na `/flash/recheck`: **Desistir** → RPC `driver_flash_recheck_reject`.
3. Motorista 1: candidate.status = `'rejected'` no banco; motorista volta para `/home`.
4. **Cliente**: cubit detecta status voltando para `searching_drivers` (Task 21 — nenhum branch de erro deve ser emitido) → volta ao estado de propostas.
5. Cliente vê snackbar/toast **"O motorista desistiu, buscando novamente"** *(Task 34 do plano: implementar mensagem no cliente ao detectar transição de volta).*
6. **Motorista 2** (se enviou proposta antes): proposta continua visível na lista para o cliente escolher outro.
7. Trigger de redispatch (`redispatch_flash_trip` — Task 10) chama edge function `send-flash-repush` (Task 13) que reenvia push para motoristas online sem candidato ativo.

### Assertivas SQL após cenário 2

```sql
SELECT status, trip_type, driver_profile_id FROM trips WHERE id = '<uuid-cenário-2>';
-- esperado: status='searching_drivers', driver_profile_id=NULL

SELECT driver_profile_id, status, last_push_at FROM trip_driver_candidates
  WHERE trip_id = '<uuid-cenário-2>' ORDER BY created_at DESC;
-- motorista1: status='rejected'; motorista2 (ou novos): 'pending' com last_push_at recente
```

---

## Cenário 3 — Cancelamento pelo cliente

1. Cliente cria Flash (cenário 1 até passo 3 — fica em "Buscando motoristas").
2. Cliente na `/flash/searching`: **Cancelar** → RPC `cancel_flash_trip` (Task 11).
3. Trigger `reject_candidates_when_trip_cancelled` marca todos os candidatos como `rejected`.
4. **Motoristas** com candidate `pending`: `FlashIncomingCallPage` ainda aberto → cliente cancelou; ao tentar enviar proposta, RPC falha com erro tratado. Idealmente, motorista deveria ver toast automático via realtime — se ainda não implementado, aceitar como débito.
5. **Cliente**: cubit detecta `status='cancelled'` → `FlashSearchingCancelled` → navega para `/home`.

### Assertivas SQL após cenário 3

```sql
SELECT status, trip_type, cancelled_at FROM trips WHERE id = '<uuid-cenário-3>';
-- esperado: status='cancelled', cancelled_at IS NOT NULL

SELECT status FROM trip_driver_candidates WHERE trip_id = '<uuid-cenário-3>';
-- esperado: todos 'rejected'
```

---

## Cenário 4 — Admin (web app)

1. Admin loga em `/viagens` no web-app.
2. Aplicar filtro **Flash** (Task 16 — `Efforts/features/admin/pages/viagens/*`).
3. Verificar: corrida do cenário 1 aparece com **badge ⚡ FLASH** (Task 15).
4. Clicar → `TripDetailModal` abre (Task 17):
   - Botão **"Aprovar"** NÃO aparece.
   - Botão **"Selecionar motorista"** NÃO aparece.
   - Botão **"Cancelar (emergência)"** aparece.
5. Clicar "Cancelar (emergência)" → RPC `cancel_flash_trip` executa com sucesso.

### Assertivas SQL após cenário 4

```sql
SELECT status, cancelled_at, cancelled_by FROM trips WHERE id = '<uuid-cenário-4>';
-- esperado: status='cancelled', cancelled_by=<admin_user_id>
```

---

## Cenário 5 — Dispatch racing (concorrência)

1. Cliente cria Flash Task 11.
2. **Motorista 1** e **Motorista 2** enviam propostas quase simultaneamente (dentro de 500ms) via RPC `driver_send_flash_proposal`.
3. Ambas propostas aparecem no cliente (Task 21).
4. **Cliente**: aceita a proposta do **Motorista 1** primeiro → RPC `client_accept_flash_proposal` (Task 8).
5. Trigger da RPC seta `trips.status='awaiting_driver_confirmation'` + `driver_profile_id=motorista1`.
6. **Segundo aceite** (hipotético — cliente tenta clicar no card do motorista 2 antes da UI atualizar) → RPC deve falhar com erro `"Corrida não está mais buscando"` (guard-clause verificando `status='searching_drivers'` — Task 8).
7. **Motorista 2**: watchTripStatus detecta `awaiting_driver_confirmation` mas `driver_profile_id != mim` → snackbar **"Cliente escolheu outro motorista"** + navegação para `/home` (Task 34).

### Assertivas SQL após cenário 5

```sql
SELECT status, driver_profile_id FROM trips WHERE id = '<uuid-cenário-5>';
-- esperado: status='awaiting_driver_confirmation' ou posterior, driver_profile_id=<motorista1>

SELECT driver_profile_id, status FROM trip_driver_candidates
  WHERE trip_id = '<uuid-cenário-5>' ORDER BY created_at ASC;
-- motorista1: 'accepted'; motorista2: 'accepted' (ambos enviaram) mas trips.driver_profile_id só aponta pra 1
```

---

## Regressão — cenários standard não devem quebrar

Após cada execução Flash, rodar um fluxo **standard** (trip_type default) end-to-end no app cliente para garantir que:

- `TripTypeChoiceSheet` no `_openSearch` do cliente permite escolher "scheduled" e cai no fluxo antigo intacto.
- `_showTripTypePicker` (round-trip / one-way) continua funcionando após a escolha `scheduled`.
- Push `type='trip_request'` (não-flash) ainda roteia para `/home?tripRequestId=...` no prestador (Task 31 não regrediu a fallback).
- `TripData.fromMap` com map sem `trip_type` retorna `tripType='standard'` e `isFlash=false` (coberto por teste unitário — Task 29).

---

## Bugs conhecidos / débitos a fechar antes de GA

- **Wiring de endereços no cliente (Fase 5, Task 27):** entrada Flash no `_openSearch` só sinaliza snackbar. Requer converter place_id/coord → `addresses.id` (UUID) esperado por `create_flash_trip`, e integrar seleção de categoria antes da navegação para `/flash/details`.
- **App cliente — snackbar de redispatch:** cubit `FlashSearchingCubit` observa status voltando de `awaiting_driver_confirmation` para `searching_drivers`, mas não emite mensagem informativa "O motorista desistiu, buscando novamente" (útil para cenário 2).
- **Prestador — resposta a cancelamento remoto:** quando o cliente cancela enquanto motorista está em `FlashIncomingCallPage`, não há realtime observando `trips.status` naquela página; motorista descobre só ao tentar enviar proposta e falhar.

---

## Execução

- [ ] Cenário 1 — Happy path
- [ ] Cenário 2 — Motorista desiste no re-check
- [ ] Cenário 3 — Cancelamento pelo cliente
- [ ] Cenário 4 — Admin
- [ ] Cenário 5 — Dispatch racing
- [ ] Regressão standard
- [ ] Registrar bugs encontrados em `docs/superpowers/plans/flash-e2e-bugs.md` (criar sob demanda)
