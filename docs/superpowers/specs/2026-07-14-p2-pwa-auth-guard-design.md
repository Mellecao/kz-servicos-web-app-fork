# P2 — Guard de rota para PWA instalado no iPhone

**Data:** 2026-07-14
**Autor:** Claude (kz-dev)
**Status:** Aprovado para implementação

## Problema

Ao abrir o painel admin da KZ pelo iPhone (Safari) e usar **Compartilhar → Adicionar à Tela de Início**, o painel "buga" quando o usuário abre o app pelo ícone instalado: todas as corridas somem da tela de Viagens e a interface fica em branco/vazia. A única solução hoje é fazer logoff e login novamente dentro do PWA.

## Causa raiz

Duas condições combinadas:

1. **Persistência de sessão em `localStorage` puro.** `src/lib/supabase.ts:6` cria o client com `createClient(url, anonKey)` sem opções — o default do `@supabase/supabase-js` v2 é gravar o token em `localStorage`.
2. **Ausência de guard de rota.** `src/app/(dashboard)/layout.tsx` envolve o dashboard com `AuthProvider` mas nunca verifica se `session === null` para redirecionar. O `AuthProvider` (`src/lib/auth-context.tsx`) apenas carrega a sessão e escuta `onAuthStateChange`.

**Sequência do bug:**
1. Usuário loga no Safari → sessão gravada em `localStorage` do contexto Safari-tab.
2. "Adicionar à Tela de Início" → iOS cria o atalho, mas quando o PWA é aberto pelo ícone o sistema instancia um contexto de armazenamento **isolado** (restrição do iOS — não é bug do Supabase nem do Next.js).
3. No contexto isolado, `localStorage` vem vazio. `getSession()` retorna `null`.
4. Sem guard, `/dashboard/viagens` renderiza mesmo assim.
5. `fetchTrips()` executa sem JWT → RLS bloqueia → array vazio.
6. Usuário vê dashboard "furado". Logoff+login funciona porque autentica **dentro** do contexto do PWA, gravando a sessão no `localStorage` do PWA.

Transferir sessão entre Safari e PWA no iOS não é possível — nenhuma abordagem client-side resolve isso. A única correção correta é forçar login quando não há sessão.

## Design

### Componente novo: `RequireAuth`

**Arquivo:** `src/components/RequireAuth.tsx`

Client component que envolve páginas autenticadas. Consome `useAuth()`:

- Enquanto `loading === true` → renderiza um loader minimalista (mesma paleta do app, sem layout shift).
- Quando `loading === false && session === null` → chama `router.replace('/login')` em `useEffect` e renderiza `null` durante o redirect.
- Caso contrário → renderiza `children`.

Usa `router.replace` (não `push`) para não deixar a rota protegida no histórico.

### Alteração em `src/app/(dashboard)/layout.tsx`

Envolver **tudo** (Sidebar, MobileHeader, MobileNav, OneSignalInitializer, AdminNotificationsButton, MobilePushPermissionGuide e `{children}`) com `<RequireAuth>` dentro do `AuthProvider`. Motivo: evita que o chrome do dashboard pisque na tela antes do redirect para `/login`. O `ToastProvider` fica por fora do guard para não perder toasts entre transições.

Estrutura final:

```tsx
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
```

### Alteração em `src/components/MobilePushPermissionGuide.tsx`

O componente já detecta iOS + standalone e mostra instruções para adicionar à tela de início. Adicionar um bloco de aviso ao final das instruções iOS:

> ⚠️ **Após instalar, será necessário fazer login novamente no app.** O iPhone isola os dados do app instalado do navegador — é uma proteção do próprio sistema, não é um bug.

Texto exato pode ser ajustado durante a implementação para casar com o tom já existente no componente.

### Sem alterações no `manifest.webmanifest`

`start_url: "/dashboard"` continua correto — o guard redireciona para login quando necessário.

### Sem alterações no `supabase.ts`

Não migramos para `@supabase/ssr` (cookies) — cookies também não são herdados entre Safari e PWA no iOS, e a migração forçaria refactor grande em todo o app (middleware, server clients, etc.) sem resolver o problema.

## Data flow

```
Usuário abre PWA
  ↓
AuthProvider monta → getSession() → null (localStorage vazio)
  ↓
AuthProvider: loading=false, session=null
  ↓
RequireAuth vê session=null → router.replace('/login')
  ↓
Usuário loga → onAuthStateChange dispara SIGNED_IN
  ↓
AuthProvider: session=<valid>
  ↓
RequireAuth renderiza children → dashboard carrega normalmente
  ↓
Sessão gravada no localStorage do PWA (contexto próprio)
  ↓
Próximas aberturas do PWA já entram direto no dashboard
```

## Edge cases cobertos

- **Loading inicial:** não redireciona antes de saber se há sessão (evita flash de login).
- **Logout em runtime:** `onAuthStateChange` marca `session=null` → guard redireciona.
- **Expiração de sessão em runtime:** mesmo caminho do logout — cobertura de bônus, não só o caso PWA.
- **Usuário desktop:** comportamento inalterado (sessão persiste normalmente).
- **`/login` acessível:** rota fica fora do `(dashboard)` group, então não é protegida.

## Testes

**Sem teste automatizado nesta iteração** (decisão explícita do usuário — validação manual no dispositivo real).

### Checklist de teste manual (iPhone Safari)

1. Desinstalar qualquer PWA da KZ da tela de início (se houver).
2. Abrir `https://<url-do-painel>` no Safari.
3. Fazer login normalmente. Confirmar que o dashboard carrega e as corridas aparecem.
4. Compartilhar → Adicionar à Tela de Início.
5. Fechar o Safari.
6. Abrir o app pelo ícone da tela de início.
   - **Esperado:** vai direto para a tela de login (não fica preso em dashboard vazio).
7. Fazer login pelo PWA.
   - **Esperado:** dashboard carrega com todas as corridas.
8. Fechar o PWA (swipe up) e reabrir.
   - **Esperado:** entra direto no dashboard, sessão persistiu no `localStorage` do PWA.

### Checklist de teste manual (desktop)

1. Abrir o painel no Chrome/Edge/Firefox.
2. Confirmar que o comportamento de login permanece inalterado.
3. Fazer logout → deve ir para `/login`.
4. Tentar acessar `/dashboard/viagens` deslogado → deve redirecionar para `/login`.

## SQL

**Nenhum.** P2 é 100% frontend.

## Fora do escopo

- Migração para `@supabase/ssr` (cookies) — descartada por não resolver o problema no iOS.
- Handoff de sessão Safari → PWA via URL token — descartado por ser frágil no iOS (sem `beforeinstallprompt`).
- Melhorias de UX no fluxo de instalação além do aviso adicional — podem entrar em iteração futura.
- Tratamento de "sessão expirada" com mensagem específica ao usuário — o redirect direto já resolve; melhorar a UX pode entrar em iteração futura.
