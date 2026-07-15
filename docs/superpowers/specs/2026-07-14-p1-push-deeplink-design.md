# P1 — Deep-link do push para abrir modal da corrida em /viagens

**Data:** 2026-07-14
**Autor:** Claude (kz-dev)
**Status:** Aprovado para implementação

## Problema

Quando uma notificação push chega para o admin no mobile e ele toca nela, hoje nada de útil acontece: o OneSignal apenas foca a janela do painel (`notificationClickHandlerAction: "focus"`) sem navegar para a corrida em questão. O comportamento esperado é abrir `/viagens` com o card da corrida referenciada já expandido no modal de detalhes.

## Causa raiz

Duas coisas combinadas:

1. **Payload sem query param na URL.** Tanto o edge function `supabase/functions/send-admin-onesignal-push/index.ts:123` quanto a rota Next `src/app/api/admin-notifications/onesignal/route.ts:81` mandam `url: notification.link ?? undefined`. O campo `link` na tabela `notifications` é estático (`/viagens`), sem `?openTrip=<id>`. O `trip_id` fica em `data.reference_id` mas o handler default do OneSignal não lê essa metadata.
2. **Nenhum listener de click registrado no client.** `src/components/OneSignalInitializer.tsx` inicializa o SDK com `notificationClickHandlerAction: "focus"` e nunca chama `OneSignal.Notifications.addEventListener("click", ...)`. Quando o app já está aberto, o click da notificação não dispara navegação.

Já existe `src/lib/admin-notification-navigation.ts` com `buildAdminNotificationHref()` que sabe montar `/viagens?openTrip=<id>` a partir do `reference_type` e `reference_id` — o helper é usado no inbox in-app (`AdminNotificationsButton.tsx`) mas não no fluxo de push.

A página `src/app/(dashboard)/viagens/page.tsx:94` já lê `searchParams.get("openTrip")` e abre o modal correspondente. Ou seja, o consumo da URL está pronto — só falta produzi-la e navegar até ela.

## Design

### Server-side: gerar URL com query param

**`src/app/api/admin-notifications/onesignal/route.ts`**

Importar `buildAdminNotificationHref` de `@/lib/admin-notification-navigation` e usar para computar o `url` do payload. Substituir a linha 81 (`url: notification.link ?? undefined`) por `url: buildAdminNotificationHref(notification) ?? undefined`.

**`supabase/functions/send-admin-onesignal-push/index.ts`**

Duplicar a lógica de `buildAdminNotificationHref` inline no arquivo (Deno edge function não importa de `src/lib`). Adicionar comentário `// keep in sync with src/lib/admin-notification-navigation.ts` acima da função. Substituir a linha 123 (`url: notification.link ?? undefined`) pela chamada do helper local.

A duplicação é aceitável — a lógica é ~5 linhas puras, e criar um pacote compartilhado entre Deno e Node seria overkill para esse escopo. O comentário sinaliza a obrigação de manter em sync.

### Client-side: listener de click com navegação

**`src/components/OneSignalInitializer.tsx`**

Adicionar `Notifications.addEventListener` / `removeEventListener` ao type `OneSignalSDK` (com assinatura do event contendo `notification.additionalData` e `notification.launchURL`).

Dentro do componente, novo `useEffect` que:
1. Obtém `router = useRouter()` (client-side navigation, sem full reload).
2. Aguarda `initOneSignal()`.
3. Registra listener de `click` que:
   - Lê `event.notification.additionalData` (é o objeto `data` que enviamos: `{ notification_id, reference_type, reference_id, type }`).
   - Chama `buildAdminNotificationHref({ link, reference_type, reference_id })` — usando `event.notification.launchURL` como `link`.
   - Se retornar href não-nulo, chama `router.push(href)`.
4. Cleanup: remove o listener no unmount / mudança de sessão.

Fallback: se o SDK não expõe `Notifications.addEventListener` (versão antiga ou runtime sem suporte), a chamada usa optional chaining e falha silente — o fluxo antigo continua funcionando (só sem melhoria).

### Não muda

- `manifest.webmanifest`, `OneSignalSDKWorker.js`, schema do banco, migrations, triggers.
- Configuração `notificationClickHandlerAction: "focus"` fica — nosso listener é aditivo, não substitui.

## Data flow

```
DB trigger cria notification (type=admin_trip_status, ref_type=trip, ref_id=<uuid>, link="/viagens")
  ↓
Edge function OU Next API recebe evento
  ↓
Computa url = buildAdminNotificationHref(notification) = "/viagens?openTrip=<uuid>"
  ↓
POST OneSignal { url, data: { reference_type, reference_id, ... } }
  ↓
Push entregue no device
  ↓
Usuário toca

Caso A — App fechado:
  OneSignal abre nova aba com url → viagens/page.tsx lê openTrip → modal abre ✓

Caso B — App aberto (iPhone PWA, desktop tab, etc.):
  OneSignal foca a janela → listener React dispara →
  router.push("/viagens?openTrip=<uuid>") → useEffect da página abre modal ✓
```

## Edge cases cobertos

- `reference_type !== "trip"` ou `reference_id` ausente → helper devolve `link` cru → comportamento antigo preservado.
- Notificação sem `link` → payload envia `url: undefined` (mesmo de hoje).
- OneSignal SDK não carregou → listener não registra, sem crash.
- App aberto em `/viagens` sem query → `router.push` com query dispara re-render e o `useEffect` da página abre o modal.
- Duas notificações consecutivas de trips diferentes → cada click chama `router.push` com novo `openTrip`, `useEffect` observa mudança de `searchParams` e troca o modal.

## Testes

**Automatizados:** nenhum novo (decisão do usuário — teste manual). O `admin-notification-navigation.test.ts` existente continua cobrindo o helper.

### Checklist de teste manual

**Cenário A — Push abre modal correto (app fechado):**
1. Sair completamente do PWA/painel no dispositivo alvo.
2. Como admin, mover uma corrida qualquer no board para gerar uma admin notification do tipo `admin_trip_status`.
3. Notificação push chega no device.
4. Tocar na notificação.
5. **Esperado:** painel abre em `/viagens?openTrip=<id_da_corrida>` e o modal daquela corrida está aberto.

**Cenário B — Push com app aberto:**
1. Com o painel aberto em qualquer aba/página do dashboard, receber uma push notification.
2. Tocar na notificação.
3. **Esperado:** navega para `/viagens?openTrip=<id>` e o modal abre. Não deve apenas "focar" sem navegar.

**Cenário C — Notificação não-trip:**
1. Gerar uma admin notification que não seja de tipo trip (se existir algum outro tipo hoje). Se não houver, pular este cenário.
2. Tocar na notificação.
3. **Esperado:** navega para o `link` da notificação sem query param (comportamento antigo).

## SQL

**Nenhum.** P1 é 100% código (edge function TS + Next TS + client TS). Schema e triggers permanecem intactos.

## Fora do escopo

- Notificações push para motoristas (P3 chat e P7 cancelamento tratarão).
- Redesign do payload OneSignal ou do schema `notifications`.
- Migrar `notificationClickHandlerAction: "focus"` para outra ação padrão — o listener explícito já cobre.
- Persistir "última corrida vista via push" ou métricas de engajamento.
