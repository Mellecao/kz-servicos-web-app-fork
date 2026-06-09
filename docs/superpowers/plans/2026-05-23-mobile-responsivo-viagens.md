# Mobile Responsivo — Viagens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir responsividade mobile na página de Viagens: botão "Nova Viagem", lista de cards, e modal de detalhes.

**Architecture:** Três mudanças independentes — (1) classe CSS no botão, (2) lógica de filtragem + remoção de botões de ação no `KanbanListView`, (3) layout responsivo breakpoint-driven no `TripDetailModal`. Nenhuma nova dependência, nenhum novo arquivo.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS

---

## File Map

| Arquivo | Mudança |
|---------|---------|
| `src/app/(dashboard)/viagens/page.tsx` | Botão "Nova Viagem": `whitespace-nowrap` + padding responsivo |
| `src/components/KanbanListView.tsx` | Remover botão de ação; filtrar `cancelled` da aba "Todas" |
| `src/components/TripDetailModal.tsx` | Layout full-screen no mobile via breakpoints Tailwind |

---

## Task 1: Botão "Nova Viagem" — sem quebra de linha no mobile

**Files:**
- Modify: `src/app/(dashboard)/viagens/page.tsx:177-181`

- [ ] **Step 1: Localizar o botão na página**

Abrir `src/app/(dashboard)/viagens/page.tsx`. O botão está em torno da linha 177:

```tsx
<button
  onClick={() => setShowForm(true)}
  className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer"
>
  + Nova Viagem
</button>
```

- [ ] **Step 2: Substituir className do botão**

Trocar o `className` para adicionar `whitespace-nowrap` e padding responsivo:

```tsx
<button
  onClick={() => setShowForm(true)}
  className="bg-primary text-background px-3 py-2 md:px-5 md:py-2.5 rounded-lg font-heading font-bold text-xs md:text-sm whitespace-nowrap hover:bg-primary-dark transition-colors duration-200 cursor-pointer"
>
  + Nova Viagem
</button>
```

- [ ] **Step 3: Verificar no browser**

Rodar `npm run dev` e abrir `/viagens` no mobile (DevTools → toggle device toolbar, 390px de largura). O botão deve exibir "+ Nova Viagem" em uma linha, sem quebra.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/viagens/page.tsx
git commit -m "fix(mobile): prevent Nova Viagem button text wrap"
```

---

## Task 2: KanbanListView — remover botões de ação e filtrar canceladas

**Files:**
- Modify: `src/components/KanbanListView.tsx:106-122` (CardItem — botões de ação)
- Modify: `src/components/KanbanListView.tsx:136-144` (filtro da aba "Todas")

### Parte A — Remover botões de ação

- [ ] **Step 1: Localizar os botões de ação no CardItem**

Em `KanbanListView.tsx`, o `CardItem` tem um bloco `{/* Action buttons */}` por volta da linha 105:

```tsx
{/* Action buttons */}
<div className="flex gap-2 mt-3">
  <button
    onClick={() => onCardClick?.(card)}
    className="flex-1 text-xs py-2 rounded-lg bg-surface border border-border text-dark font-medium hover:bg-background transition-colors"
  >
    Ver detalhes
  </button>
  {column.actionLabel && column.nextColumnId && (
    <button
      onClick={() => onMoveCard(card.id, column.id, column.nextColumnId!)}
      className="flex-1 text-xs py-2 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity"
    >
      {column.actionLabel} →
    </button>
  )}
</div>
```

- [ ] **Step 2: Substituir o bloco de botões**

Remover o botão de ação secundário. "Ver detalhes" passa a ocupar a largura total:

```tsx
{/* Action buttons */}
<div className="mt-3">
  <button
    onClick={() => onCardClick?.(card)}
    className="w-full text-xs py-2 rounded-lg bg-surface border border-border text-dark font-medium hover:bg-background transition-colors"
  >
    Ver detalhes
  </button>
</div>
```

### Parte B — Filtrar canceladas da aba "Todas"

- [ ] **Step 3: Localizar a lógica de filtro**

Em `KanbanListView.tsx`, no componente principal `KanbanListView`, por volta da linha 133:

```tsx
// Flatten all cards, keeping track of which column they belong to
const allCards = columns.flatMap((col) =>
  col.cards.map((card) => ({ card, column: col }))
);

// Filter by selected status
const filtered =
  selectedStatus === "all"
    ? allCards
    : allCards.filter(({ column }) => column.id === selectedStatus);
```

- [ ] **Step 4: Atualizar o filtro para excluir canceladas em "Todas"**

```tsx
// Flatten all cards, keeping track of which column they belong to
const allCards = columns.flatMap((col) =>
  col.cards.map((card) => ({ card, column: col }))
);

// Filter by selected status — "all" excludes cancelled (see "Canceladas" tab)
const filtered =
  selectedStatus === "all"
    ? allCards.filter(({ column }) => column.id !== "cancelled")
    : allCards.filter(({ column }) => column.id === selectedStatus);
```

- [ ] **Step 5: Verificar no browser**

No DevTools (390px), abrir `/viagens`:
- Aba "Todas": nenhuma viagem com badge "Cancelada" deve aparecer
- Aba "Cancelada": viagens canceladas aparecem normalmente
- Cada card tem apenas o botão "Ver detalhes" (largura total), sem botão amarelo

- [ ] **Step 6: Commit**

```bash
git add src/components/KanbanListView.tsx
git commit -m "fix(mobile): remove action buttons from list view; hide cancelled from Todas tab"
```

---

## Task 3: TripDetailModal — full-screen responsivo no mobile

**Files:**
- Modify: `src/components/TripDetailModal.tsx:399-829`

O modal tem quatro problemas no mobile:
1. `style={{ minWidth: "600px" }}` causa overflow horizontal
2. `style={{ width: "70vw" }}` em tela de 390px = 273px, mas `minWidth` ganha e corta
3. Layout `flex-row` com colunas 65%/35% não funciona em tela estreita
4. Botão de fechar (X) no canto direito — no mobile full-screen, seta ← à esquerda é mais intuitivo

### Passo a passo

- [ ] **Step 1: Substituir o div do modal (remover inline styles de tamanho)**

Localizar (~410-422):
```tsx
<div
  ref={contentRef}
  role="dialog"
  aria-modal="true"
  aria-label={route}
  className="relative bg-surface border border-border rounded-xl flex flex-col"
  style={{
    width: "70vw",
    minWidth: "600px",
    maxHeight: "90vh",
    animation: "modal-in 300ms ease-out forwards",
  }}
>
```

Substituir por (manter apenas a animação no `style`):
```tsx
<div
  ref={contentRef}
  role="dialog"
  aria-modal="true"
  aria-label={route}
  className="relative bg-surface border-0 md:border border-border rounded-none md:rounded-xl flex flex-col w-full h-full md:w-[70vw] md:min-w-[600px] md:h-auto md:max-h-[90vh] overflow-hidden"
  style={{ animation: "modal-in 300ms ease-out forwards" }}
>
```

- [ ] **Step 2: Atualizar o header — botão ← no mobile, X no desktop**

Localizar o header (~423-441):
```tsx
{/* Header */}
<div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
  <div className="min-w-0 flex-1 mr-4">
    <h2 className="text-lg font-heading font-black text-dark leading-tight truncate">
      {route}
    </h2>
    <p className="text-sm text-contrast font-body mt-0.5">{passengerName}</p>
  </div>
  <button
    onClick={handleClose}
    className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer shrink-0"
    aria-label="Fechar"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
</div>
```

Substituir por:
```tsx
{/* Header */}
<div className="flex items-center gap-3 px-4 md:px-6 pt-4 md:pt-5 pb-4 border-b border-border shrink-0">
  {/* Botão voltar — mobile apenas */}
  <button
    onClick={handleClose}
    className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer shrink-0"
    aria-label="Voltar"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  </button>

  <div className="min-w-0 flex-1">
    <h2 className="text-lg font-heading font-black text-dark leading-tight truncate">
      {route}
    </h2>
    <p className="text-sm text-contrast font-body mt-0.5">{passengerName}</p>
  </div>

  {/* Botão fechar — desktop apenas */}
  <button
    onClick={handleClose}
    className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer shrink-0"
    aria-label="Fechar"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
</div>
```

- [ ] **Step 3: Atualizar o body container (flex-col no mobile, flex-row no desktop)**

Localizar (~449):
```tsx
<div className="flex flex-1 overflow-hidden">
```

Substituir por:
```tsx
<div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
```

- [ ] **Step 4: Atualizar a coluna esquerda**

Localizar (~451):
```tsx
<div className="overflow-y-auto px-6 py-5 border-r border-border" style={{ width: "65%" }}>
```

Substituir por (remover inline style de width, usar Tailwind):
```tsx
<div className="px-4 md:px-6 py-5 md:border-r border-border md:overflow-y-auto md:w-[65%]">
```

- [ ] **Step 5: Atualizar a coluna direita**

Localizar (~541):
```tsx
<div className="overflow-y-auto px-5 py-5 flex flex-col gap-0" style={{ width: "35%" }}>
```

Substituir por:
```tsx
<div className="border-t md:border-t-0 border-border px-4 md:px-5 py-5 flex flex-col gap-0 md:overflow-y-auto md:w-[35%]">
```

- [ ] **Step 6: Verificar no browser — mobile**

No DevTools (390px), abrir `/viagens` e clicar em qualquer card:
- Modal ocupa 100% da tela (sem corte lateral)
- Header mostra seta ← à esquerda com título
- Conteúdo rola verticalmente (Informações → Motoristas Candidatos → Histórico → Área Financeira)
- Nenhum conteúdo cortado

- [ ] **Step 7: Verificar no browser — desktop**

Voltar para largura > 768px (ou desativar device toolbar):
- Modal mantém layout de 2 colunas (65%/35%)
- Botão X aparece no canto direito do header
- Seta ← não aparece
- Scroll independente por coluna funciona

- [ ] **Step 8: Commit**

```bash
git add src/components/TripDetailModal.tsx
git commit -m "fix(mobile): make TripDetailModal full-screen on mobile with stacked layout"
```

---

## Verificação Final

- [ ] **Smoke test completo no mobile (390px):**
  - [ ] Botão "+ Nova Viagem" em uma linha
  - [ ] Aba "Todas" sem viagens canceladas
  - [ ] Aba "Cancelada" com viagens canceladas
  - [ ] Cards com apenas botão "Ver detalhes" (largura total)
  - [ ] Modal de detalhes full-screen, sem corte, com scroll
  - [ ] Botão voltar (←) funciona e fecha o modal

- [ ] **Smoke test no desktop (1280px):**
  - [ ] Botão "+ Nova Viagem" normal
  - [ ] Cards com layout original
  - [ ] Modal com 2 colunas, bordas arredondadas, botão X
