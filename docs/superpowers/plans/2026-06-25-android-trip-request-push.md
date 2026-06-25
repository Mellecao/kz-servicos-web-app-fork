# Android Trip Request Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma notificação FCM sonora no Android quando um motorista for adicionado a uma corrida, inclusive com o app removido dos recentes.

**Architecture:** O `INSERT` em `trip_driver_candidates` continuará disparando uma chamada assíncrona via `pg_net`, mas a autenticação usará um secret dedicado armazenado no Supabase Vault e na Edge Function. A função enviará `notification + data` com prioridade alta e canal Android versionado; o Flutter registrará esse canal, evitará duplicidade e tratará o toque para recarregar a home.

**Tech Stack:** Supabase PostgreSQL/Vault/pg_net, Supabase Edge Functions (Deno/TypeScript), Firebase Cloud Messaging HTTP v1, Flutter, `firebase_messaging`, `flutter_local_notifications`, Android resources.

---

## Repositórios

- Painel, migrations e Edge Function: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`
- Aplicativo Flutter: `C:\Projetos\kz-servicos-app-prestador`

## File Map

### Painel/Supabase

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `supabase/functions/send-fcm-push/push-message.ts` | Montar mensagem FCM Android de forma pura e testável |
| Criar | `supabase/functions/send-fcm-push/push-message.test.ts` | Testar payload, deduplicação e classificação de token inválido |
| Modificar | `supabase/functions/send-fcm-push/index.ts` | Autenticar webhook, usar helper, limpar tokens inválidos e registrar resultados |
| Criar | `supabase/migrations/20260625120000_secure_trip_push_webhook.sql` | Substituir service role literal por secret do Vault |
| Modificar | `.gitignore` | Bloquear contas de serviço Firebase |
| Deletar | `kz-notifica-serviceaccount.json` | Remover chave privada do worktree |

### Aplicativo Flutter

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Modificar | `lib/core/services/push_notification_service.dart` | Canal v2 com som, redirect puro e tratamento de abertura |
| Modificar | `lib/main.dart` | Conectar abertura da notificação ao router |
| Modificar | `lib/routes/app_router.dart` | Construir rota segura para push de corrida |
| Modificar | `test/core/services/push_notification_service_test.dart` | Testar conteúdo, deduplicação e redirect |
| Criar | `android/app/src/main/res/raw/trip_notification.wav` | Som do canal Android |
| Modificar | `android/app/src/main/AndroidManifest.xml` | Definir canal FCM padrão |
| Modificar | `.gitignore` | Bloquear chaves Admin SDK |
| Deletar | `android/app/kz-notifica-firebase-adminsdk-fbsvc-d16e7215db.json` | Remover chave privada do APK/repositório |

---

### Task 1: Extrair e testar a mensagem FCM Android

**Files:**
- Create: `supabase/functions/send-fcm-push/push-message.ts`
- Create: `supabase/functions/send-fcm-push/push-message.test.ts`
- Modify: `supabase/functions/send-fcm-push/index.ts`

- [ ] **Step 1: Escrever os testes falhando**

Criar `supabase/functions/send-fcm-push/push-message.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFcmMessage,
  deduplicateTokens,
  isInvalidFcmTokenError,
} from "./push-message.ts";

test("builds visible high-priority Android trip request notification", () => {
  const message = buildFcmMessage({
    token: "token-1",
    title: "Nova corrida disponível!",
    body: "Maria solicitou uma nova corrida.",
    data: { type: "trip_request", trip_id: "trip-1" },
  });

  assert.deepEqual(message.notification, {
    title: "Nova corrida disponível!",
    body: "Maria solicitou uma nova corrida.",
  });
  assert.equal(message.android.priority, "high");
  assert.equal(message.android.notification.channel_id, "trip_requests_v2");
  assert.equal(message.android.notification.sound, "trip_notification");
  assert.deepEqual(message.data, {
    type: "trip_request",
    trip_id: "trip-1",
  });
});

test("deduplicates non-empty device tokens", () => {
  assert.deepEqual(
    deduplicateTokens(["token-1", "", "token-1", "token-2"]),
    ["token-1", "token-2"],
  );
});

test("recognizes unregistered FCM tokens", () => {
  assert.equal(
    isInvalidFcmTokenError(
      404,
      '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}',
    ),
    true,
  );
  assert.equal(isInvalidFcmTokenError(500, "internal"), false);
});
```

- [ ] **Step 2: Rodar os testes e confirmar RED**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
```

Expected: FAIL porque `push-message.ts` ainda não existe.

- [ ] **Step 3: Criar a implementação mínima**

Criar `supabase/functions/send-fcm-push/push-message.ts`:

```ts
export const tripRequestChannelId = "trip_requests_v2";
export const tripRequestSound = "trip_notification";

export interface FcmMessageInput {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export function buildFcmMessage(input: FcmMessageInput) {
  return {
    token: input.token,
    notification: {
      title: input.title,
      body: input.body,
    },
    data: input.data,
    android: {
      priority: "high" as const,
      notification: {
        channel_id: tripRequestChannelId,
        sound: tripRequestSound,
        notification_priority: "PRIORITY_MAX",
        default_vibrate_timings: true,
      },
    },
  };
}

export function deduplicateTokens(tokens: string[]): string[] {
  return [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
}

export function isInvalidFcmTokenError(
  status: number,
  responseBody: string,
): boolean {
  return (
    status === 404 ||
    responseBody.includes("UNREGISTERED") ||
    responseBody.includes("registration-token-not-registered")
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar GREEN**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
```

Expected: 3 testes passando.

- [ ] **Step 5: Integrar o helper na Edge Function**

No topo de `supabase/functions/send-fcm-push/index.ts`, adicionar:

```ts
import {
  buildFcmMessage,
  deduplicateTokens,
  isInvalidFcmTokenError,
} from "./push-message.ts";
```

Em `getDriverTokens`, substituir o retorno por:

```ts
return deduplicateTokens(tokens);
```

Em `sendFCMMessage`, remover o parâmetro `persistent`, montar a mensagem com:

```ts
const message = buildFcmMessage({
  token,
  title,
  body,
  data: dataPayload,
});
```

Classificar resposta inválida com:

```ts
if (isInvalidFcmTokenError(res.status, errBody)) {
  return { ok: false, invalidToken: true, error: "token_invalid" };
}
```

Atualizar o tipo de retorno para:

```ts
Promise<{ ok: boolean; invalidToken?: boolean; error?: string }>
```

- [ ] **Step 6: Confirmar que a função não mantém o fluxo data-only**

Run:

```powershell
rg -n "data-only|if \\(!persistent\\)|message\\.notification|android = \\{ priority" supabase/functions/send-fcm-push
```

Expected: nenhum ramo que remova `notification` para `trip_request`.

- [ ] **Step 7: Rodar testes e lint do painel**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
npm run lint
```

Expected: testes passando e lint sem erros.

- [ ] **Step 8: Commit**

```powershell
git add supabase/functions/send-fcm-push
git commit -m "feat: enviar push Android visível para novas corridas"
```

---

### Task 2: Proteger a Edge Function com secret dedicado

**Files:**
- Modify: `supabase/functions/send-fcm-push/index.ts`
- Test: `supabase/functions/send-fcm-push/push-message.test.ts`

- [ ] **Step 1: Adicionar teste falhando para comparação do secret**

Adicionar ao helper e ao teste uma função pura:

```ts
test("accepts only an exact non-empty webhook secret", () => {
  assert.equal(isAuthorizedWebhook("secret", "secret"), true);
  assert.equal(isAuthorizedWebhook("", ""), false);
  assert.equal(isAuthorizedWebhook("wrong", "secret"), false);
});
```

Importar `isAuthorizedWebhook` no teste.

- [ ] **Step 2: Rodar o teste e confirmar RED**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
```

Expected: FAIL porque `isAuthorizedWebhook` não existe.

- [ ] **Step 3: Implementar a comparação**

Adicionar em `push-message.ts`:

```ts
export function isAuthorizedWebhook(
  providedSecret: string,
  expectedSecret: string,
): boolean {
  return (
    providedSecret.length > 0 &&
    expectedSecret.length > 0 &&
    providedSecret === expectedSecret
  );
}
```

- [ ] **Step 4: Substituir a autenticação da função**

Em `index.ts`, importar `isAuthorizedWebhook` e substituir a comparação com `SUPABASE_SERVICE_ROLE_KEY` por:

```ts
const expectedWebhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
const providedWebhookSecret =
  req.headers.get("X-Push-Webhook-Secret") ?? "";

if (!isAuthorizedWebhook(providedWebhookSecret, expectedWebhookSecret)) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

Manter `SUPABASE_SERVICE_ROLE_KEY` somente para criar o cliente server-side depois da autenticação:

```ts
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!serviceRoleKey) {
  return Response.json(
    { error: "Missing server configuration" },
    { status: 500 },
  );
}
```

- [ ] **Step 5: Rodar os testes**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
```

Expected: 4 testes passando.

- [ ] **Step 6: Criar os secrets sem gravá-los no repositório**

Gerar um valor aleatório somente em memória:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$env:PUSH_WEBHOOK_SECRET = [Convert]::ToBase64String($bytes)
supabase secrets set PUSH_WEBHOOK_SECRET="$env:PUSH_WEBHOOK_SECRET"
```

No Supabase SQL Editor, executar com o mesmo valor mantido apenas durante a operação:

```sql
select vault.create_secret(
  '<VALOR_GERADO_NA_SESSAO>',
  'push_webhook_secret',
  'Autenticacao do trigger de push para a Edge Function'
);
```

Não salvar o valor em arquivo, migration, terminal history compartilhado ou documentação.

- [ ] **Step 7: Commit**

```powershell
git add supabase/functions/send-fcm-push
git commit -m "security: autenticar webhook de push com secret dedicado"
```

---

### Task 3: Substituir a service role literal no trigger PostgreSQL

**Files:**
- Create: `supabase/migrations/20260625120000_secure_trip_push_webhook.sql`

- [ ] **Step 1: Criar a migration**

Criar `supabase/migrations/20260625120000_secure_trip_push_webhook.sql`:

```sql
-- +goose Up

create or replace function public.trigger_push_on_candidate_insert()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  v_trip record;
  v_webhook_secret text;
begin
  if new.status::text <> 'pending' then
    return new;
  end if;

  select id, status, client_id, pickup_address_id, dropoff_address_id
    into v_trip
  from public.trips
  where id = new.trip_id;

  if not found or v_trip.status::text <> 'searching_drivers' then
    return new;
  end if;

  select decrypted_secret
    into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  order by created_at desc
  limit 1;

  if coalesce(v_webhook_secret, '') = '' then
    raise warning 'push_webhook_secret ausente; push ignorado para candidato %', new.id;
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://mtsqeomctrqfyekyzapc.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Push-Webhook-Secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'table', 'trip_driver_candidates',
        'event', 'INSERT',
        'new_record', jsonb_build_object(
          'id', v_trip.id,
          'status', 'pending',
          'client_id', v_trip.client_id,
          'driver_profile_id', new.driver_profile_id,
          'pickup_address_id', v_trip.pickup_address_id,
          'dropoff_address_id', v_trip.dropoff_address_id
        )
      ),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'push notification failed for candidate % (trip %): %',
      new.id, new.trip_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_push_on_candidate_insert
  on public.trip_driver_candidates;

create trigger trg_push_on_candidate_insert
  after insert on public.trip_driver_candidates
  for each row
  execute function public.trigger_push_on_candidate_insert();

-- +goose Down

-- Reversao segura: remove o trigger sem restaurar credencial administrativa literal.
drop trigger if exists trg_push_on_candidate_insert
  on public.trip_driver_candidates;
drop function if exists public.trigger_push_on_candidate_insert();
```

- [ ] **Step 2: Verificar que a nova migration não contém JWT**

Run:

```powershell
rg -n "eyJhbGci|service_role" supabase/migrations/20260625120000_secure_trip_push_webhook.sql
```

Expected: nenhum resultado.

- [ ] **Step 3: Validar localmente a migration**

Run:

```powershell
supabase db reset
```

Expected: migrations aplicadas sem erro. Se o projeto local não estiver inicializado, executar primeiro `supabase start` e repetir.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/20260625120000_secure_trip_push_webhook.sql
git commit -m "fix: proteger trigger de push com Supabase Vault"
```

---

### Task 4: Tratar tokens inválidos e melhorar observabilidade

**Files:**
- Modify: `supabase/functions/send-fcm-push/index.ts`
- Modify: `supabase/functions/send-fcm-push/push-message.test.ts`

- [ ] **Step 1: Escrever teste falhando para resultado de dispatch**

Adicionar um helper `summarizeDispatchResults` e teste:

```ts
test("summarizes sent, invalid and failed deliveries", () => {
  assert.deepEqual(
    summarizeDispatchResults([
      { ok: true },
      { ok: false, invalidToken: true },
      { ok: false, error: "fcm_error" },
    ]),
    { sent: 1, invalid: 1, errors: 1 },
  );
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
```

Expected: FAIL porque o helper não existe.

- [ ] **Step 3: Implementar o helper**

Adicionar em `push-message.ts`:

```ts
export interface DeliveryResult {
  ok: boolean;
  invalidToken?: boolean;
  error?: string;
}

export function summarizeDispatchResults(results: DeliveryResult[]) {
  return results.reduce(
    (summary, result) => {
      if (result.ok) summary.sent++;
      else if (result.invalidToken) summary.invalid++;
      else summary.errors++;
      return summary;
    },
    { sent: 0, invalid: 0, errors: 0 },
  );
}
```

- [ ] **Step 4: Limpar token inválido na origem**

Alterar `PushTarget` para incluir:

```ts
interface PushTarget {
  token: string;
  role: "client" | "driver" | "provider";
  userId?: string;
  driverProfileId?: string;
}
```

Quando `invalidToken` for verdadeiro:

```ts
if (target.driverProfileId) {
  await supabase
    .from("driver_profiles")
    .update({ fcm_token: null, fcm_token_updated_at: null })
    .eq("id", target.driverProfileId)
    .eq("fcm_token", target.token);
}

if (target.userId) {
  await supabase
    .from("users")
    .update({ fcm_token: null, fcm_token_updated_at: null })
    .eq("id", target.userId)
    .eq("fcm_token", target.token);
}
```

Passar o cliente Supabase para `dispatchSpecs` e retornar:

```ts
{ sent, invalid, errors }
```

- [ ] **Step 5: Rodar testes e lint**

Run:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
npm run lint
```

Expected: testes e lint passando.

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/send-fcm-push
git commit -m "fix: limpar tokens FCM inválidos e registrar entregas"
```

---

### Task 5: Configurar canal sonoro e abertura do push no Flutter

**Files:**
- Modify: `lib/core/services/push_notification_service.dart`
- Modify: `test/core/services/push_notification_service_test.dart`
- Modify: `lib/main.dart`
- Modify: `lib/routes/app_router.dart`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/res/raw/trip_notification.wav`

- [ ] **Step 1: Corrigir e ampliar os testes Flutter**

Substituir expectativas antigas e adicionar testes:

```dart
test('monta notificacao para nova corrida', () {
  final content = PushNotificationService.buildTripNotificationContent({
    'type': 'trip_request',
    'client_name': 'Maria',
    'pickup_address': 'Av. Paulista, 1000',
    'destination_address': 'Aeroporto Congonhas',
  });

  expect(content?.title, 'Nova corrida disponível!');
  expect(
    content?.body,
    'Maria solicitou uma corrida de Av. Paulista, 1000 para Aeroporto Congonhas.',
  );
});

test('constroi redirect para solicitacao de corrida', () {
  expect(
    PushNotificationService.buildOpenedMessageLocation({
      'type': 'trip_request',
      'trip_id': 'trip-123',
    }),
    '/home?tripRequestId=trip-123',
  );
});

test('ignora redirect de payload desconhecido', () {
  expect(
    PushNotificationService.buildOpenedMessageLocation({
      'type': 'chat_message',
    }),
    isNull,
  );
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run:

```powershell
flutter test test/core/services/push_notification_service_test.dart
```

Expected: FAIL nas expectativas atuais e porque `buildOpenedMessageLocation` não existe.

- [ ] **Step 3: Versionar o canal Android com som**

Em `push_notification_service.dart`, usar:

```dart
static const String tripChannelId = 'trip_requests_v2';

static const AndroidNotificationChannel _tripChannel =
    AndroidNotificationChannel(
      tripChannelId,
      'Solicitações de corrida',
      description: 'Alertas sonoros de novas solicitações de corrida.',
      importance: Importance.max,
      playSound: true,
      sound: RawResourceAndroidNotificationSound('trip_notification'),
      enableVibration: true,
    );
```

Em `AndroidNotificationDetails`, adicionar:

```dart
sound: const RawResourceAndroidNotificationSound('trip_notification'),
playSound: true,
enableVibration: true,
category: AndroidNotificationCategory.call,
```

- [ ] **Step 4: Implementar redirect puro e callback de abertura**

Adicionar:

```dart
static String? buildOpenedMessageLocation(Map<String, dynamic> data) {
  final type = '${data['type'] ?? data['event'] ?? ''}';
  final tripId = '${data['trip_id'] ?? ''}'.trim();
  if ((type == 'trip_request' || type == 'new_trip_request') &&
      tripId.isNotEmpty) {
    return '/home?tripRequestId=${Uri.encodeComponent(tripId)}';
  }
  return null;
}
```

Alterar `initialize` para receber:

```dart
static Future<void> initialize({
  required void Function(String location) onOpenLocation,
}) async
```

Registrar:

```dart
void handleOpen(RemoteMessage message) {
  final location = buildOpenedMessageLocation(message.data);
  if (location != null) onOpenLocation(location);
}

FirebaseMessaging.onMessageOpenedApp.listen(handleOpen);

final initialMessage = await _messaging.getInitialMessage();
if (initialMessage != null) {
  WidgetsBinding.instance.addPostFrameCallback((_) {
    handleOpen(initialMessage);
  });
}
```

- [ ] **Step 5: Conectar o router**

Em `main.dart`:

```dart
await PushNotificationService.initialize(
  onOpenLocation: AppRouter.openPushLocation,
);
```

Em `app_router.dart`:

```dart
static void openPushLocation(String location) {
  router.go(location);
}
```

O guard existente preservará a rota em `/splash?redirect=...` quando a sessão ainda não tiver sido restaurada.

- [ ] **Step 6: Adicionar o som Android**

Criar `android/app/src/main/res/raw/` e copiar o conteúdo binário de:

```text
assets/audio/trip_notification.wav
```

para:

```text
android/app/src/main/res/raw/trip_notification.wav
```

Essa cópia binária deve ser feita por comando de cópia, sem conversão:

```powershell
New-Item -ItemType Directory -Force android/app/src/main/res/raw | Out-Null
Copy-Item assets/audio/trip_notification.wav android/app/src/main/res/raw/trip_notification.wav
```

- [ ] **Step 7: Definir canal padrão no manifest**

Dentro de `<application>` em `AndroidManifest.xml`, adicionar:

```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="trip_requests_v2" />
```

- [ ] **Step 8: Rodar testes e análise**

Run:

```powershell
flutter test test/core/services/push_notification_service_test.dart
flutter analyze
```

Expected: testes passando e análise sem novos erros.

- [ ] **Step 9: Commit**

```powershell
git add lib/core/services/push_notification_service.dart `
  lib/main.dart `
  lib/routes/app_router.dart `
  test/core/services/push_notification_service_test.dart `
  android/app/src/main/AndroidManifest.xml `
  android/app/src/main/res/raw/trip_notification.wav
git commit -m "feat: abrir e tocar notificacao de nova corrida no Android"
```

---

### Task 6: Remover credenciais privadas dos dois repositórios

**Files:**
- Modify: painel `.gitignore`
- Delete: painel `kz-notifica-serviceaccount.json`
- Modify: app `.gitignore`
- Delete: app `android/app/kz-notifica-firebase-adminsdk-fbsvc-d16e7215db.json`

- [ ] **Step 1: Atualizar `.gitignore` do painel**

Garantir:

```gitignore
*-serviceaccount.json
*-firebase-adminsdk-*.json
```

- [ ] **Step 2: Atualizar `.gitignore` do app**

Adicionar:

```gitignore
*-serviceaccount.json
*-firebase-adminsdk-*.json
```

- [ ] **Step 3: Remover os arquivos privados**

Usar `apply_patch` para deletar:

```text
C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork\kz-notifica-serviceaccount.json
C:\Projetos\kz-servicos-app-prestador\android\app\kz-notifica-firebase-adminsdk-fbsvc-d16e7215db.json
```

- [ ] **Step 4: Verificar ausência de chaves privadas rastreadas**

Em cada repositório:

```powershell
git ls-files | rg "serviceaccount|firebase-adminsdk"
rg -l --hidden --glob '!node_modules/**' --glob '!.git/**' `
  '"private_key"\\s*:' .
```

Expected: nenhum arquivo rastreado ou conteúdo de chave privada.

- [ ] **Step 5: Commit no painel**

```powershell
git add .gitignore
git add -u kz-notifica-serviceaccount.json
git commit -m "security: remover conta de servico Firebase do repositorio"
```

- [ ] **Step 6: Commit no app**

```powershell
git add .gitignore
git add -u android/app/kz-notifica-firebase-adminsdk-fbsvc-d16e7215db.json
git commit -m "security: remover chave Firebase Admin do app"
```

- [ ] **Step 7: Rotação externa obrigatória**

No Supabase e Firebase:

1. Rotacionar a `service_role` exposta.
2. Revogar as contas/chaves Firebase Admin expostas.
3. Criar nova chave Firebase somente se necessária para os secrets da Edge Function.
4. Atualizar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` nos secrets da Edge Function.
5. Nunca baixar/copiar a nova chave para dentro dos repositórios.

---

### Task 7: Deploy controlado e teste ponta a ponta

**Files:**
- No source changes expected

- [ ] **Step 1: Verificação completa antes do deploy**

Painel:

```powershell
node --test supabase/functions/send-fcm-push/push-message.test.ts
npm run lint
npm run build
git diff --check
```

App:

```powershell
flutter test
flutter analyze
flutter build apk --debug
git diff --check
```

Expected: todos os comandos com exit code 0.

- [ ] **Step 2: Aplicar migration remota**

Run:

```powershell
supabase db push
```

Expected: `20260625120000_secure_trip_push_webhook.sql` aplicada.

- [ ] **Step 3: Publicar a Edge Function**

Run:

```powershell
supabase functions deploy send-fcm-push --no-verify-jwt
```

Expected: nova versão ativa. `--no-verify-jwt` é mantido porque a função aplica autenticação própria pelo header `X-Push-Webhook-Secret`.

- [ ] **Step 4: Instalar o APK em dispositivo Android físico**

Run:

```powershell
flutter install
```

Abrir o app, autenticar como motorista e conceder a permissão de notificações.

- [ ] **Step 5: Confirmar registro do token**

No Supabase, verificar que o motorista autenticado possui `fcm_token` não vazio em `driver_profiles` ou `users`, sem copiar o token para logs públicos.

- [ ] **Step 6: Executar teste com app removido dos recentes**

1. Remover o app da lista de recentes.
2. No painel, adicionar o motorista a uma corrida em `searching_drivers`.
3. Confirmar uma única notificação sonora em poucos segundos.
4. Tocar na notificação.
5. Confirmar que a home recarrega e mostra a corrida pendente.

- [ ] **Step 7: Conferir logs**

Usar MCP Supabase:

- Edge Function: resposta HTTP 200 com `sent >= 1`.
- PostgreSQL: ausência de warnings de secret ausente.
- FCM: ausência de `UNREGISTERED` para o dispositivo testado.

- [ ] **Step 8: Repetir cenários**

- app em primeiro plano;
- app em segundo plano;
- app removido dos recentes;
- candidato duplicado impedido pela constraint;
- corrida não está em `searching_drivers` e não deve gerar push;
- candidato não está `pending` e não deve gerar push.

- [ ] **Step 9: Registrar evidências finais**

No handoff final, informar:

- comandos executados e respectivos resultados;
- versão implantada da Edge Function;
- migration aplicada;
- resultado do teste em dispositivo físico;
- limitações: Android **Forçar parada** continua fora do escopo.

---

## Self-Review

### Cobertura da especificação

| Requisito | Task |
|---|---|
| Trigger continua como origem do evento | Task 3 |
| Secret dedicado, sem service role no SQL | Tasks 2 e 3 |
| FCM `notification + data` | Task 1 |
| Prioridade alta, canal e som Android | Tasks 1 e 5 |
| Evitar notificação local duplicada | Task 5 mantém o retorno existente quando `message.notification != null` |
| Toque abre app e recarrega home | Task 5 |
| Token inválido é limpo | Task 4 |
| Credenciais privadas fora dos repositórios/APK | Task 6 |
| Falha do push não aborta convite | Task 3 |
| Teste com app removido dos recentes | Task 7 |
| Android apenas; sem promessa após Forçar parada | Task 7 |

### Placeholder scan

Não há tarefas de implementação vagas. O único valor deliberadamente não escrito é o secret, que deve ser gerado durante a execução e nunca persistido no plano.

### Consistência

- O canal é `trip_requests_v2` na Edge Function, Flutter e manifest.
- O som é `trip_notification` no payload e em `res/raw/trip_notification.wav`.
- O payload usa `type = trip_request` e `trip_id`.
- O header interno é `X-Push-Webhook-Secret` no trigger e na Edge Function.
