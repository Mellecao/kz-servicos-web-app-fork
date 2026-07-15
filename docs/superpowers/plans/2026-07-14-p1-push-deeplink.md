# P1 — Push Deep-Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar em uma notificação push de admin, o painel abre `/viagens?openTrip=<id>` e o modal da corrida referenciada expande automaticamente.

**Architecture:** (a) Server-side calcula a URL completa com query param usando `buildAdminNotificationHref` (helper compartilhado, duplicado inline no edge function Deno). (b) Client-side registra listener explícito no OneSignal SDK que chama `router.push(href)` — cobre o caso "app já aberto" em que OneSignal só focaria a janela.

**Tech Stack:** Next.js App Router, TypeScript, OneSignal Web SDK v16, Supabase Edge Function (Deno).

**Spec:** `docs/superpowers/specs/2026-07-14-p1-push-deeplink-design.md`

**Testes automatizados:** nenhum novo (decisão do usuário — teste manual). Cada tarefa termina com `npm run lint` no arquivo alterado + `npm run build` no fim.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/app/api/admin-notifications/onesignal/route.ts` | modificar | Importar helper e usar como `url` do payload |
| `supabase/functions/send-admin-onesignal-push/index.ts` | modificar | Duplicar helper inline (Deno) e usar como `url` do payload |
| `src/components/OneSignalInitializer.tsx` | modificar | Registrar listener de click no SDK que navega via `router.push` |

---

### Task 1: Server-side — Next API route usa `buildAdminNotificationHref`

**Files:**
- Modify: `src/app/api/admin-notifications/onesignal/route.ts:1-2, 81`

- [ ] **Step 1: Adicionar import do helper**

Trecho atual (linhas 1-2):

```ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
```

Substituir por:

```ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildAdminNotificationHref } from "@/lib/admin-notification-navigation";
```

- [ ] **Step 2: Trocar a linha do `url` no payload**

Trecho atual (linha 81, dentro do `body: JSON.stringify({...})`):

```ts
      url: notification.link ?? undefined,
```

Substituir por:

```ts
      url: buildAdminNotificationHref(notification) ?? undefined,
```

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/app/api/admin-notifications/onesignal/route.ts`
Expected: sem erros/warnings.

---

### Task 2: Server-side — Edge function duplica o helper inline

**Files:**
- Modify: `supabase/functions/send-admin-onesignal-push/index.ts`

- [ ] **Step 1: Adicionar função helper inline no topo do arquivo (após as interfaces)**

Localizar o final das interfaces (após a interface `RequestPayload`, antes da classe `SupabaseRestClient` — em torno da linha 17).

Adicionar entre elas:

```ts
// keep in sync with src/lib/admin-notification-navigation.ts
function buildAdminNotificationHref(
  notification: Pick<AdminNotificationRecord, "link" | "reference_type" | "reference_id">,
): string | null {
  if (
    notification.link === "/viagens" &&
    notification.reference_type === "trip" &&
    notification.reference_id
  ) {
    return `/viagens?openTrip=${encodeURIComponent(notification.reference_id)}`;
  }
  return notification.link ?? null;
}
```

- [ ] **Step 2: Trocar a linha do `url` no payload**

Trecho atual (linha 123, dentro do `body: JSON.stringify({...})` do POST OneSignal):

```ts
      url: notification.link ?? undefined,
```

Substituir por:

```ts
      url: buildAdminNotificationHref(notification) ?? undefined,
```

- [ ] **Step 3: Validar estruturalmente**

Este arquivo roda em Deno, então não pode ser lintado pelo eslint local. Validação limita-se a leitura visual:

- Confirmar que `AdminNotificationRecord` tem `link`, `reference_type`, `reference_id` (sim, linhas 6-9 do arquivo).
- Confirmar que a função helper foi adicionada acima da classe e do handler.
- Confirmar que o `url:` do payload agora usa `buildAdminNotificationHref(notification)`.

Nenhum comando roda — a validação é conferir o diff.

---

### Task 3: Client-side — Listener de click no `OneSignalInitializer`

**Files:**
- Modify: `src/components/OneSignalInitializer.tsx`

- [ ] **Step 1: Estender o type `OneSignalSDK` com `addEventListener`/`removeEventListener`**

Trecho atual (linhas 10-20):

```ts
type OneSignalSDK = {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void> | void;
  logout: () => Promise<void> | void;
  Slidedown?: {
    promptPush?: () => Promise<void> | void;
  };
  Notifications?: {
    requestPermission?: () => Promise<boolean> | boolean;
  };
};
```

Substituir por:

```ts
type OneSignalNotificationClickEvent = {
  notification?: {
    additionalData?: {
      reference_type?: string | null;
      reference_id?: string | null;
      notification_id?: string | null;
      type?: string | null;
    } | null;
    launchURL?: string | null;
  };
  result?: {
    url?: string | null;
    actionId?: string | null;
  };
};

type OneSignalNotificationClickListener = (
  event: OneSignalNotificationClickEvent,
) => void;

type OneSignalSDK = {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void> | void;
  logout: () => Promise<void> | void;
  Slidedown?: {
    promptPush?: () => Promise<void> | void;
  };
  Notifications?: {
    requestPermission?: () => Promise<boolean> | boolean;
    addEventListener?: (
      event: "click",
      listener: OneSignalNotificationClickListener,
    ) => void;
    removeEventListener?: (
      event: "click",
      listener: OneSignalNotificationClickListener,
    ) => void;
  };
};
```

- [ ] **Step 2: Adicionar imports no topo do arquivo**

Trecho atual (linhas 1-4):

```tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
```

Substituir por:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { buildAdminNotificationHref } from "@/lib/admin-notification-navigation";
```

- [ ] **Step 3: Registrar o listener dentro do componente**

Localizar o final da função `OneSignalInitializer` (o segundo `useEffect`, linhas 110-133, termina com o cleanup `cancelled = true`).

Primeiro, mover a declaração de `useRouter()` para o topo do componente junto dos outros hooks.

Trecho atual (linhas 101-102):

```tsx
export default function OneSignalInitializer() {
  const { loading, session } = useAuth();
```

Substituir por:

```tsx
export default function OneSignalInitializer() {
  const { loading, session } = useAuth();
  const router = useRouter();
```

Depois, logo antes do `return null;` final (linha 135), adicionar um NOVO `useEffect` que consome `router`:

```tsx
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void initOneSignal()
      .then((oneSignal) => {
        if (!oneSignal || cancelled) return;

        const handleClick = (event: OneSignalNotificationClickEvent) => {
          const data = event.notification?.additionalData ?? undefined;
          const href = buildAdminNotificationHref({
            link: event.notification?.launchURL ?? null,
            reference_type: data?.reference_type ?? null,
            reference_id: data?.reference_id ?? null,
          });
          if (href) {
            router.push(href);
          }
        };

        oneSignal.Notifications?.addEventListener?.("click", handleClick);
        cleanup = () => {
          oneSignal.Notifications?.removeEventListener?.("click", handleClick);
        };
      })
      .catch((error) => {
        console.error("Erro ao registrar listener de click OneSignal:", error);
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);
```

Estrutura final esperada do componente:

```tsx
export default function OneSignalInitializer() {
  const { loading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    void initOneSignal().catch(...);
  }, []);

  useEffect(() => {
    // (login/logout de user existente — não mudar)
  }, [loading, session?.user.id]);

  useEffect(() => {
    // (novo listener de click — descrito acima)
  }, [router]);

  return null;
}
```

- [ ] **Step 4: Lint**

Run: `npm run lint -- src/components/OneSignalInitializer.tsx`
Expected: sem erros/warnings.

---

### Task 4: Build de produção

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build passa sem erros de TypeScript nem falha do Next.

Se houver erro relacionado a `OneSignalInitializer.tsx` ou `admin-notifications/onesignal/route.ts`, parar e diagnosticar antes de prosseguir.

- [ ] **Step 2: Verificar diff**

Run: `git diff --stat`
Expected: apenas 3 arquivos modificados neste plano:
- `src/app/api/admin-notifications/onesignal/route.ts`
- `supabase/functions/send-admin-onesignal-push/index.ts`
- `src/components/OneSignalInitializer.tsx`

---

### Task 5: Backlog de teste manual (não bloqueia P3+)

Adicionar ao backlog de testes iPhone:

**Cenário A — Push abre modal correto (app fechado):**
1. Fechar o PWA completamente.
2. Como admin, mover uma corrida no board (gera notificação `admin_trip_status`).
3. Push chega no device.
4. Tocar → esperado: painel abre em `/viagens?openTrip=<id>` com modal aberto.

**Cenário B — Push com app aberto:**
1. Painel aberto em qualquer página do dashboard.
2. Receber push.
3. Tocar → esperado: navega para `/viagens?openTrip=<id>`, modal abre. Não deve apenas focar.

**Cenário C — Deploy do Edge Function:**
- Ao rodar o teste real, garantir que o edge function `send-admin-onesignal-push` foi **redeployado** no Supabase (o arquivo TS não vira ativo automaticamente). Comando padrão do projeto: `supabase functions deploy send-admin-onesignal-push`. Confirmar com o usuário antes do teste.

---

## Notas para o executor

- **Deploy do edge function é passo obrigatório antes do teste manual.** Sem deploy, a mudança do server fica no repositório mas o OneSignal continua recebendo o payload antigo.
- Se o `admin-notification-navigation.test.ts` existente falhar depois das mudanças, algo saiu do padrão — parar e ler o teste.
- Não mexer em `notificationClickHandlerAction: "focus"` — o listener é aditivo.
- Se o usuário reportar "abriu duas vezes" após clicar, provavelmente o OneSignal navegou E o listener também disparou. Nesse caso, adicionar uma verificação no listener: se `window.location.pathname + search` já é o `href`, não chamar `router.push`. Só implementar essa proteção se o bug se manifestar.
