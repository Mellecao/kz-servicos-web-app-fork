# P2 — PWA Auth Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que o painel admin renderize sem sessão (fix do bug em que o PWA instalado no iPhone abre com todas as corridas sumidas).

**Architecture:** Novo componente client `RequireAuth` que consome o `useAuth()` existente e redireciona para `/login` quando `session === null && !loading`. Envolvemos todo o conteúdo do `(dashboard)/layout.tsx` dentro dele. Também adicionamos um aviso ao `MobilePushPermissionGuide` explicando que após instalar o PWA no iPhone será necessário fazer login novamente.

**Tech Stack:** Next.js App Router, TypeScript, Supabase JS client, existing `AuthProvider` em `src/lib/auth-context.tsx`.

**Spec:** `docs/superpowers/specs/2026-07-14-p2-pwa-auth-guard-design.md`

**Testes automatizados:** nenhum (decisão explícita do usuário — validação manual no iPhone). Cada tarefa termina com `npm run lint` + `npx tsc --noEmit` para segurar regressões básicas.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/RequireAuth.tsx` | criar | Client component que redireciona para `/login` quando não há sessão autenticada |
| `src/app/(dashboard)/layout.tsx` | modificar | Envolver todo o conteúdo autenticado com `<RequireAuth>` |
| `src/components/MobilePushPermissionGuide.tsx` | modificar | Acrescentar aviso sobre reautenticação após instalar PWA no iPhone |

---

### Task 1: Criar o componente `RequireAuth`

**Files:**
- Create: `src/components/RequireAuth.tsx`

- [ ] **Step 1: Criar o arquivo com o componente completo**

Conteúdo exato de `src/components/RequireAuth.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-contrast">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `RequireAuth.tsx`.

Run: `npm run lint -- src/components/RequireAuth.tsx`
Expected: sem warnings/erros.

Se qualquer um falhar, corrigir antes de prosseguir.

- [ ] **Step 3: Commit**

```powershell
git add src/components/RequireAuth.tsx
git commit -m "feat(auth): add RequireAuth route guard component"
```

---

### Task 2: Envolver o layout do dashboard com `RequireAuth`

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

Conteúdo atual (`src/app/(dashboard)/layout.tsx`):

```tsx
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
import OneSignalInitializer from "@/components/OneSignalInitializer";
import AdminNotificationsButton from "@/components/AdminNotificationsButton";
import MobilePushPermissionGuide from "@/components/MobilePushPermissionGuide";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <ToastProvider>
        <OneSignalInitializer />
        <AdminNotificationsButton />
        <MobilePushPermissionGuide />
        <div className="min-h-screen bg-background">
          <MobileHeader />
          <Sidebar />
          <div className="min-w-0 pl-0 md:pl-64">
            <main className="min-w-0 overflow-x-clip p-4 md:p-8 pb-24 md:pb-8">{children}</main>
          </div>
          <MobileNav />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
```

Novo conteúdo (adiciona import + envolve tudo dentro do `ToastProvider` com `<RequireAuth>`):

```tsx
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
import OneSignalInitializer from "@/components/OneSignalInitializer";
import AdminNotificationsButton from "@/components/AdminNotificationsButton";
import MobilePushPermissionGuide from "@/components/MobilePushPermissionGuide";
import RequireAuth from "@/components/RequireAuth";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <ToastProvider>
        <RequireAuth>
          <OneSignalInitializer />
          <AdminNotificationsButton />
          <MobilePushPermissionGuide />
          <div className="min-h-screen bg-background">
            <MobileHeader />
            <Sidebar />
            <div className="min-w-0 pl-0 md:pl-64">
              <main className="min-w-0 overflow-x-clip p-4 md:p-8 pb-24 md:pb-8">{children}</main>
            </div>
            <MobileNav />
          </div>
        </RequireAuth>
      </ToastProvider>
    </AuthProvider>
  );
}
```

Diferenças entre os dois: (a) novo `import RequireAuth from "@/components/RequireAuth";`, (b) `<RequireAuth>...</RequireAuth>` envolvendo `OneSignalInitializer`, `AdminNotificationsButton`, `MobilePushPermissionGuide` e o `<div className="min-h-screen ...">`. Nada mais mudou.

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint -- src/app/(dashboard)/layout.tsx`
Expected: sem warnings/erros.

- [ ] **Step 3: Smoke test local (desktop)**

Run: `npm run dev`
Expected: server sobe sem erros.

No navegador (aba anônima recomendada):

1. Acessar `http://localhost:3000/dashboard/viagens` deslogado → deve redirecionar para `/login` sem piscar o dashboard.
2. Logar → deve carregar `/dashboard` normalmente com as corridas.
3. Fazer logout (se houver botão) → deve voltar para `/login`.

Se qualquer um dos três passos falhar, parar e diagnosticar antes de continuar.

- [ ] **Step 4: Commit**

```powershell
git add src/app/(dashboard)/layout.tsx
git commit -m "feat(auth): wrap dashboard layout with RequireAuth guard"
```

---

### Task 3: Adicionar aviso de reautenticação no `MobilePushPermissionGuide`

**Files:**
- Modify: `src/components/MobilePushPermissionGuide.tsx:104-109`

- [ ] **Step 1: Substituir o bloco de aviso do iOS**

Trecho atual (linhas 104-109):

```tsx
          {platform === "ios" && !isStandalone && (
            <p className="mt-2 text-xs leading-5 text-warning">
              No iPhone, notificações web só funcionam depois de adicionar o
              painel à Tela de Início e abrir pelo ícone instalado.
            </p>
          )}
```

Substituir por (mantém a mensagem original e acrescenta um segundo parágrafo sobre reautenticação):

```tsx
          {platform === "ios" && !isStandalone && (
            <>
              <p className="mt-2 text-xs leading-5 text-warning">
                No iPhone, notificações web só funcionam depois de adicionar o
                painel à Tela de Início e abrir pelo ícone instalado.
              </p>
              <p className="mt-2 text-xs leading-5 text-contrast">
                Ao abrir o app pelo ícone pela primeira vez, será necessário
                fazer login novamente — o iPhone isola os dados do app
                instalado do navegador, não é um bug.
              </p>
            </>
          )}
```

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint -- src/components/MobilePushPermissionGuide.tsx`
Expected: sem warnings/erros.

- [ ] **Step 3: Commit**

```powershell
git add src/components/MobilePushPermissionGuide.tsx
git commit -m "feat(pwa): warn iOS users about reauth after adding to home screen"
```

---

### Task 4: Verificação final antes de teste no iPhone

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros. Se houver aviso novo relacionado aos arquivos alterados, corrigir.

- [ ] **Step 2: Smoke test do build local**

Run: `npm start`
Repetir os três passos do smoke test da Task 2 no build de produção (aba anônima, redirect deslogado, login funciona, logout redireciona).

- [ ] **Step 3: Deploy do preview (ou combinar com o usuário)**

**Não faça deploy sozinho.** Informar o usuário que o build está pronto e perguntar como ele quer testar no iPhone real (preview URL, staging, deploy direto). Aguardar instrução.

---

### Task 5: Checklist de teste manual no iPhone (executado com o usuário)

Este checklist é o critério de aceite. Executar junto com o usuário no dispositivo real.

**Cenário A — Bug original corrigido:**

- [ ] Desinstalar qualquer PWA da KZ da tela de início (se houver).
- [ ] Abrir o painel no Safari e fazer login.
- [ ] Confirmar que o dashboard carrega e as corridas aparecem no Safari.
- [ ] Compartilhar → Adicionar à Tela de Início.
- [ ] Fechar o Safari completamente.
- [ ] Abrir o app pelo ícone da tela de início.
- [ ] **Esperado:** vai direto para a tela de login (não fica preso em dashboard vazio).
- [ ] Fazer login pelo PWA.
- [ ] **Esperado:** dashboard carrega com todas as corridas.
- [ ] Fechar o PWA (swipe up) e reabrir.
- [ ] **Esperado:** entra direto no dashboard, sessão persistiu.

**Cenário B — Aviso aparece corretamente:**

- [ ] Como admin logado no Safari mobile (iPhone), abrir o painel.
- [ ] Confirmar que o card "Ative as notificações" mostra AMBOS os parágrafos: o de instalar na Tela de Início E o de precisar fazer login novamente.

**Cenário C — Desktop segue funcionando:**

- [ ] Testar no Chrome/Edge desktop: login, logout, acesso deslogado redireciona para `/login`.
- [ ] Testar em uma sessão já autenticada: recarregar `/dashboard/viagens` NÃO deve mostrar loader por mais que 1 segundo antes de exibir os dados.

Se algum dos cenários falhar, abrir issue e reabrir o plano.

---

## Notas para o executor

- Este plano **não modifica migrations nem estrutura de banco.** Nenhum SQL para o usuário rodar.
- Não migrar para `@supabase/ssr` (cookies) — foi descartado no spec.
- Não mexer no `manifest.webmanifest` — foi descartado no spec.
- Se durante a implementação você notar algo estranho no `AuthProvider` (ex.: `loading` que nunca vira `false`), **não corrija junto**. Anote e reporte separadamente — está fora do escopo deste plano.
