# Progresso da sessão — 2026-07-14

Este documento é o retrato completo da sessão de desenvolvimento em que atacamos **8 problemas** do painel admin da KZ (P1..P8). Serve como handoff para continuar de onde paramos.

**Ordem de execução acordada (do que destrava mais primeiro, considerando dependências):**

1. P2 — Bug PWA (crítico)
2. P1 — Deep-link de push
3. P5 — Endereço Casa/Trabalho do cliente
4. P6 — Autocomplete inteligente em Nova Viagem
5. P8 — Histórico + contadores do cliente
6. P4 — Editar viagem em qualquer status
7. **P7 — Cancelamento com aprovação (IMPLEMENTADO, AGUARDA DEPLOY/TESTE E2E)**
8. **P3 — Sistema de Chat (IMPLEMENTADO, AGUARDA SQL/DEPLOY/TESTE E2E)**

---

## Sumário executivo

| # | Problema | Status | SQL? | Arquivos alterados/criados | Débitos |
|---|---|---|---|---|---|
| P2 | Bug do PWA no iPhone (corridas somem) | ✅ Implementado | Nenhum | 1 novo + 2 modificados | Teste no iPhone real |
| P1 | Click em push admin não abre corrida | ✅ Implementado | Nenhum | 3 modificados | **Redeploy do edge function** + teste |
| P5 | Salvar Casa/Trabalho no cliente | ✅ Implementado + fallback da listagem | **Sim (migration ausente no remoto)** | 2 novos + 2 modificados | Aplicar SQL corretivo + teste manual |
| P6 | Autocomplete inteligente | ✅ Implementado | Nenhum | 2 novos + 3 modificados | Teste manual |
| P8 | Histórico + contadores do cliente | ✅ Implementado | Nenhum | 2 novos + 3 modificados | Teste manual |
| P4 | Editar viagem em qualquer status | ✅ Implementado (escopo reduzido) | Nenhum | 1 novo + 2 modificados | Teste manual; **motorista fica fora de escopo desta iteração** |
| P7 | Cancelamento com aprovação do admin | ✅ Implementado (web + SQL + Flutter) | **Sim (nova tabela)** | 12 web/backend + 8 Flutter | Aplicar migration, redeploy FCM/OneSignal e teste E2E |
| P3 | Sistema de Chat cross-app | ✅ Implementado (web + SQL + Flutter) | **Sim (2 tabelas)** | 10 web/backend + 9 Flutter | Aplicar SQL, redeploy FCM/OneSignal e teste E2E |

**Progresso: 8/8 features implementadas (código) + 8 specs + 7 plans em `docs/superpowers/`.**

---

## Políticas acordadas para a sessão inteira

- **Commits:** Nenhum commit feito. Usuário quer commitar tudo no final, agrupando à mão.
- **Testes:** P7 e P3 adicionaram testes Flutter. A suíte completa passou com 134 testes e `flutter analyze` sem issues. Validação manual no iPhone real continua no backlog.
- **Deploy de Edge Functions:** `send-admin-onesignal-push` e `send-fcm-push` precisam de redeploy para publicar os novos deep-links e eventos.
- **SQL:** P5 possui um SQL corretivo porque `user_saved_addresses` está ausente no remoto. P7 e P3 possuem migrations, versões up-only separadas e um SQL completo único para o SQL Editor. Esses scripts não corrigem a tabela de histórico de migrations.

---

## Arquivos gerados/modificados na sessão

### Arquivos novos

**Componentes React:**
- `src/components/RequireAuth.tsx` (P2)
- `src/components/AddressAutocompleteField.tsx` (P5)
- `src/components/AddressAutocompleteWithSuggestions.tsx` (P6)
- `src/components/ClientTripHistoryModal.tsx` (P8)
- `src/components/EditTripBasicsModal.tsx` (P4)

**Bibliotecas:**
- `src/lib/user-saved-addresses.ts` (P6 — helper compartilhado)
- `src/lib/client-metrics.ts` (P8)

**Docs — specs (7):**
- `docs/superpowers/specs/2026-07-14-p2-pwa-auth-guard-design.md`
- `docs/superpowers/specs/2026-07-14-p1-push-deeplink-design.md`
- `docs/superpowers/specs/2026-07-14-p5-client-home-address-design.md`
- `docs/superpowers/specs/2026-07-14-p6-smart-autocomplete-design.md`
- `docs/superpowers/specs/2026-07-14-p8-client-history-metrics-design.md`
- `docs/superpowers/specs/2026-07-14-p4-edit-trip-basics-design.md`
- `docs/superpowers/specs/2026-07-14-p7-trip-cancellation-approval-design.md`

**Docs — plans (6, P4 pulou o plan separado):**
- `docs/superpowers/plans/2026-07-14-p2-pwa-auth-guard.md`
- `docs/superpowers/plans/2026-07-14-p1-push-deeplink.md`
- `docs/superpowers/plans/2026-07-14-p5-client-home-address.md`
- `docs/superpowers/plans/2026-07-14-p6-smart-autocomplete.md`
- `docs/superpowers/plans/2026-07-14-p8-client-history-metrics.md`
- `docs/superpowers/plans/2026-07-14-p7-trip-cancellation-approval.md`

**Banco e Flutter (P7):**
- `supabase/sql/20260715_fix_client_saved_addresses_up.sql` (P5)
- `supabase/migrations/20260714120000_trip_cancellation_requests.sql`
- `supabase/sql/20260714_p7_trip_cancellation_requests_up.sql`
- `C:\Projetos\kz-servicos-app-prestador\lib\core\services\trip_cancellation_service.dart`
- `C:\Projetos\kz-servicos-app-prestador\test\core\services\trip_cancellation_service_test.dart`

**P3 — Chat de suporte:**
- `docs/superpowers/specs/2026-07-14-p3-support-chat-design.md`
- `docs/superpowers/plans/2026-07-14-p3-support-chat.md`
- `supabase/migrations/20260714130000_support_chat.sql`
- `supabase/sql/20260714_p3_support_chat_up.sql`
- `supabase/sql/20260715_p7_p3_complete_up.sql`
- `src/app/(dashboard)/chats/page.tsx`
- `src/app/(dashboard)/chats/[providerId]/page.tsx`
- `C:\Projetos\kz-servicos-app-prestador\lib\core\services\support_chat_service.dart`
- `C:\Projetos\kz-servicos-app-prestador\lib\features\chat\presentation\pages\support_chat_page.dart`
- `C:\Projetos\kz-servicos-app-prestador\test\core\services\support_chat_service_test.dart`

### Arquivos modificados nesta sessão

- `src/app/(dashboard)/layout.tsx` (P2)
- `src/components/MobilePushPermissionGuide.tsx` (P2)
- `src/app/api/admin-notifications/onesignal/route.ts` (P1)
- `src/components/OneSignalInitializer.tsx` (P1)
- `supabase/functions/send-admin-onesignal-push/index.ts` (P1)
- `src/components/forms/NovoClienteForm.tsx` (P5 e P6)
- `src/lib/api.ts` (P5, P6, P8, P4 — 6 novas funções ao todo)
- `src/components/forms/NovaViagemForm.tsx` (P6)
- `src/types/database.ts` (P8 — 2 novos tipos)
- `src/app/(dashboard)/clientes/page.tsx` (P8)
- `src/components/TripDetailModal.tsx` (P4)
- `src/components/TripDetailModal.tsx` (P7 — revisão e Realtime)
- `supabase/functions/send-fcm-push/index.ts` (P7)
- `src/types/database.ts` (P3)
- `src/lib/api.ts` (P3)
- `src/components/Sidebar.tsx` (P3)
- `src/components/MobileNav.tsx` (P3)
- `supabase/functions/send-fcm-push/index.ts` (P3)

**App Flutter modificado no P7:**
- `lib/features/trip/presentation/pages/active_trip_page.dart`
- `lib/features/trip/presentation/widgets/active_trip_panels.dart`
- `lib/features/trip/presentation/widgets/cancel_trip_sheet.dart`
- `lib/core/services/push_notification_service.dart`
- `test/features/trip/widgets/active_trip_panels_test.dart`
- `test/core/services/push_notification_service_test.dart`

**App Flutter modificado no P3:**
- `lib/routes/app_router.dart`
- `lib/core/services/push_notification_service.dart`
- `lib/core/widgets/provider_bottom_nav.dart`
- `lib/features/trip/presentation/pages/active_trip_page.dart`
- `lib/features/trip/presentation/widgets/active_trip_panels.dart`
- `lib/features/schedules/presentation/pages/schedule_detail_page.dart`
- `test/features/trip/widgets/active_trip_panels_test.dart`
- `test/core/widgets/provider_bottom_nav_test.dart`
- `test/core/services/push_notification_service_test.dart`

> **Nota:** o `git status` do início da sessão já mostrava vários outros arquivos como `M` (KanbanBoard.tsx, api/trips/route.ts, viagens/page.tsx, AdminNotificationsButton.tsx, .gitignore, etc). Esses não foram tocados por esta sessão — são mudanças preexistentes do usuário. Na hora de commitar, é importante separar os grupos.

---

# Detalhes por problema

## P2 — Bug do PWA no iPhone (crítico)

### Problema original do usuário
> "Ao entrar no painel adm pelo mobile (navegador) (iphone), clicar em 'compartilhar' e 'adicionar a tela de início' (para habilitar o push de notificações) o painel buga regularmente, sumindo todas as corridas. Só volta ao normal quando o usuário faz 'logoff' e loga novamente."

### Causa raiz identificada
Duas condições combinadas:
1. **`src/lib/supabase.ts:6`** usa `createClient(url, anonKey)` sem opções → sessão persiste em `localStorage` puro.
2. **`src/app/(dashboard)/layout.tsx`** não tinha guard de rota. `AuthProvider` só carregava a sessão sem redirecionar quando `null`.

**Sequência do bug:** iOS Safari abre o PWA em contexto isolado de storage → `localStorage` vem vazio → `getSession()` retorna `null` → dashboard renderiza mesmo assim → `fetchTrips()` sem JWT → RLS bloqueia → array vazio.

Transferir sessão entre Safari e PWA no iOS não é possível (restrição do sistema). A correção certa é forçar login quando não há sessão.

### Implementação
- **Criado `src/components/RequireAuth.tsx`:** client component que usa `useAuth()`. Se `loading` → loader; se `!loading && !session` → `router.replace('/login')` + `return null`; caso contrário → children.
- **Modificado `src/app/(dashboard)/layout.tsx`:** envolveu todo o conteúdo (Sidebar, Nav, OneSignalInitializer, AdminNotificationsButton, MobilePushPermissionGuide e children) com `<RequireAuth>` dentro do `AuthProvider` e `ToastProvider`.
- **Modificado `src/components/MobilePushPermissionGuide.tsx` (linhas 104-109):** dentro do bloco iOS + não-standalone, adicionou segundo parágrafo: *"Ao abrir o app pelo ícone pela primeira vez, será necessário fazer login novamente — o iPhone isola os dados do app instalado do navegador, não é um bug."*

### Verificado
- `npm run lint` em cada arquivo alterado
- `npm run build` (Next 16.2.3 + Turbopack) passou

### Débito
- Teste manual no iPhone real: instalar PWA, abrir pelo ícone → esperado ir para /login sem ficar preso em dashboard vazio.
- Após login no PWA, corridas devem carregar. Fechar e reabrir → sessão persiste.

### SQL
Nenhum.

---

## P1 — Click em push admin não abre corrida específica

### Problema original do usuário
> "Quando uma notificação push chega via mobile, ao clicar na notificação o usuário deve ser redirecionado para a tela 'viagens' com a corrida em assunto da notificação aberta (card de detalhes aberto). Atualmente, ao clicar na notificação isso não acontece."

### Causa raiz identificada
Duas coisas combinadas:
1. **Payload sem query param na URL.** `supabase/functions/send-admin-onesignal-push/index.ts:123` e `src/app/api/admin-notifications/onesignal/route.ts:81` mandavam `url: notification.link ?? undefined`. O `notification.link` é sempre `/viagens` (sem `?openTrip=<id>`). O `trip_id` estava em `data.reference_id` mas o handler default do OneSignal não lê essa metadata.
2. **Nenhum listener de click.** `OneSignalInitializer.tsx` inicializava o SDK com `notificationClickHandlerAction: "focus"` e nunca chamava `OneSignal.Notifications.addEventListener("click", ...)`. Com app aberto, click não navega.

Já existia `src/lib/admin-notification-navigation.ts` com `buildAdminNotificationHref()` — usada no inbox in-app mas não no fluxo de push. A página `/viagens` já lê `searchParams.get("openTrip")` (linha 94) e abre modal.

### Implementação
Abordagem escolhida: **Client + Server** (belt and suspenders, para cobrir iOS PWA aberto).

- **`src/app/api/admin-notifications/onesignal/route.ts`:**
  - Importou `buildAdminNotificationHref` de `@/lib/admin-notification-navigation`.
  - Trocou linha 81: `url: buildAdminNotificationHref(notification) ?? undefined`.

- **`supabase/functions/send-admin-onesignal-push/index.ts`:**
  - Adicionou função helper inline (Deno não importa de `src/`), com comentário `// keep in sync with src/lib/admin-notification-navigation.ts`.
  - Trocou linha 123 pela chamada do helper local.

- **`src/components/OneSignalInitializer.tsx`:**
  - Estendeu type `OneSignalSDK` com `Notifications.addEventListener/removeEventListener`.
  - Novo type `OneSignalNotificationClickEvent`.
  - Import de `useRouter` de `next/navigation` e `buildAdminNotificationHref`.
  - Adicionou `const router = useRouter()` no topo do componente.
  - Novo `useEffect` que registra listener de click: lê `event.notification.additionalData`, chama `buildAdminNotificationHref` e `router.push(href)`. Cleanup remove listener no unmount.

### Verificado
- Lint OK em cada arquivo.
- Build passa.

### Débito
- ⚠️ **REDEPLOY OBRIGATÓRIO do edge function** para as mudanças no server valerem: `supabase functions deploy send-admin-onesignal-push`.
- Teste manual: gerar admin notification (mover uma corrida no board), clicar na push com app fechado → deve abrir `/viagens?openTrip=<id>` com modal; com app aberto → deve navegar (não só focar).

### SQL
Nenhum.

---

## P5 — Salvar endereço Casa e Trabalho no perfil do cliente

### Problema original do usuário
> "Na tela 'Clientes', ao clicar sobre um cliente, deve ser possível salvar o endereço da 'Casa' do cliente. Deve ser um field com autocomplete igual no 'Nova viagem' e esse endereço deve ficar salvo no perfil daquele cliente."

Escopo estendido durante o brainstorm: incluir **Trabalho também** (usuário concordou, dado que o schema já suporta).

### Descoberta
A infraestrutura existia no repositório, mas não no banco remoto:
- Migração `supabase/migrations/20260618170000_create_user_saved_addresses.sql` define `user_saved_addresses(user_id, address_id, label)` com constraint único parcial em `(user_id, label) WHERE label IN ('home','work')`.
- Em 2026-07-15, a REST API remota confirmou `users = 200` e `user_saved_addresses = 404`.
- RLS admin-friendly.
- `fetchClients` já traz `user_saved_addresses(*, addresses(*))` embutido.
- `SavedAddressesSummary` já exibe Home/Work no card.
- `useGooglePlacesAutocomplete()` + `SearchableSelect` já reutilizáveis.

Só faltava UI de edição e funções para persistir.

### Implementação
- **Criado `src/components/AddressAutocompleteField.tsx`:** componente reutilizável (SearchableSelect + Google Places + botão "Limpar"). Props: `label, placeholder, value: GooglePlaceAddress | null, onChange, disabled`.

- **`src/lib/api.ts`:** adicionadas 3 funções após `createAddress`:
  - `fetchUserSavedAddresses(userId)` — SELECT com join
  - `saveUserSavedAddress(userId, label, address)` — INSERT novo `addresses` + UPSERT `user_saved_addresses` (via SELECT + INSERT/UPDATE, mais previsível que ON CONFLICT em índice parcial)
  - `removeUserSavedAddress(userId, label)` — DELETE
  - `fetchClients()` agora repete a consulta somente em `users` quando o join de Casa/Trabalho falha, impedindo que dados complementares esvaziem a lista.

- **`src/app/(dashboard)/clientes/page.tsx`:** falhas da consulta principal agora exibem um estado de erro com nova tentativa, em vez de "Nenhum cliente encontrado".

- **`src/components/forms/NovoClienteForm.tsx`:**
  - Novos imports (AddressAutocompleteField, funções de saved_addresses, GooglePlaceAddress, UserSavedAddress)
  - Helper local `extractSavedAddress` (depois movido para módulo compartilhado em P6)
  - Helper local `isSameAddress` (compara por `google_place_id` com fallback pra `formatted_address`)
  - 4 estados novos: `homeAddress, workAddress, originalHomeAddress, originalWorkAddress`
  - `useEffect(open, client)` populava os 4 no abrir
  - `resetForm()` zerava os 4
  - `handleSubmit` faz diff e chama save/remove só quando mudou
  - JSX adiciona 2 seções Home/Work condicionalmente ao `isEditing`

### Comportamento resultante
- Cliente **novo**: campos Home/Work não aparecem (só em modo edição — spec explícito).
- Cliente **existente**: campos populados com o que já tinha salvo. Diff detecta mudanças; salva incremental. Botão "Limpar" remove o vínculo (sem apagar o `addresses` que pode estar em uso por trips).

### Verificado
- Lint direcionado + build Next 16.2.3 OK após o fallback.

### Débito
- Teste manual: editar cliente, adicionar Casa/Trabalho, salvar, reabrir e confirmar. Testar Limpar. Testar edição sem tocar endereços (não deve gerar requests).

### SQL
Executar `supabase/sql/20260715_fix_client_saved_addresses_up.sql` para criar a tabela, índices, RLS, grants e trigger de `updated_at` que estão ausentes no remoto.

---

## P6 — Autocomplete inteligente em Nova Viagem

### Problema original do usuário
> "Ao clicar em 'Nova viagem' e selecionar um cliente, ao clicar no field 'Local de embarque', antes do usuário digitar algum caractere, o autocomplete deve ser: (em primeiro) endereço salvo da 'Casa' do cliente, e depois os últimos 4 locais de embarque que aquele cliente já teve viagens. Quando o admin digitar 1+ caractere, esses campos somem e dão lugar ao autocomplete normal. Se apagar, voltam. Se clicar fora, somem."

Regras confirmadas em brainstorm:
- Ambos os campos (embarque e destino) mostram **Casa + Trabalho + últimos 4 do histórico**.
- Histórico específico do campo (pickup para embarque, dropoff para destino).
- Últimas 4 corridas filtrando `status ≠ 'cancelled'`.

### Implementação
- **Refactor pequeno:** movido `extractSavedAddress` de `NovoClienteForm.tsx` para novo módulo `src/lib/user-saved-addresses.ts` para reuso em `NovaViagemForm`.

- **`src/lib/api.ts`:** adicionada `fetchClientAddressHistory(clientId, field, limit=4)`:
  - Query: `SELECT trips com join addresses WHERE client_id = ? AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 20`.
  - Extrai `pickup_address` ou `dropoff_address` (que vem como array pelo Supabase, ajustado com `Array.isArray(rawUnknown) ? rawUnknown[0] : rawUnknown` — corrigido durante build).
  - Dedupe por `google_place_id` (fallback `formatted_address`). Retorna primeiros `limit`.

- **Criado `src/components/AddressAutocompleteWithSuggestions.tsx`:**
  - Props: `label, placeholder, value, onChange, error, homeAddress, workAddress, historyAddresses`.
  - Usa `useGooglePlacesAutocomplete` internamente + estado local `searchQuery`.
  - Chaves sintéticas: `__home__`, `__work__`, `__hist_<i>__`.
  - Se `searchQuery` vazio → options = suggestions (com dedupe: se Casa/Trabalho batem com histórico, histórico é filtrado). Labels dos suggestions: `🏠 Casa · <endereço>`, `💼 Trabalho · <endereço>`, ou apenas o endereço para histórico.
  - Se digitou → options = `places.options` (Google).
  - `onChange` do SearchableSelect diferencia entre chave sintética (usa endereço já em memória) e `google_place_id` real (chama `fetchGooglePlaceDetails`).

- **`src/components/forms/NovaViagemForm.tsx`:**
  - Imports novos: `useMemo`, `AddressAutocompleteWithSuggestions`, `fetchClientAddressHistory`, `extractSavedAddress`.
  - Novos estados: `pickupHistory`, `dropoffHistory`.
  - `useMemo` para `selectedClient`, `homeAddress`, `workAddress` derivados do cliente atual.
  - `useEffect(clientId)` fetcha os dois históricos em paralelo com flag `cancelled` para evitar race.
  - `resetForm` zera os históricos.
  - **Removidos** `pickupPlaces`, `dropoffPlaces`, `pickupDetailsSeqRef`, `dropoffDetailsSeqRef` (código morto após substituir os SearchableSelect).
  - Substituiu os 2 blocos `<div><label>Endereço de embarque/desembarque</label><SearchableSelect ... /></div>` por `<AddressAutocompleteWithSuggestions ... />`.
  - `useGooglePlacesAutocomplete` e `fetchGooglePlaceDetails` ainda são usados pelo `StopAddressField` (subcomponente para paradas intermediárias) — não mexemos.

### Comportamento resultante
- Selecionar cliente → históricos carregam em background.
- Focar em Embarque/Destino sem digitar → dropdown mostra 🏠 Casa, 💼 Trabalho, e até 4 endereços do histórico.
- Digitar → sugestões somem, Google Places assume.
- Apagar → sugestões voltam.

### Verificado
- Lint OK em todos.
- **Build falhou 1x** por cast de `Address` no `fetchClientAddressHistory` (`row.pickup_address` vem como array pelo Supabase). Corrigido usando `Array.isArray(x) ? x[0] : x` — buildou depois.

### Débito
- Teste manual: cliente A com Casa/Trabalho e sem histórico, cliente B sem esses mas com histórico rico, verificar dedupe, verificar troca de cliente com dropdown aberto.

### SQL
Nenhum.

---

## P8 — Histórico e contadores no detalhe do cliente

### Problema original do usuário
> "Na tela 'clientes', ao clicar sobre um cliente deve aparecer um histórico detalhado das corridas do cliente, ao clicar sobre uma corrida do histórico deve ser possível ver ainda mais detalhes da corrida. Além disso, deve aparecer contadores de viagens realizadas, canceladas e etc (igual funciona nos detalhes no painel 'motoristas')."

Escolhas confirmadas em brainstorm:
- **Contadores:** Realizadas (finished), Canceladas (cancelled), **Total gasto** (soma final_price/estimated_price), **Avaliação média** (motoristas → cliente, via `rated_id = clientId`).
- **Trigger:** clicar no nome do cliente no card/tabela.

### Implementação (baseada no padrão de Motoristas)
- **`src/types/database.ts`:** adicionadas interfaces `ClientMetrics` e `ClientTripHistoryEntry` logo após as análogas de Driver.

- **Criado `src/lib/client-metrics.ts`:**
  - Reutiliza `getDriverMetricPeriodRange` para não duplicar cálculo de datas.
  - `buildClientMetrics(input)` — filtra trips por `client_id` e range, calcula finished/cancelled/totalSpent/averageRating. `totalSpent` usa `final_price ?? estimated_price ?? 0` para finished.

- **`src/lib/api.ts`:**
  - Novo import `buildClientMetrics, getClientMetricPeriodRange`.
  - Types importados: `ClientMetrics, ClientTripHistoryEntry`.
  - Nova função `fetchClientPerformance(clientId, period)`:
    - Duas queries em paralelo (trips com joins + ratings onde `rated_id = clientId`).
    - Chama `buildClientMetrics` para computar.
    - Agrupa ratings por `trip_id`.
    - Retorna `{ metrics, history }`.

- **Criado `src/components/ClientTripHistoryModal.tsx`:**
  - Usa `Modal` existente (sem footer).
  - Grid de 4 cards de contadores (Realizadas, Canceladas, Total gasto em BRL, Avaliação).
  - Seletor de período (4 botões: Hoje/Semana/Mês/Ano).
  - Lista de cards de trip com endereços, data, motorista, status badge, preço.
  - Clique em card abre `<TripDetailModal>` (reusa componente existente).
  - `onTripUpdated` refetch quando modal filho atualiza.

- **`src/app/(dashboard)/clientes/page.tsx`:**
  - Imports novos (ClientTripHistoryModal, fetchClientPerformance, types).
  - 5 estados novos: `historyClient, historyPeriod (default 'month'), historyMetrics, historyEntries, historyLoading`.
  - `useEffect(historyClient, historyPeriod)` fetcha performance com flag `cancelled`.
  - `refreshClientHistory` callback para o `onTripUpdated`.
  - Nome do cliente no card e na tabela agora é `<button onClick={() => setHistoryClient(client)}>`.
  - Renderiza `<ClientTripHistoryModal>` ao final.

### Verificado
- Lint OK.
- Build passa.

### Débito
- Teste manual: cliente com histórico, sem histórico, troca de período, click em corrida abre TripDetailModal, fecha volta pro histórico.

### SQL
Nenhum — schema já suportava tudo.

---

## P4 — Editar viagem em qualquer status (escopo reduzido)

### Problema original do usuário
> "O ADM atualmente consegue alterar as informações de uma viagem (endereço de embarque, endereço de destino, hora, data e motorista) quando a viagem está como 'agendada', mas quero que seja possível em todas as etapas (pelo painel adm)."

### Achado inesperado durante exploração
**Essa edição não existia em nenhum status.** O `TripDetailModal.tsx` mostrava endereços/data como `InfoRow` só-leitura. Existiam apenas:
- `updateTripStatus` (mover no Kanban)
- `updateTripFinancial` (preço/pago)
- `updateTripDriverCandidateStatus`/`Price` (aprovar motorista)

### Escopo reduzido acordado com usuário
- **Incluído:** endereço de embarque, endereço de destino, data e hora — em qualquer status.
- **Fora de escopo (fica pra outro ciclo):** trocar motorista (implica invalidar candidatos e notificações).

### Implementação
- **`src/lib/api.ts`:** nova função `adminUpdateTripBasics(tripId, updates)`:
  - Se `pickup` presente: INSERT novo `addresses`, guarda id em `pickup_address_id`.
  - Idem para `dropoff`.
  - `scheduled_datetime` vai direto.
  - UPDATE trips com o payload (só campos presentes).
  - Log admin via `logAdminAction`.
  - RLS de admin já permite (`20260410120024_create_rls_policies.sql:244`).

- **Criado `src/components/EditTripBasicsModal.tsx`:**
  - Usa `Modal` existente com footer (Cancelar/Salvar).
  - Reusa `AddressAutocompleteField` (P5) para embarque e destino.
  - Input `datetime-local` para data/hora.
  - Helper `addressToGoogle` converte Address (DB) → GooglePlaceAddress.
  - Helpers `isoToLocalInput`/`localInputToIso` para conversão de data.
  - Helper local `isSameAddress` para diff.
  - `handleSave`: validação (3 campos obrigatórios), diff, chama `adminUpdateTripBasics`, toast, `onSaved`, `onClose`.
  - Sem diff → só fecha sem chamada.

- **`src/components/TripDetailModal.tsx`:**
  - Import de `EditTripBasicsModal`.
  - Novo estado `editModalOpen`.
  - Botão "Editar viagem" adicionado ao lado do `<SectionTitle>Informações da Viagem</SectionTitle>` (visível em qualquer status).
  - Renderiza `<EditTripBasicsModal trip={t} open={editModalOpen} onClose={...} onSaved={onUpdate} />` no final.

### Comportamento resultante
- Qualquer status permite edição (inclusive finished/cancelled — pra corrigir histórico se preciso).
- Sub-modal com pré-população.
- Salvar aciona `onUpdate` do TripDetailModal, que refetch a trip.

### Verificado
- Lint OK.
- Build passa.

### Débito
- Teste manual: editar em status diversos, editar só data, editar só endereço, cancelar sem salvar.

### SQL
Nenhum — RLS já permitia.

---

# Trabalho restante

## P7 — Cancelamento com aprovação do admin (implementado)

### Atualização de implementação

- Criada spec `docs/superpowers/specs/2026-07-14-p7-trip-cancellation-approval-design.md`.
- Criado plano `docs/superpowers/plans/2026-07-14-p7-trip-cancellation-approval.md`.
- Criada migration `supabase/migrations/20260714120000_trip_cancellation_requests.sql` com tabela auditável, RLS, índice único parcial, triggers transacionais, notificações e Realtime. A aprovação trava a linha da viagem e rejeita cancelamento tardio de corrida já finalizada.
- Painel web: `TripDetailModal` mostra nome/motivo, permite aprovar ou recusar com motivo e acompanha mudanças por Realtime. Se a consulta do pedido falhar, o cancelamento administrativo direto fica indisponível até uma leitura válida.
- Edge FCM: novo evento `trip_cancellation_rejected` com motivo e `trip_id`.
- Flutter: o motorista envia solicitação sem encerrar a corrida; o painel mostra estado em análise, bloqueia duplicatas e processa recusa/aprovação por Realtime.
- Push Flutter: recusa abre `/home?activeTripId=<tripId>`.
- Verificação: lint direcionado web passou; build Next passou; 127 testes Flutter passaram; `flutter analyze` sem issues. O lint completo mantém sete erros preexistentes fora do escopo do P7.
- Pendente: reconciliar o histórico remoto de migrations, aplicar a migration, redeploy de `send-fcm-push` e `send-admin-onesignal-push`, teste manual ponta a ponta.

### Problema original do usuário
> "O motorista, pelo app prestador, ao clicar em 'cancelar viagem' o mesmo não deve conseguir cancelar automaticamente, o cancelamento virará uma 'solicitação de cancelamento' que deverá ser previamente aprovada pelo ADM para assim conseguir ser cancelada realmente, caso o ADM rejeite o cancelamento, a corrida deve continuar em vigor para o prestador.
>
> Essa solicitação de cancelamento deve aparecer dentro do card da corrida, e deve conter o motivo descrito pelo motorista no app motorista em cinza abaixo do nome do motorista que está solicitando o cancelamento.
>
> Para que funcione corretamente a implementação, ao solicitar um cancelamento (motorista) o ADM recebe uma notificação push que, ao clicar, abre a tela da corrida mostrando a solicitação de cancelamento com as opções (aceitar) (recusar)."

### Exploração feita (web admin)
- **Cancel atual do admin:** `src/lib/api.ts:408-424` `cancelTrip(id)` → seta status='cancelled', cancelled_at, e rejeita candidatos pendentes com observação "Corrida cancelada pela KZ".
- **UI atual:** `src/components/TripDetailModal.tsx:1523-1529` botão "Cancelar Viagem" na "Zona de Risco".
- **`trips` já tem `cancelled_at` e `cancellation_reason` colunas** (`20260410120009_create_trips_table.sql`), mas a coluna `cancellation_reason` não é usada hoje pela UI web.
- **Realtime da trip:** o `TripDetailModal` **NÃO** tem subscription na table trips (só em `trip_driver_candidates`). Se admin decidir num dispositivo e outro admin está com o modal aberto, não vê. Vamos precisar adicionar.
- **Notificações push admin já estão configuradas via OneSignal:** trigger `trg_push_admin_notification_onesignal` fira em INSERT em `notifications` com `type LIKE 'admin_%'`. Chama edge `send-admin-onesignal-push`.
- **Tipos existentes de admin notification:** `admin_trip_review, admin_client_confirmed_trip, admin_driver_confirmed_trip, admin_driver_returned_proposal, admin_driver_rejected_trip, admin_driver_returned_price, admin_trip_created`.

### Exploração feita (app prestador Flutter)
- **Stack:** Flutter/Dart + Supabase (postgrest + realtime) + FCM para push.
- **Cancel atual do motorista:**
  - `/lib/features/trip/presentation/pages/active_trip_page.dart` linhas 792-834
  - `/lib/features/trip/presentation/widgets/cancel_trip_sheet.dart` linhas 1-127
  - **Já pede motivo** (min 10 chars) no `cancel_trip_sheet.dart`
  - Hoje faz UPDATE direto `status='cancelled', cancelled_at, cancellation_reason` → redireciona pra home
- **Push do driver:** FCM via edge function `send-fcm-push` (secret no vault).
- **Realtime já ativo:** `active_trip_page.dart:149-169` escuta postgres_changes em trips.

### Design proposto (falta fechar 3 pontos com o usuário)

**Schema — nova tabela `trip_cancellation_requests`:**
```sql
CREATE TABLE public.trip_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),  -- driver user_id
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),  -- admin user_id
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,  -- motivo do admin quando recusa
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice único parcial: só um pending por trip
CREATE UNIQUE INDEX idx_trip_cancellation_requests_unique_pending
  ON public.trip_cancellation_requests(trip_id) WHERE status = 'pending';

-- RLS:
-- Driver do trip: SELECT/INSERT (só pra seu próprio user, só quando trip é dele, só quando status='pending')
-- Admin: SELECT/UPDATE tudo
```

**Triggers:**
- INSERT em `trip_cancellation_requests` (pending) → INSERT em `notifications` para admins com type `admin_trip_cancellation_request` → edge function admin OneSignal dispara push.
- UPDATE `status` → se approved: também UPDATE trips.status='cancelled', cancelled_at, cancellation_reason. Se rejected: nada em trips. Em ambos: INSERT em `notifications` para o motorista via FCM (novo tipo `driver_cancellation_response`).

**Web admin — mudanças em `TripDetailModal.tsx`:**
- Nova query pra buscar `trip_cancellation_requests` pending para essa trip.
- Nova seção condicional (recomendo colocar antes da seção "Motorista Confirmado", visível em qualquer status onde há request pending):
  ```
  Pedido de Cancelamento
  Motorista <nome> solicitou cancelamento.
  Motivo: <reason em cinza>
  [Aprovar] [Recusar]
  ```
- Adicionar subscription realtime na table `trips` (ou em `trip_cancellation_requests`) pra atualizar UI se outro admin decide.

**Web admin — novas funções em `src/lib/api.ts`:**
- `fetchPendingCancellationRequest(tripId)`
- `approveCancellationRequest(requestId)` — UPDATE status='approved', trigger cuida do trips.status.
- `rejectCancellationRequest(requestId, reason?)` — UPDATE status='rejected'.

**App prestador Flutter — mudanças:**
- `cancel_trip_sheet.dart`: mudar texto do botão para "Solicitar cancelamento" (não é mais imediato). UI provavelmente ganha estado "aguardando aprovação".
- `active_trip_page.dart _onCancelTrip(reason)`: em vez de UPDATE trips.status, INSERT em trip_cancellation_requests com status='pending'.
- Nova subscription realtime em trip_cancellation_requests OU manter escutando trips.status = 'cancelled' para redirecionar quando o trigger cascatear.
- Se admin rejeita, driver recebe push FCM "Cancelamento recusado" + motivo — Flutter precisa lidar com esse novo tipo de notificação.

### Decisões tomadas

1. **Escopo prestador:** web + SQL + Flutter implementados.
2. **Schema:** nova tabela `trip_cancellation_requests` confirmada por decisão técnica conservadora.
3. **Notificação de recusa:** push FCM com motivo implementado.

### Débitos após implementação
- SQL: **1 migration nova + triggers + RLS**
- Edge function: reutilizar `send-admin-onesignal-push` (já pronto do P1) para notificar admin; e `send-fcm-push` para notificar motorista (já existe).
- Testes manuais: fluxo end-to-end nos dois apps.

---

## P3 — Sistema de Chat cross-app (implementado)

### Problema original do usuário
> "Devemos ter uma nova aba no menu lateral (desktop) / inferior (mobile). Essa aba deve se chamar 'Chats' e quando o usuário clicar sobre ela, deve aparecer uma lista com todos os prestadores que enviaram mensagens para a KZ (adm). Ao clicar sobre algum motorista, deve abrir uma tela de chat mostrando as mensagens que o prestador enviou, um input para responder a mensagem e uma seta no canto superior esquerdo de 'voltar' para voltar a tela de motoristas que abriram chat.
>
> Note que, para essa implementação funcionar corretamente, devemos adicionar o botão 'Chat com a KZ' no app prestador em todas as etapas da corrida, desde a solicitação até quando a corrida já está agendada ou quando uma corrida está 'em andamento'.
>
> APP MOTORISTA ESTÁ EM: C:\Projetos\kz-servicos-app-prestador
>
> (Quando o adm recebe uma mensagem, ela deve virar uma notificação de push, e ao clicar sobre ela deve abrir diretamente a tela de chat com aquele motorista) o mesmo deve acontecer para o motorista quando a KZ responder."

### Arquitetura implementada

- O chat de suporte usa `support_conversations` e `support_messages`, separado
  do chat cliente-prestador que depende de viagem ou solicitação de serviço.
- Cada usuário prestador possui no máximo uma conversa persistente com a KZ.
- RLS limita leitura e envio ao próprio prestador e aos admins. Mensagens são
  imutáveis; o destinatário pode somente marcá-las como lidas.
- Triggers mantêm prévia, data da última mensagem e contadores de não lidas.
- As duas tabelas usam Realtime e `REPLICA IDENTITY FULL`.

### Painel web

- Nova aba `Chats` no menu lateral e na navegação inferior mobile.
- `/chats` lista apenas conversas que já possuem mensagem, com busca, prévia,
  horário e contador de não lidas atualizado por Realtime.
- `/chats/[providerId]` possui histórico paginado em blocos de 50, envio,
  marcação de leitura, atualização em tempo real e navegação de retorno.
- Mensagem do prestador cria `admin_support_message` para admins com deep-link
  direto para `/chats/<provider_user_id>`.

### App prestador Flutter

- Nova rota `/support-chat`, tela persistente e service Supabase testável por
  injeção de `SupabaseClient`.
- Acesso pelo quinto item `Chat KZ` da navegação, por todas as etapas da corrida
  ativa e pelo detalhe de agendamento/solicitação.
- Respostas da KZ geram `support_message` via FCM; toque no push, inclusive em
  notificação local ou com app encerrado, abre `/support-chat`.

### SQL para publicação

Execute uma única vez no SQL Editor do Supabase:

1. `supabase/sql/20260715_p7_p3_complete_up.sql`

Esse arquivo aplica P7 e P3 em uma única transação e não executa `DROP` nem
`ROLLBACK`. As duas seções foram comparadas mecanicamente com os scripts up-only
separados. Rodá-lo no SQL Editor não registra as versões no histórico de
migrations; esse histórico continua precisando ser reconciliado antes de voltar
a usar `db push`.

### Verificado

- Lint direcionado do P3 e build Next 16.2.3 passaram.
- Build gerou `/chats` e `/chats/[providerId]` corretamente.
- `flutter analyze` completo passou sem issues.
- `flutter test` completo passou com 134 testes.
- O lint web completo mantém sete erros preexistentes fora do P3.

### Pendente

- Executar o SQL completo acima no projeto Supabase.
- Redeployar `send-fcm-push` e `send-admin-onesignal-push`.
- Testar o fluxo ponta a ponta com um admin e um prestador reais: primeiro
  contato, resposta, não lidas, Realtime, push em foreground/background/encerrado
  e deep-link nos dois aplicativos.

---

# Débitos globais consolidados

## Antes de mergear/publicar

1. **Aplicar SQL no Supabase:** rodar `supabase/sql/20260715_fix_client_saved_addresses_up.sql`; se P7/P3 ainda não foram aplicados, rodar também `supabase/sql/20260715_p7_p3_complete_up.sql`.
2. **Redeploy das Edge Functions:** executar `supabase functions deploy send-fcm-push` e `supabase functions deploy send-admin-onesignal-push`.
3. **Testes manuais no iPhone** (todos os P feitos):
   - P2: instalar PWA, entrar pelo ícone → deve ir pra login, não pra dashboard vazio.
   - P1: gerar admin notification, clicar na push com app fechado e aberto → deve abrir modal correto.
   - P5: editar cliente, salvar Casa/Trabalho, reabrir, confirmar. Testar Limpar.
   - P6: em Nova Viagem, ver sugestões Casa/Trabalho/histórico, digitar/apagar.
   - P8: clicar no nome do cliente, ver contadores, trocar período, clicar em trip do histórico.
   - P4: editar endereço/data de trips em vários status.
   - P3: enviar e responder mensagens, validar Realtime, não lidas, push e deep-link nos dois sentidos.
4. **Testes manuais desktop:**
   - P2: guard funciona (login/logout redireciona), sem flash de UI vazia.
   - P4: editar viagem funciona em Chrome/Edge/Firefox.
   - P3: lista, busca, paginação, leitura, envio e layout responsivo do chat.
5. **Commits agrupados** — você optou por commitar tudo você mesmo. Sugestão de agrupamento (opcional):
   - Um commit por P.
   - Ou separar web/backend, Flutter e documentação.
   - Ou um mega-commit.
6. **Reconciliar migrations:** as versões remotas ausentes localmente (`20260617151627`, `20260618143058`, `20260618143101`, `20260703042037`, `20260703042059`, `20260703042354`, `20260703042409`) ainda impedem o uso confiável de `supabase db push`.

## O que NÃO foi feito (importante saber)

- **Migrations P7 e P3 criadas, mas não aplicadas.** O dry-run remoto foi bloqueado por sete versões do histórico ausentes no repositório local. As 2 migrations não-comitadas anteriores (`20260703043000_secure_status_push_webhooks.sql`, `20260703044500_secure_candidate_push_webhook_vault.sql`) e `supabase/set-fcm-secrets.ps1` continuam sendo preexistentes.
- **Nenhum commit.**
- **Nenhum deploy.**
- **P7 e P3 adicionaram testes Flutter e ampliaram testes existentes.**
- **O app Flutter foi alterado nos fluxos P7 e P3**; o worktree já tinha muitas mudanças preexistentes que foram preservadas.

---

# Como retomar

Para continuar de onde paramos:

1. **Leia este documento** primeiro.
2. **Revise os arquivos alterados** nos dois repositórios; mudanças preexistentes foram preservadas.
3. **Decida sobre commits:** commitar agora antes de mais mudanças ou seguir acumulando.
4. **Publicar P7 e P3:** aplicar o SQL completo único e redeployar as duas Edge Functions.
5. **Executar os testes E2E** de cancelamento e chat em dispositivos reais.

## Caminho completo deste documento

```
C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork\docs\superpowers\PROGRESSO-2026-07-14.md
```

## Estrutura da pasta `docs/superpowers/`

```
docs/superpowers/
├── PROGRESSO-2026-07-14.md          ← ESTE ARQUIVO
├── specs/
│   ├── 2026-07-14-p2-pwa-auth-guard-design.md
│   ├── 2026-07-14-p1-push-deeplink-design.md
│   ├── 2026-07-14-p5-client-home-address-design.md
│   ├── 2026-07-14-p6-smart-autocomplete-design.md
│   ├── 2026-07-14-p8-client-history-metrics-design.md
│   ├── 2026-07-14-p4-edit-trip-basics-design.md
│   ├── 2026-07-14-p7-trip-cancellation-approval-design.md
│   └── 2026-07-14-p3-support-chat-design.md
└── plans/
    ├── 2026-07-14-p2-pwa-auth-guard.md
    ├── 2026-07-14-p1-push-deeplink.md
    ├── 2026-07-14-p5-client-home-address.md
    ├── 2026-07-14-p6-smart-autocomplete.md
    ├── 2026-07-14-p8-client-history-metrics.md
    ├── 2026-07-14-p7-trip-cancellation-approval.md
    └── 2026-07-14-p3-support-chat.md
```
