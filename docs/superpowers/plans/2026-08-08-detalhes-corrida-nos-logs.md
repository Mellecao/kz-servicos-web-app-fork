# Detalhes da Corrida ao Clicar num Log (Admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar numa linha de log em `/logs` (painel admin) cujo `entity_id` aponte para uma viagem, abrir o `TripDetailModal` já existente com os detalhes completos da corrida.

**Architecture:** Extrai um helper puro `isLogClickable` (testável via `node --test`) que decide se uma linha de log tem `entity_id` e portanto é clicável. A página `src/app/(dashboard)/logs/page.tsx` ganha um handler que chama `fetchTripById` (já existe em `src/lib/api.ts`) sob demanda ao clicar, e renderiza `TripDetailModal` (já existe em `src/components/TripDetailModal.tsx`) seguindo exatamente o mesmo padrão de estado (`selectedTrip` + `open={!!selectedTrip}`) usado em `src/app/(dashboard)/viagens/page.tsx:460-465`. Erros de busca (viagem não encontrada) disparam um toast de aviso via `useToast`. Nenhuma migration ou mudança de tipo é necessária.

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript, Supabase JS client, `node:test` (via `node --test`, Node 24 com suporte nativo a TS).

**Pré-descobertas confirmadas antes deste plano:**

- `fetchTripById(id: string): Promise<Trip>` já existe em `src/lib/api.ts:327` — lança erro (via PostgREST `.single()`) quando a viagem não existe. Não precisa ser criada.
- `TripDetailModal` (`src/components/TripDetailModal.tsx:153`) já recarrega os próprios dados via `fetchTripById` internamente (efeito em `TripDetailModal.tsx:293-314`); basta passar a `trip` inicial buscada.
- Padrão de uso do modal, confirmado em `src/app/(dashboard)/viagens/page.tsx:460-465`:
  ```tsx
  <TripDetailModal
    trip={selectedTrip}
    open={!!selectedTrip}
    onClose={() => setSelectedTrip(null)}
    onUpdate={loadTrips}
  />
  ```
  Não existe (nem é necessário) um state booleano separado tipo `modalOpen` — `open` é derivado de `selectedTrip !== null`.
- `useToast` (`src/components/Toast.tsx:27`) expõe `toast(type: "success"|"info"|"warning"|"danger", message: string)`. O `ToastProvider` já envolve as rotas de `(dashboard)`, então `LogsPage` pode usar `useToast` sem setup adicional.
- `AdminLog` (`src/types/database.ts:489-499`) tem `entity_id: string | null`.
- Convenção de testes deste repo: lógica pura vai em `src/lib/*.ts` com teste irmão `*.test.ts` usando `node:assert/strict` + `node:test`, rodado com `node --test caminho/arquivo.test.ts`. Mudanças só-de-JSX/wiring não ganham teste automatizado — são verificadas com `npm run build` + checklist manual no browser (ver precedente em `docs/superpowers/plans/2026-07-29-subprojeto-2b-escolha-seu-motorista-plan.md` Task 18).
- Arquivo atual `src/app/(dashboard)/logs/page.tsx` tem 162 linhas; conteúdo integral já lido e reproduzido nos steps abaixo.

**Ordem das tasks:** Task 1 (helper puro) não depende de nada. Task 2 (wiring da página) depende do helper da Task 1. Task 3 (verificação manual) depende da Task 2.

---

## File Structure

```
src/lib/admin-log-utils.ts                  # NEW — isLogClickable(log)
src/lib/admin-log-utils.test.ts             # NEW — testes de isLogClickable
src/app/(dashboard)/logs/page.tsx           # MODIFY — click handler + render do TripDetailModal
```

---

## Task 1: Helper puro `isLogClickable`

**Files:**
- Create: `src/lib/admin-log-utils.ts`
- Create: `src/lib/admin-log-utils.test.ts`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/admin-log-utils.test.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { isLogClickable } from "./admin-log-utils.ts";

test("isLogClickable returns true when entity_id is present", () => {
  assert.equal(isLogClickable({ entity_id: "abc-123" }), true);
});

test("isLogClickable returns false when entity_id is null", () => {
  assert.equal(isLogClickable({ entity_id: null }), false);
});

test("isLogClickable returns false when entity_id is an empty string", () => {
  assert.equal(isLogClickable({ entity_id: "" }), false);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test src/lib/admin-log-utils.test.ts`
Expected: FAIL — `Cannot find module './admin-log-utils.ts'` (arquivo ainda não existe).

- [ ] **Step 3: Implementação mínima**

Criar `src/lib/admin-log-utils.ts`:

```typescript
export function isLogClickable(log: { entity_id: string | null }): boolean {
  return log.entity_id !== null && log.entity_id !== "";
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test src/lib/admin-log-utils.test.ts`
Expected: PASS — 3 testes, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-log-utils.ts src/lib/admin-log-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(logs): adiciona isLogClickable para identificar logs com entity_id

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wiring da página `/logs`

**Files:**
- Modify: `src/app/(dashboard)/logs/page.tsx`

Working directory: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`

O arquivo atual (162 linhas) será substituído integralmente pelo conteúdo abaixo. As mudanças em relação ao original:
- Imports: adiciona `fetchTripById`, `Trip`, `TripDetailModal`, `useToast`, `isLogClickable`.
- Novo state: `selectedTrip`, `loadingLogId`; novo `const { toast } = useToast();`.
- Novo handler `handleLogClick`.
- Cada linha de log clicável (`isLogClickable(log)`) agora é um `<button>` em vez de `<div>`, com hover e `disabled` durante o carregamento; o `entity_id` mostra "Carregando..." enquanto busca.
- Renderiza `<TripDetailModal>` no fim, seguindo o padrão de `viagens/page.tsx`.

- [ ] **Step 1: Sobrescrever `src/app/(dashboard)/logs/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAdminLogs, fetchTripById } from "@/lib/api";
import TripDetailModal from "@/components/TripDetailModal";
import { useToast } from "@/components/Toast";
import { isLogClickable } from "@/lib/admin-log-utils";
import type { AdminLog, Trip } from "@/types/database";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionColor(action: string): { bg: string; text: string } {
  if (action.includes("cancelada") || action.includes("removida") || action.includes("removido")) {
    return { bg: "#ef444420", text: "#ef4444" };
  }
  if (action.includes("aprovada") || action.includes("aprovado") || action.includes("selecionado")) {
    return { bg: "#22c55e20", text: "#22c55e" };
  }
  if (action.includes("recusada")) {
    return { bg: "#f9731620", text: "#f97316" };
  }
  return { bg: "#2261FE20", text: "#2261FE" };
}

function DetailsBadge({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-surface-hover border border-border text-contrast"
        >
          <span className="font-medium text-dark">{key}:</span>
          <span>{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);

  const loadLogs = useCallback(() => {
    setLoading(true);
    fetchAdminLogs()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 30_000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const handleLogClick = useCallback(
    async (log: AdminLog) => {
      if (!isLogClickable(log) || loadingLogId) return;
      setLoadingLogId(log.id);
      try {
        const trip = await fetchTripById(log.entity_id as string);
        setSelectedTrip(trip);
      } catch {
        toast("warning", "Não foi possível encontrar os detalhes desta corrida.");
      } finally {
        setLoadingLogId(null);
      }
    },
    [toast, loadingLogId],
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Logs de Atividade</h1>
          <p className="text-contrast text-sm mt-1">Ações administrativas das últimas 24 horas</p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-contrast hover:text-dark hover:bg-surface-hover transition-colors text-sm font-medium cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9" />
            <polyline points="3 4 3 10 9 10" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">Carregando logs...</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-border">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-contrast text-sm">Nenhuma ação registrada nas últimas 24 horas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const color = actionColor(log.action);
            const clickable = isLogClickable(log);
            const isLoadingRow = loadingLogId === log.id;
            const rowClassName = `bg-surface border border-border rounded-xl px-5 py-4${
              clickable
                ? " w-full text-left transition-colors hover:border-primary/40 hover:bg-background cursor-pointer disabled:cursor-wait disabled:opacity-70"
                : ""
            }`;

            const rowContent = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Action badge */}
                    <span
                      className="flex-shrink-0 mt-0.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {log.action}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <span className="flex-shrink-0 text-xs text-contrast whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </span>
                </div>

                {/* Admin + entity */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-contrast">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="font-medium text-dark">{log.admin?.full_name ?? "Admin"}</span>
                    {log.admin?.email && (
                      <span className="text-xs text-contrast/70">({log.admin.email})</span>
                    )}
                  </div>

                  {log.entity_id && (
                    <div className="flex items-center gap-1.5 text-contrast">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                      <span className="font-mono text-xs text-contrast/70 truncate max-w-[180px]">
                        {isLoadingRow ? "Carregando..." : log.entity_id}
                      </span>
                    </div>
                  )}
                </div>

                <DetailsBadge details={log.details} />
              </>
            );

            if (clickable) {
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => handleLogClick(log)}
                  disabled={isLoadingRow}
                  className={rowClassName}
                >
                  {rowContent}
                </button>
              );
            }

            return (
              <div key={log.id} className={rowClassName}>
                {rowContent}
              </div>
            );
          })}
        </div>
      )}

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        onUpdate={loadLogs}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npm run build`
Expected: build conclui sem erros de tipo (o `Trip` retornado por `fetchTripById` bate com `TripDetailModalProps.trip`).

- [ ] **Step 3: Rodar lint**

Run: `npm run lint`
Expected: sem erros novos em `src/app/(dashboard)/logs/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/logs/page.tsx"
git commit -m "$(cat <<'EOF'
feat(logs): abre detalhes da corrida ao clicar num log de viagem

- Linhas de log com entity_id ficam clicaveis e chamam fetchTripById sob demanda
- Abre TripDetailModal (mesmo componente usado em /viagens) com a corrida
- Toast de aviso quando a corrida nao e encontrada (excluida ou nao-viagem)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verificação manual (E2E)

Não há testes automatizados de componente neste repo (sem React Testing Library / jsdom configurados). Validar manualmente:

- [ ] **Step 1: Subir o servidor de dev**

Run: `npm run dev`

- [ ] **Step 2: Verificar log de viagem existente**

Abrir `http://localhost:3000/logs` (ou porta indicada), logado como admin. Encontrar um log cujo `entity_id` corresponda a uma viagem existente em `/viagens`. Clicar na linha.
Expected: linha mostra "Carregando..." brevemente, depois o `TripDetailModal` abre com os dados corretos da viagem (endereços, status, cliente, etc.).

- [ ] **Step 3: Verificar log de viagem excluída**

Encontrar (ou provocar) um log do tipo "Viagem excluída" cujo `entity_id` não existe mais em `trips`. Clicar na linha.
Expected: toast de aviso "Não foi possível encontrar os detalhes desta corrida." aparece; nenhum modal abre.

- [ ] **Step 4: Verificar log sem entity_id**

Encontrar um log sem `entity_id` (badge de localização não aparece na linha).
Expected: a linha não tem cursor pointer/hover e não reage ao clique.

- [ ] **Step 5: Verificar atualização após ação no modal**

Com o modal aberto (Step 2), executar uma ação simples (ex.: aprovar/recusar, se o status permitir) e fechar o modal.
Expected: a lista de logs recarrega e mostra a nova entrada de log gerada pela ação.

- [ ] **Step 6: Fechar o loop**

Nenhum commit nesta task — é só verificação. Se algum passo falhar, voltar à Task correspondente, corrigir, e repetir a verificação.

---

## Self-Review

**1. Cobertura do spec** (`docs/superpowers/specs/2026-08-08-detalhes-corrida-nos-logs-design.md`):
- Linhas clicáveis com `entity_id` → Task 2, Step 1 (`isLogClickable` + `<button>`). ✅
- `fetchTripById` reaproveitado, sem mudança em `api.ts` → confirmado, não modificado. ✅
- Toast de aviso em caso de erro → Task 2, Step 1 (`catch { toast(...) }`). ✅
- `onUpdate={loadLogs}` → Task 2, Step 1. ✅
- Loading state por linha → `loadingLogId` + texto "Carregando...". ✅
- Linhas sem `entity_id` continuam não clicáveis → `clickable` ternário mantém `<div>`. ✅
- Plano de testes manuais do spec → Task 3 replica os 6 cenários do spec. ✅

**2. Placeholder scan:** Nenhum "TBD"/"TODO"/"implementar depois" encontrado nos steps.

**3. Consistência de tipos:** `isLogClickable(log: { entity_id: string | null })` aceita `AdminLog` estruturalmente (TypeScript structural typing) sem import extra. `fetchTripById` retorna `Trip`, que é o tipo esperado por `TripDetailModalProps.trip`. Nomes de state (`selectedTrip`, `loadingLogId`) usados de forma consistente entre Step 1 e os steps de verificação.
