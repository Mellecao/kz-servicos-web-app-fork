# Subprojeto 2B — Escolha seu Motorista — Checklist manual e2e

**Pré-requisitos:**
- 3 migrations aplicadas (`20260729210453+`) via MCP.
- App admin rodando (`npm run dev`).
- App cliente + prestador Flutter buildados em 2 devices/emuladores.
- 1 cliente autenticado; 2 motoristas aprovados no prestador; 1 admin.

---

## Cenário 1 — Cliente escolhe e envia (happy path)

1. Cliente: barra de endereço → Corrida Agendada → **Escolha seu motorista**.
2. Picker (endereços + detalhes) → tela `DriverSelectionPage`.
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
3. Vê "R$ 40,00" + botões Recusar/Confirmar.
4. Tap **Confirmar corrida** → RPC → navega para `/active-trip?tripId=<uuid>`.

### SQL
```sql
SELECT status, final_price FROM trips WHERE id='<uuid>';
```
Esperado: `scheduled`, `final_price=40.00`.

---

## Cenário 4 — Motorista recusa

1. Cliente cria nova solicitação (Cenário 1).
2. Motorista 1: tap **Recusar** → RPC → card some.
3. Cliente: push "Motorista indisponível" → snackbar + volta para `/`.

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
3. Se tentar direto via SQL → RPC lança `'Voce ja tem uma solicitacao pendente'`.

---

## Cenário 7 — Admin badge + filtro + cancelamento emergência

1. Admin abre `/viagens`.
2. Dropdown filtro tem opção **👤 Escolha Motorista**.
3. Trips do Cenário 1/2 aparecem com badge **👤 ESCOLHA MOTORISTA** (roxo).
4. Clicar card → modal abre → nota "Escolha seu Motorista — cliente selecionou motorista diretamente" + botão **Cancelar (emergência)**.
5. Botões Editar/forward/back estão OCULTOS (isAdminReadOnly).
6. Cancelar → prompt de motivo → RPC → trip `cancelled`.

---

## Cenário 8 — Cliente recusa preço

1. Até Cenário 3 passo 3 (na `PriceOfferReviewPage` com preço proposto).
2. Cliente tap **Recusar preço** → RPC → volta para `/`.
3. Motorista: candidate volta para `rejected`.

### SQL
```sql
SELECT status FROM trips WHERE id='<uuid>';
```
Esperado: `searching_drivers`, driver_profile_id NULL.

---

## Cenário 9 — Sub-sheet mostra 3 opções

1. Cliente: barra endereço → Corrida Agendada.
2. Sub-sheet mostra: 💰 Cotação + 👤 Escolha seu motorista + 💬 Falar com Akira.
3. Todas as 3 opções são clicáveis (Cotação depende do horário/override).

---

## Regressão

- [ ] Flash: fluxo Cenário 1-5 do `flash-e2e-checklist.md` intacto.
- [ ] Cotação (2A): opção continua funcionando, cria trip `scheduled_quote`.
- [ ] Push type `trip_request` (standard) ainda roteia normalmente.
- [ ] Advisor Supabase limpo (só WARN esperado sobre SECURITY DEFINER).

---

## Débitos identificados

- [ ] `ActiveRequestBanner` criado mas NÃO integrado no `trip_home_page` build (arquivo pronto para uso; requer refactor separado do build method complexo).
- [ ] `TripDetailModal` do admin: mostrar detalhes ricos do candidato (nome motorista, preço proposto, status detalhado) — hoje só tem o botão cancelar. Requer query adicional de `trip_driver_candidates` + `driver_profiles`.
- [ ] Chat prévio antes de solicitar — chat só após aceite (decisão consciente).
- [ ] Timeout server-side para requests pendentes (cron futuro).
- [ ] Múltiplas solicitações paralelas — V1 é só 1 pendente por vez.
- [ ] Contra-proposta de preço pelo cliente.
- [ ] Ranking/ordenação da lista de motoristas (rating, proximidade).
- [ ] Filtro por categoria de veículo.
- [ ] Ocultação persistente de motoristas que recusaram.
- [ ] Notif ao cliente se ninguém aceitar em X min.
- [ ] Edge function `send-fcm-push` deve reconhecer `type='scheduled_direct_request'` e formatar título "📅 NOVA SOLICITAÇÃO DE AGENDAMENTO" — verificar durante e2e; se push chegar sem título específico, atualizar edge function.

---

## Execução

- [ ] Cenário 1 — Happy path envio
- [ ] Cenário 2 — Aceite com preço
- [ ] Cenário 3 — Cliente confirma preço
- [ ] Cenário 4 — Motorista recusa
- [ ] Cenário 5 — Cliente cancela pendente
- [ ] Cenário 6 — Guard 1-pendente
- [ ] Cenário 7 — Admin badge + filtro + cancel emergência
- [ ] Cenário 8 — Cliente recusa preço
- [ ] Cenário 9 — Sub-sheet 3 opções
- [ ] Regressão
- [ ] Registrar bugs em `docs/superpowers/plans/subprojeto-2b-e2e-bugs.md`
