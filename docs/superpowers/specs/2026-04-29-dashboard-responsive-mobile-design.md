# Dashboard Responsivo — Design Spec
**Data:** 2026-04-29  
**Projeto:** KZ Serviços Web App  
**Stack:** Next.js 16 · React 19 · Tailwind CSS v4 · Supabase

---

## Contexto

A dashboard interna do KZ Serviços é usada por admins/operadores em desktop. O objetivo é torná-la totalmente utilizável em celular, mantendo um único codebase (Tailwind mobile-first + novos componentes mobile).

**Usuários mobile:** Admins e operadores internos com acesso eventual pelo celular.  
**Escopo:** Todas as 8 páginas precisam de experiência mobile completa.  
**Abordagem:** Tailwind mobile-first com novos componentes mobile — sidebar oculta no mobile, `MobileHeader` e `MobileNav` adicionados ao layout.

---

## 1. Navegação Mobile

### Bottom Tab Bar

Substitui a sidebar no mobile. Composta por 5 itens fixos na base da tela:

| Posição | Ícone | Rota |
|---------|-------|------|
| 1 | 🏠 Home | `/dashboard` |
| 2 | ✈️ Viagens | `/viagens` |
| 3 | 🔧 Serviços | `/outros-servicos` |
| 4 | 💰 Financeiro | `/financeiro` |
| 5 | ☰ Menu | Abre drawer |

**Aba "Menu" — Bottom Sheet Drawer:**  
Desliza de baixo para cima com overlay escurecido. Expõe as 4 páginas restantes em grid 2×2 (Clientes, Motoristas, Prestadores, Usuários) + perfil do usuário logado + toggle de tema + botão de sair.

### Regras CSS

```
Sidebar:        hidden md:flex
MobileHeader:   flex md:hidden        (barra superior com logo + avatar)
MobileNav:      flex md:hidden        (bottom tab bar, fixed bottom)
pl-64:          pl-0 md:pl-64         (deslocamento do conteúdo)
p-8 (main):     p-4 md:p-8
pb (main):      pb-20 md:pb-0         (espaço para o tab bar)
```

### Novos componentes

- `src/components/MobileHeader.tsx` — barra superior mobile com logo KZ e avatar do usuário
- `src/components/MobileNav.tsx` — bottom tab bar + bottom sheet drawer com rotas restantes

---

## 2. Layout Geral (`layout.tsx`)

Mudanças na `(dashboard)/layout.tsx`:

1. Adicionar `<MobileHeader />` antes do conteúdo principal (visível apenas no mobile)
2. Ajustar `pl-64` → `pl-0 md:pl-64` no wrapper do conteúdo
3. Ajustar `p-8` → `p-4 md:p-8` no `<main>`
4. Adicionar `pb-20 md:pb-0` no `<main>` para não sobrepor o tab bar
5. Adicionar `<MobileNav />` após o conteúdo principal

### Modais → Bottom Sheets no Mobile

O componente `Modal.tsx` detecta mobile via `useIsMobile()` e muda de comportamento:

- **Desktop:** centralizado, `max-w-lg`, animação `modal-in` existente
- **Mobile:** `fixed bottom-0 inset-x-0`, border-radius no topo, animação `slide-up`, swipe down para fechar

### Hook utilitário

```ts
// src/lib/hooks.ts
export function useIsMobile(): boolean {
  // retorna true quando window.innerWidth < 768 (breakpoint md do Tailwind)
}
```

Usado por: `Modal.tsx`, `KanbanListView`, todas as páginas de tabela.

### Padrões globais

| Padrão | Mobile | Desktop |
|--------|--------|---------|
| Touch targets | Mínimo 44×44px | — |
| Padding de página | `p-4` | `p-8` |
| Gap em grids | `gap-3` | `gap-6` |
| Título de página | `text-xl` | `text-2xl` |
| Body text mínimo | `text-sm` | `text-sm` |

---

## 3. Dashboard Home (`/dashboard`)

**KPIs:** `grid-cols-2 md:grid-cols-4` — 2 colunas no mobile, 4 no desktop.  
**Tabelas recentes:** empilhadas verticalmente no mobile (`flex-col md:grid md:grid-cols-2`).  
Cada tabela tem scroll horizontal independente se o conteúdo não couber.

---

## 4. Viagens e Outros Serviços (Kanban)

### Toggle de visualização

Estado local: `viewMode: 'list' | 'board'`, inicializado com `useIsMobile() ? 'list' : 'board'`.

- **Lista (padrão mobile):** renderiza `KanbanListView` — cards verticais com ações inline
- **Board (padrão desktop):** renderiza o `KanbanBoard` existente com `overflow-x-auto`

O toggle é visível em todos os tamanhos de tela. Redimensionar a janela não altera o estado — o padrão só é aplicado na montagem do componente.

### Filtro por status

Abas com scroll horizontal acima da lista/board:  
`Todas | Abertas | Em análise | Agendadas | Em curso | Finalizadas`

Filtra os itens renderizados. No modo lista, os cards exibem botão de ação contextual conforme o status:

| Status | Botão principal |
|--------|----------------|
| Aberta | Aprovar → |
| Em análise | Confirmar → |
| Agendada | Iniciar → |
| Em curso | Finalizar → |
| Finalizada | Ver detalhes |

### Novo componente

`src/components/KanbanListView.tsx` — recebe os mesmos dados do `KanbanBoard`, renderiza como lista de cards com filtro e botões de ação.

---

## 5. Páginas de Tabela (Clientes, Motoristas, Prestadores, Usuários)

### Toggle de visualização

Estado local: `viewMode: 'cards' | 'table'`, inicializado com `useIsMobile() ? 'cards' : 'table'`.

- **Cards (padrão mobile):** lista vertical de cards com avatar, nome, info resumida e seta para detalhes. Toque no card abre o modal (bottom sheet no mobile).
- **Tabela (padrão desktop):** tabela original com `overflow-x-auto` para scroll horizontal.

O toggle é visível em todos os tamanhos de tela. Padrão aplicado apenas na montagem do componente.

### Layout do card

```
[Avatar 40px] Nome completo          [badge status]
              Info secundária (tel, qtd viagens, etc.)
              ›
```

### Barra de ações

Abaixo do cabeçalho da página: campo de busca (full-width no mobile) + botão "Novo +" à direita.

---

## 6. Financeiro (`/financeiro`)

- **Cards de resumo:** `grid-cols-1 md:grid-cols-3` — empilhados no mobile
- **Gráficos SVG:** `width: 100%` com `viewBox` para responsividade — não usam largura fixa
- **Tabelas de dados:** scroll horizontal com `overflow-x-auto`
- **Filtros de período:** empilhados verticalmente no mobile (atualmente em linha)

---

## 7. Formulários (SlidePanel / Modais de criação)

O `SlidePanel.tsx` atual desliza da direita. No mobile:
- Ocupa `100vw` e `100vh` — tela cheia
- Transição `translate-x` → `translate-y` (de baixo para cima)
- Header com botão "×" de fechar no canto superior direito

Inputs, selects e áreas de texto ganham `text-base` para evitar zoom automático do iOS (iOS faz zoom em inputs com font-size < 16px).

---

## 8. Checklist de Arquivos a Modificar

### Novos arquivos
- `src/components/MobileHeader.tsx`
- `src/components/MobileNav.tsx`
- `src/components/KanbanListView.tsx`
- `src/lib/hooks.ts` (adicionar `useIsMobile`)

### Arquivos modificados
- `src/app/(dashboard)/layout.tsx`
- `src/components/Modal.tsx`
- `src/components/Sidebar.tsx` (adicionar `hidden md:flex`)
- `src/components/SlidePanel.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/viagens/page.tsx`
- `src/app/(dashboard)/outros-servicos/page.tsx`
- `src/app/(dashboard)/financeiro/page.tsx`
- `src/app/(dashboard)/clientes/page.tsx`
- `src/app/(dashboard)/motoristas/page.tsx`
- `src/app/(dashboard)/prestadores/page.tsx`
- `src/app/(dashboard)/usuarios/page.tsx`

---

## 9. O que NÃO muda

- A sidebar desktop permanece intacta
- O `KanbanBoard` existente (com dnd-kit) não é reescrito — apenas encapsulado com `overflow-x-auto`
- Lógica de autenticação, Supabase, e contextos não são afetados
- Dark/light mode continua funcionando da mesma forma
- Animações existentes (`slide-in-right`, `fade-in`, `modal-in`) permanecem no desktop
