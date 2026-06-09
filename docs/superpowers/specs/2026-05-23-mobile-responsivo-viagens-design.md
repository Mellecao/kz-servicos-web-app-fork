# Design: Responsivo Mobile — Página de Viagens

**Data:** 2026-05-23  
**Escopo:** Melhorias de responsividade mobile na página `/viagens` e componentes relacionados  
**Arquivos afetados:**
- `src/app/(dashboard)/viagens/page.tsx`
- `src/components/KanbanListView.tsx`
- `src/components/TripDetailModal.tsx`

---

## Contexto

A aba de Viagens no mobile apresenta quatro problemas identificados via screenshots:

1. Botão "Nova Viagem" quebra linha no mobile (texto não cabe no espaço disponível)
2. Cards na lista exibem botões de ação (ex: "Finalizar →") que não devem existir — só "Ver detalhes"
3. Viagens canceladas aparecem na aba "Todas" da lista — devem aparecer apenas na aba "Canceladas"
4. `TripDetailModal` usa `minWidth: 600px` fixo e layout de 2 colunas, causando corte da tela no mobile

---

## Solução: CSS Breakpoints com Tailwind (opção A)

Abordagem: usar classes Tailwind responsivas (`sm:`, `md:`) para alternar comportamento. Sem lógica JS, sem componentes duplicados, sem mudanças de rota.

---

## Mudanças por Arquivo

### 1. `viagens/page.tsx` — Botão "Nova Viagem"

**Problema:** botão sem `whitespace-nowrap`, padding largo demais para mobile.

**Solução:** adicionar `whitespace-nowrap` e reduzir padding/fonte no mobile com classes responsivas.

```tsx
// Antes
className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm ..."

// Depois
className="bg-primary text-background px-3 py-2 md:px-5 md:py-2.5 rounded-lg font-heading font-bold text-xs md:text-sm whitespace-nowrap ..."
```

---

### 2. `KanbanListView.tsx` — Remover botões de ação

**Problema:** botão de ação (`column.actionLabel`) aparece ao lado de "Ver detalhes" em todos os cards.

**Decisão:** remover o botão de ação completamente da list view. A list view é a view padrão do mobile; as ações de transição de status estão disponíveis no modal de detalhes. O botão de ação foi concebido para acesso rápido via board/desktop — na lista, o fluxo correto é abrir o modal.

**Solução:**
```tsx
// Antes (CardItem)
<div className="flex gap-2 mt-3">
  <button onClick={() => onCardClick?.(card)}>Ver detalhes</button>
  {column.actionLabel && column.nextColumnId && (
    <button onClick={() => onMoveCard(...)}>
      {column.actionLabel} →
    </button>
  )}
</div>

// Depois
<div className="mt-3">
  <button
    onClick={() => onCardClick?.(card)}
    className="w-full text-xs py-2 rounded-lg bg-surface border border-border text-dark font-medium hover:bg-background transition-colors"
  >
    Ver detalhes
  </button>
</div>
```

O botão "Ver detalhes" passa a ocupar a largura total (`w-full`) para área de toque adequada no mobile.

---

### 3. `KanbanListView.tsx` — Filtrar canceladas da aba "Todas"

**Problema:** `allCards` inclui viagens canceladas na aba "Todas".

**Solução:** filtrar `cancelled` ao construir `allCards` quando `selectedStatus === 'all'`. A aba "Canceladas" continua mostrando tudo normalmente.

```tsx
// Antes
const allCards = columns.flatMap((col) =>
  col.cards.map((card) => ({ card, column: col }))
);

const filtered =
  selectedStatus === "all"
    ? allCards
    : allCards.filter(({ column }) => column.id === selectedStatus);

// Depois
const allCards = columns.flatMap((col) =>
  col.cards.map((card) => ({ card, column: col }))
);

const filtered =
  selectedStatus === "all"
    ? allCards.filter(({ column }) => column.id !== "cancelled")
    : allCards.filter(({ column }) => column.id === selectedStatus);
```

---

### 4. `TripDetailModal.tsx` — Responsivo full-screen no mobile

**Problema:** `style={{ width: "70vw", minWidth: "600px" }}` causa overflow no mobile. Layout `flex-row` com colunas de 65%/35% não funciona em telas estreitas.

**Solução:** usar Tailwind para adaptar o modal por breakpoint:

**Container do modal (mobile → desktop):**
- Mobile: `fixed inset-0 rounded-none` (tela cheia, sem bordas arredondadas)  
- Desktop `md:`: `relative inset-auto rounded-xl w-[70vw] min-w-[600px] max-h-[90vh]`

**Layout do body (mobile → desktop):**
- Mobile: `flex-col` — colunas empilhadas, scroll vertical único  
- Desktop `md:`: `flex-row` — mantém layout atual de 2 colunas com scroll independente

**Header no mobile:**
- Botão de fechar vira seta "←" (ícone de voltar) à esquerda, mais intuitivo para tela cheia

**Coluna esquerda no mobile:**
- Remove a borda direita (`border-r`) e ajusta padding
- `overflow-y-visible` pois o scroll é do container pai

**Coluna direita no mobile:**
- Separada visualmente com `border-t border-border mt-4 pt-4`
- Padding horizontal consistente

**Classes Tailwind chave:**
```tsx
// Wrapper do modal
className="
  relative bg-surface border-0 md:border border-border
  rounded-none md:rounded-xl
  flex flex-col
  fixed inset-0 md:inset-auto
  md:w-[70vw] md:min-w-[600px] md:max-h-[90vh]
  overflow-hidden
"

// Body
className="flex flex-col md:flex-row flex-1 overflow-hidden md:overflow-hidden overflow-y-auto"

// Coluna esquerda
className="px-4 md:px-6 py-5 md:border-r border-border md:overflow-y-auto md:w-[65%]"

// Coluna direita
className="px-4 md:px-5 py-5 border-t md:border-t-0 md:border-l-0 border-border md:overflow-y-auto md:w-[35%]"
```

---

## O que NÃO muda

- Lógica de negócio (ações, API calls, estados)
- Comportamento no desktop (mantém 100% do layout atual)
- Animações de entrada/saída do modal
- Estrutura de componentes (nenhum novo arquivo)
- View mode board (não afetado)

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/app/(dashboard)/viagens/page.tsx` | Botão "Nova Viagem": `whitespace-nowrap` + padding responsivo |
| `src/components/KanbanListView.tsx` | Remover botão de ação; filtrar cancelled de "Todas" |
| `src/components/TripDetailModal.tsx` | Layout responsivo full-screen no mobile |
