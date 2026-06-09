# Dashboard Responsivo — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a dashboard interna totalmente utilizável em celular mantendo um único codebase, usando Tailwind mobile-first e novos componentes mobile.

**Architecture:** Sidebar oculta em mobile (`hidden md:flex`). Dois novos componentes adicionados ao `layout.tsx`: `MobileHeader` (barra superior) e `MobileNav` (bottom tab bar + drawer). Páginas de Kanban ganham toggle Lista/Board + filtro por status via `KanbanListView`. Páginas de tabela ganham toggle Cards/Tabela. Modais viram bottom sheets.

**Tech Stack:** Next.js 16 · React 19 · Tailwind CSS v4 · TypeScript 5

**Verificação padrão:** `npm run build` deve retornar zero erros após cada task. Verificação visual no Chrome DevTools com "iPhone SE" (375×667px).

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/lib/hooks.ts` |
| Criar | `src/components/MobileHeader.tsx` |
| Criar | `src/components/MobileNav.tsx` |
| Criar | `src/components/KanbanListView.tsx` |
| Modificar | `src/app/globals.css` |
| Modificar | `src/app/(dashboard)/layout.tsx` |
| Modificar | `src/components/Sidebar.tsx` |
| Modificar | `src/components/Modal.tsx` |
| Modificar | `src/components/SlidePanel.tsx` |
| Modificar | `src/app/(dashboard)/dashboard/page.tsx` |
| Modificar | `src/app/(dashboard)/viagens/page.tsx` |
| Modificar | `src/app/(dashboard)/outros-servicos/page.tsx` |
| Modificar | `src/app/(dashboard)/clientes/page.tsx` |
| Modificar | `src/app/(dashboard)/motoristas/page.tsx` |
| Modificar | `src/app/(dashboard)/prestadores/page.tsx` |
| Modificar | `src/app/(dashboard)/usuarios/page.tsx` |
| Modificar | `src/app/(dashboard)/financeiro/page.tsx` |

---

## Task 1: CSS animations + useIsMobile hook

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/lib/hooks.ts`

- [ ] **Step 1: Adicionar animações `slide-up` e `slide-down` ao globals.css**

Adicione ao final de `src/app/globals.css`, antes da última linha:

```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes slide-down {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}
```

- [ ] **Step 2: Criar `src/lib/hooks.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/lib/hooks.ts
git commit -m "feat(mobile): add slide animations and useIsMobile hook"
```

---

## Task 2: MobileHeader component

**Files:**
- Create: `src/components/MobileHeader.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function MobileHeader() {
  const { userProfile, session } = useAuth();

  const displayName =
    userProfile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    "Usuário";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-3 bg-surface border-b border-border sticky top-0 z-40">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <span className="text-background font-heading font-black text-sm">K</span>
        </div>
        <span className="text-dark font-heading font-black text-lg tracking-tight">
          KZ Serviços
        </span>
      </Link>
      <div className="w-9 h-9 rounded-full bg-contrast flex items-center justify-center shrink-0">
        <span className="text-background text-xs font-semibold">{initials}</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileHeader.tsx
git commit -m "feat(mobile): add MobileHeader component"
```

---

## Task 3: MobileNav component (bottom tab bar + drawer)

**Files:**
- Create: `src/components/MobileNav.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import ThemeToggle from "@/components/ThemeToggle";
import { signOut } from "@/lib/api";

const primaryItems = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/viagens",
    label: "Viagens",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/outros-servicos",
    label: "Serviços",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

const drawerItems = [
  {
    href: "/clientes",
    label: "Clientes",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/motoristas",
    label: "Motoristas",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    href: "/prestadores",
    label: "Prestadores",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
  {
    href: "/usuarios",
    label: "Usuários",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { userProfile, session } = useAuth();

  const displayName =
    userProfile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    "Usuário";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isDrawerItemActive = drawerItems.some((i) => i.href === pathname);

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex md:hidden bg-surface border-t border-border">
        {primaryItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                isActive ? "text-primary" : "text-contrast"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors cursor-pointer ${
            isDrawerItemActive ? "text-primary" : "text-contrast"
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="text-[10px] font-medium">Menu</span>
          {isDrawerItemActive && (
            <span className="w-1 h-1 rounded-full bg-primary" />
          )}
        </button>
      </nav>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ animation: "fade-in 200ms ease-out forwards" }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            className="absolute bottom-0 inset-x-0 bg-surface rounded-t-2xl border-t border-border"
            style={{ animation: "slide-up 300ms ease-out forwards" }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-5" />

            {/* Grid of drawer items */}
            <div className="grid grid-cols-2 gap-3 px-4 mb-4">
              {drawerItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-background text-dark hover:bg-surface-hover"
                    }`}
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* User section */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border mb-safe">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-contrast flex items-center justify-center shrink-0">
                  <span className="text-background text-xs font-semibold">{initials}</span>
                </div>
                <div>
                  <p className="text-dark text-sm font-medium">{displayName}</p>
                  <p className="text-contrast text-xs">Admin</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle className="text-contrast hover:text-dark" />
                <button
                  onClick={async () => {
                    await signOut();
                    window.location.href = "/login";
                  }}
                  className="text-contrast hover:text-dark transition-colors cursor-pointer"
                  title="Sair"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileNav.tsx
git commit -m "feat(mobile): add MobileNav bottom tab bar with drawer"
```

---

## Task 4: Integrar componentes mobile no layout + ocultar sidebar

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Atualizar `layout.tsx`**

Substituir o conteúdo completo de `src/app/(dashboard)/layout.tsx`:

```tsx
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
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
        <div className="min-h-screen bg-background">
          <Sidebar />
          <MobileHeader />
          <div className="pl-0 md:pl-64">
            <main className="p-4 md:p-8 pb-24 md:pb-8">{children}</main>
          </div>
          <MobileNav />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Ocultar sidebar no mobile**

Em `src/components/Sidebar.tsx`, linha 120, altere a classe da tag `<aside>`:

```tsx
// antes
<aside className="fixed left-0 top-0 h-screen w-64 bg-surface flex flex-col z-50 border-r border-border">

// depois
<aside className="fixed left-0 top-0 h-screen w-64 bg-surface hidden md:flex flex-col z-50 border-r border-border">
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 4: Verificar visualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000/dashboard` no Chrome DevTools com "iPhone SE" (375×667px).
- A sidebar deve estar invisível
- O MobileHeader deve aparecer no topo com o logo KZ e o avatar
- O bottom tab bar deve aparecer na base com: Home, Viagens, Serviços, Financeiro, Menu
- Tocar em "Menu" deve abrir o drawer com Clientes, Motoristas, Prestadores, Usuários
- Em desktop (>768px), a sidebar deve aparecer normalmente, sem o header e bottom bar

- [ ] **Step 5: Commit**

```bash
git add src/app/"(dashboard)"/layout.tsx src/components/Sidebar.tsx
git commit -m "feat(mobile): wire mobile navigation into layout"
```

---

## Task 5: Modal → bottom sheet no mobile

**Files:**
- Modify: `src/components/Modal.tsx`

- [ ] **Step 1: Substituir conteúdo completo de `src/components/Modal.tsx`**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/lib/hooks";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const isMobile = useIsMobile();

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (overlay) overlay.style.animation = "fade-out 200ms ease-in forwards";
    if (isMobile) {
      if (content) content.style.animation = "slide-down 200ms ease-in forwards";
    } else {
      if (content) content.style.animation = "modal-out 200ms ease-in forwards";
    }
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, 200);
  }, [onClose, isMobile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, handleClose]);

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col justify-end">
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          style={{ animation: "fade-in 200ms ease-out forwards" }}
          onClick={handleClose}
          aria-hidden
        />
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative w-full bg-surface border-t border-border rounded-t-2xl flex flex-col max-h-[90vh]"
          style={{ animation: "slide-up 300ms ease-out forwards" }}
        >
          <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 shrink-0" />
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <h2 className="text-base font-heading font-bold text-dark">{title}</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer"
              aria-label="Fechar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="shrink-0 pb-safe">{footer}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        style={{ animation: "fade-in 200ms ease-out forwards" }}
        onClick={handleClose}
        aria-hidden
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-xl flex flex-col max-h-[90vh]"
        style={{ animation: "modal-in 300ms ease-out forwards" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-heading font-bold text-dark">{title}</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer"
            aria-label="Fechar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Verificar visualmente**

```bash
npm run dev
```

Abrir `/clientes` em mobile (375px). Tocar em "+ Novo Cliente". O formulário deve surgir de baixo como um bottom sheet com handle no topo, ocupando ~90% da tela.

- [ ] **Step 4: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "feat(mobile): Modal becomes bottom sheet on mobile"
```

---

## Task 6: SlidePanel → tela cheia no mobile

**Files:**
- Modify: `src/components/SlidePanel.tsx`

- [ ] **Step 1: Substituir conteúdo completo de `src/components/SlidePanel.tsx`**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/lib/hooks";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function SlidePanel({
  open,
  onClose,
  title,
  children,
  footer,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const isMobile = useIsMobile();

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    const backdrop = panel?.parentElement?.querySelector("[data-backdrop]");
    if (isMobile) {
      if (panel) panel.style.animation = "slide-down 200ms ease-in forwards";
    } else {
      if (panel) panel.style.animation = "slide-out-right 200ms ease-in forwards";
    }
    if (backdrop)
      (backdrop as HTMLElement).style.animation = "fade-out 200ms ease-in forwards";
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, 200);
  }, [onClose, isMobile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, handleClose]);

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col justify-end">
        <div
          data-backdrop
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          style={{ animation: "fade-in 200ms ease-out forwards" }}
          onClick={handleClose}
          aria-hidden
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative w-full h-full bg-surface flex flex-col"
          style={{ animation: "slide-up 300ms ease-out forwards" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-base font-heading font-bold text-dark">{title}</h2>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer"
              aria-label="Fechar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="shrink-0 px-4 py-3 border-t border-border pb-safe">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        data-backdrop
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        style={{ animation: "fade-in 200ms ease-out forwards" }}
        onClick={handleClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full bg-surface border-l border-border flex flex-col h-full"
        style={{ animation: "slide-in-right 300ms ease-out forwards", maxWidth: "600px" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-heading font-bold text-dark">{title}</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer"
            aria-label="Fechar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar `text-base` nos inputs dos formulários para evitar zoom no iOS**

Em cada arquivo de formulário em `src/components/forms/`, localizar todos os `<input`, `<select` e `<textarea` que tenham `text-sm` e alterar para `text-base md:text-sm`. Isso evita que o iOS faça zoom automático em campos com font-size < 16px.

Arquivos a modificar:
- `src/components/forms/NovaViagemForm.tsx`
- `src/components/forms/NovaSolicitacaoForm.tsx`
- `src/components/forms/NovoClienteForm.tsx`
- `src/components/forms/NovoMotoristaForm.tsx`
- `src/components/forms/NovoPrestadorForm.tsx`
- `src/components/forms/NovoUsuarioForm.tsx`

Em cada arquivo, substitua `text-sm` por `text-base md:text-sm` somente nos elementos `<input`, `<select` e `<textarea`. Não alterar `text-sm` em outras tags.

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SlidePanel.tsx src/components/forms/
git commit -m "feat(mobile): SlidePanel full-screen on mobile, fix iOS input zoom"
```

---

## Task 7: Dashboard Home — ajustes de responsividade

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Corrigir header e grid de tabelas**

Em `src/app/(dashboard)/dashboard/page.tsx`, fazer as seguintes substituições:

**Header da página** (linha ~148):
```tsx
// antes
<h1 className="text-3xl font-heading font-black text-dark">Dashboard</h1>

// depois
<h1 className="text-xl md:text-3xl font-heading font-black text-dark">Dashboard</h1>
```

**Grid de tabelas recentes** (linha ~174):
```tsx
// antes
<div className="grid xl:grid-cols-2 gap-6">

// depois
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Verificar visualmente**

Abrir `/dashboard` em mobile. Os 4 cards de KPI devem aparecer em 2 colunas (já estava correto com `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`). As duas tabelas (Viagens Recentes e Serviços Recentes) devem estar empilhadas verticalmente. O título "Dashboard" deve ser menor.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(mobile): responsive layout on dashboard home"
```

---

## Task 8: KanbanListView component

**Files:**
- Create: `src/components/KanbanListView.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useState } from "react";
import type { KanbanColumn, KanbanCard } from "@/components/KanbanBoard";

export interface KanbanListColumn extends KanbanColumn {
  nextColumnId?: string;
  actionLabel?: string;
}

interface FlatCard extends KanbanCard {
  columnId: string;
  columnTitle: string;
  columnColor: string;
  nextColumnId?: string;
  actionLabel?: string;
}

interface KanbanListViewProps {
  columns: KanbanListColumn[];
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  onCardClick?: (cardId: string) => void;
}

export default function KanbanListView({
  columns,
  onCardMove,
  onCardClick,
}: KanbanListViewProps) {
  const [activeStatus, setActiveStatus] = useState<string>("all");

  const allCards: FlatCard[] = columns.flatMap((col) =>
    col.cards.map((card) => ({
      ...card,
      columnId: col.id,
      columnTitle: col.title,
      columnColor: col.color,
      nextColumnId: col.nextColumnId,
      actionLabel: col.actionLabel,
    }))
  );

  const filteredCards =
    activeStatus === "all"
      ? allCards
      : allCards.filter((c) => c.columnId === activeStatus);

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex overflow-x-auto border-b border-border mb-4 -mx-4 px-4 gap-0 scrollbar-hide">
        <button
          onClick={() => setActiveStatus("all")}
          className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors shrink-0 ${
            activeStatus === "all"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-contrast hover:text-dark"
          }`}
        >
          Todas ({allCards.length})
        </button>
        {columns.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveStatus(col.id)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors shrink-0 ${
              activeStatus === col.id
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-contrast hover:text-dark"
            }`}
          >
            {col.title} ({col.cards.length})
          </button>
        ))}
      </div>

      {/* Cards */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-12 text-contrast text-sm">
          Nenhum item neste status.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-dark font-medium text-sm leading-snug">
                    {card.title}
                  </p>
                  <p className="text-contrast text-xs mt-0.5">{card.subtitle}</p>
                  <p className="text-contrast/60 text-xs mt-0.5">{card.date}</p>
                </div>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: `${card.columnColor}20`,
                    color: card.columnColor,
                  }}
                >
                  {card.columnTitle}
                </span>
              </div>

              {card.tag && (
                <span
                  className="inline-block text-xs px-2 py-0.5 rounded-full mb-3"
                  style={{
                    backgroundColor: `${card.tagColor}20`,
                    color: card.tagColor,
                  }}
                >
                  {card.tag}
                </span>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onCardClick?.(card.id)}
                  className="flex-1 py-2 rounded-lg bg-surface-hover text-dark text-sm font-medium transition-colors hover:bg-border cursor-pointer"
                >
                  Ver detalhes
                </button>
                {card.actionLabel && card.nextColumnId && (
                  <button
                    onClick={() =>
                      onCardMove?.(card.id, card.columnId, card.nextColumnId!)
                    }
                    className="flex-1 py-2 rounded-lg bg-primary text-background text-sm font-bold transition-colors hover:bg-primary-dark cursor-pointer"
                  >
                    {card.actionLabel} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/KanbanListView.tsx
git commit -m "feat(mobile): add KanbanListView component with status filter"
```

---

## Task 9: Viagens page — toggle Lista/Board + filtro

**Files:**
- Modify: `src/app/(dashboard)/viagens/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo de `src/app/(dashboard)/viagens/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, { type KanbanListColumn } from "@/components/KanbanListView";
import TripDetailModal from "@/components/TripDetailModal";
import NovaViagemForm from "@/components/forms/NovaViagemForm";
import { useToast } from "@/components/Toast";
import { fetchTrips, updateTripStatus } from "@/lib/api";
import type { Trip, TripStatus } from "@/types/database";

const tripColumnConfig: {
  id: TripStatus;
  title: string;
  color: string;
  nextColumnId?: TripStatus;
  actionLabel?: string;
}[] = [
  { id: "open", title: "Aberta", color: "#FEBF22", nextColumnId: "under_review", actionLabel: "Aprovar" },
  { id: "under_review", title: "Em Análise", color: "#5C5956", nextColumnId: "searching_drivers", actionLabel: "Confirmar" },
  { id: "searching_drivers", title: "Buscando Motorista", color: "#2261FE" },
  { id: "scheduled", title: "Agendada", color: "#2261FE", nextColumnId: "started", actionLabel: "Iniciar" },
  { id: "started", title: "Em Andamento", color: "#22c55e", nextColumnId: "finished", actionLabel: "Finalizar" },
  { id: "finished", title: "Finalizada", color: "#22c55e" },
  { id: "cancelled", title: "Cancelada", color: "#ef4444" },
];

function shortenAddress(addr: string | undefined | null) {
  if (!addr) return "—";
  const parts = addr.split(",");
  return parts[0]?.trim() ?? addr;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ViewMode = "list" | "board";

export default function ViagensPage() {
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "board";
    return window.innerWidth < 768 ? "list" : "board";
  });

  const loadTrips = useCallback(() => {
    setLoading(true);
    fetchTrips()
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const handleCardMove = useCallback(
    async (cardId: string, _fromColumnId: string, toColumnId: string) => {
      const newStatus = toColumnId as TripStatus;
      setTrips((prev) =>
        prev.map((t) => (t.id === cardId ? { ...t, status: newStatus } : t))
      );
      try {
        await updateTripStatus(cardId, newStatus);
        toast("success", "Status da viagem atualizado");
      } catch {
        toast("danger", "Erro ao atualizar status");
        loadTrips();
      }
    },
    [toast, loadTrips]
  );

  const handleCardClick = useCallback(
    (cardId: string) => {
      const trip = trips.find((t) => t.id === cardId);
      if (trip) setSelectedTrip(trip);
    },
    [trips]
  );

  const columns: KanbanListColumn[] = tripColumnConfig.map((col) => {
    const colTrips = trips.filter((t) => t.status === col.id);
    return {
      id: col.id,
      title: col.title,
      color: col.color,
      nextColumnId: col.nextColumnId,
      actionLabel: col.actionLabel,
      cards: colTrips.map((t) => ({
        id: t.id,
        title: `${shortenAddress(t.pickup_address?.formatted_address)} → ${shortenAddress(t.dropoff_address?.formatted_address)}`,
        subtitle: `${t.users?.full_name ?? "—"} • ${t.passenger_count} passageiro${t.passenger_count !== 1 ? "s" : ""}`,
        date: formatDate(t.scheduled_datetime),
        ...(t.is_round_trip ? { tag: "Ida e volta", tagColor: "#2261FE" } : {}),
        ...(t.is_paid ? { tag: "Pago", tagColor: "#22c55e" } : {}),
      })),
    };
  });

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Viagens</h1>
          <p className="text-contrast text-sm mt-1">
            Gerencie todas as viagens da plataforma
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-surface border border-border rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-primary text-background"
                  : "text-contrast hover:text-dark"
              }`}
            >
              ≡ Lista
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "board"
                  ? "bg-primary text-background"
                  : "text-contrast hover:text-dark"
              }`}
            >
              ▦ Board
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-background px-4 py-2 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer whitespace-nowrap"
          >
            + Nova Viagem
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">
          Carregando viagens...
        </div>
      ) : viewMode === "list" ? (
        <KanbanListView
          columns={columns}
          onCardMove={handleCardMove}
          onCardClick={handleCardClick}
        />
      ) : (
        <KanbanBoard
          columns={columns}
          onCardMove={handleCardMove}
          onCardClick={handleCardClick}
        />
      )}

      <NovaViagemForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadTrips}
      />

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        onUpdate={loadTrips}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Verificar visualmente**

Abrir `/viagens` em mobile. Deve aparecer no modo lista com abas de filtro por status. O toggle "Lista / Board" deve aparecer no header. Alternar para Board deve mostrar o Kanban com scroll horizontal.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/viagens/page.tsx"
git commit -m "feat(mobile): viagens page with list/board toggle and status filter"
```

---

## Task 10: Outros Serviços page — toggle Lista/Board + filtro

**Files:**
- Modify: `src/app/(dashboard)/outros-servicos/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo de `src/app/(dashboard)/outros-servicos/page.tsx`**

Seguir exatamente o mesmo padrão da Task 9, adaptando os tipos e nomes:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, { type KanbanListColumn } from "@/components/KanbanListView";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import NovaSolicitacaoForm from "@/components/forms/NovaSolicitacaoForm";
import { useToast } from "@/components/Toast";
import { fetchServiceRequests, updateServiceRequestStatus } from "@/lib/api";
import type { ServiceRequest, ServiceRequestStatus } from "@/types/database";

const serviceColumnConfig: {
  id: ServiceRequestStatus;
  title: string;
  color: string;
  nextColumnId?: ServiceRequestStatus;
  actionLabel?: string;
}[] = [
  { id: "open", title: "Aberto", color: "#FEBF22", nextColumnId: "under_review", actionLabel: "Aprovar" },
  { id: "under_review", title: "Em Análise", color: "#5C5956", nextColumnId: "searching_provider", actionLabel: "Confirmar" },
  { id: "searching_provider", title: "Buscando Prestador", color: "#2261FE" },
  { id: "assigned", title: "Atribuído", color: "#2261FE", nextColumnId: "in_progress", actionLabel: "Iniciar" },
  { id: "in_progress", title: "Em Andamento", color: "#22c55e", nextColumnId: "finished", actionLabel: "Finalizar" },
  { id: "finished", title: "Finalizado", color: "#22c55e" },
  { id: "cancelled", title: "Cancelado", color: "#ef4444" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ViewMode = "list" | "board";

export default function OutrosServicosPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "board";
    return window.innerWidth < 768 ? "list" : "board";
  });

  const loadRequests = useCallback(() => {
    setLoading(true);
    fetchServiceRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleCardMove = useCallback(
    async (cardId: string, _fromColumnId: string, toColumnId: string) => {
      const newStatus = toColumnId as ServiceRequestStatus;
      setRequests((prev) =>
        prev.map((r) => (r.id === cardId ? { ...r, status: newStatus } : r))
      );
      try {
        await updateServiceRequestStatus(cardId, newStatus);
        toast("success", "Status do serviço atualizado");
      } catch {
        toast("danger", "Erro ao atualizar status");
        loadRequests();
      }
    },
    [toast, loadRequests]
  );

  const handleCardClick = useCallback(
    (cardId: string) => {
      const request = requests.find((r) => r.id === cardId);
      if (request) setSelectedRequest(request);
    },
    [requests]
  );

  const columns: KanbanListColumn[] = serviceColumnConfig.map((col) => {
    const colRequests = requests.filter((r) => r.status === col.id);
    return {
      id: col.id,
      title: col.title,
      color: col.color,
      nextColumnId: col.nextColumnId,
      actionLabel: col.actionLabel,
      cards: colRequests.map((r) => ({
        id: r.id,
        title: r.service_categories?.name ?? r.description,
        subtitle: `${r.users?.full_name ?? "—"}`,
        date: formatDate(r.service_date),
      })),
    };
  });

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Outros Serviços
          </h1>
          <p className="text-contrast text-sm mt-1">
            Gerencie as solicitações de serviço da plataforma
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface border border-border rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-primary text-background"
                  : "text-contrast hover:text-dark"
              }`}
            >
              ≡ Lista
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "board"
                  ? "bg-primary text-background"
                  : "text-contrast hover:text-dark"
              }`}
            >
              ▦ Board
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-background px-4 py-2 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer whitespace-nowrap"
          >
            + Nova Solicitação
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">
          Carregando serviços...
        </div>
      ) : viewMode === "list" ? (
        <KanbanListView
          columns={columns}
          onCardMove={handleCardMove}
          onCardClick={handleCardClick}
        />
      ) : (
        <KanbanBoard
          columns={columns}
          onCardMove={handleCardMove}
          onCardClick={handleCardClick}
        />
      )}

      <NovaSolicitacaoForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadRequests}
      />

      <ServiceDetailModal
        request={selectedRequest}
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onUpdate={loadRequests}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/outros-servicos/page.tsx"
git commit -m "feat(mobile): outros-servicos page with list/board toggle and status filter"
```

---

## Task 11: Clientes page — toggle Cards/Tabela

**Files:**
- Modify: `src/app/(dashboard)/clientes/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo de `src/app/(dashboard)/clientes/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchClients } from "@/lib/api";
import type { User } from "@/types/database";
import NovoClienteForm from "@/components/forms/NovoClienteForm";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

type ViewMode = "cards" | "table";

export default function ClientesPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return window.innerWidth < 768 ? "cards" : "table";
  });

  const loadClients = useCallback(() => {
    setLoading(true);
    fetchClients()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Clientes</h1>
          <p className="text-contrast text-sm mt-1">Gerencie os clientes da plataforma</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors cursor-pointer duration-200 whitespace-nowrap"
        >
          + Novo Cliente
        </button>
      </div>

      {/* Search + toggle */}
      <div className="mb-5 flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-dark placeholder:text-contrast/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base md:text-sm"
        />
        <div className="flex bg-surface border border-border rounded-lg p-0.5 gap-0.5 shrink-0">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "cards"
                ? "bg-primary text-background"
                : "text-contrast hover:text-dark"
            }`}
          >
            ≡
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "table"
                ? "bg-primary text-background"
                : "text-contrast hover:text-dark"
            }`}
          >
            ⊞
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-contrast text-sm">
          Nenhum cliente encontrado.
        </div>
      ) : viewMode === "cards" ? (
        /* Cards view */
        <div className="flex flex-col gap-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {getInitials(client.full_name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-dark text-sm font-medium truncate">{client.full_name}</p>
                <p className="text-contrast text-xs truncate">{client.email}</p>
                <p className="text-contrast text-xs">{client.phone ?? "—"}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    client.is_active ? "text-success" : "text-contrast/50"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      client.is_active ? "bg-success" : "bg-contrast/30"
                    }`}
                  />
                  {client.is_active ? "Ativo" : "Inativo"}
                </span>
                <span className="text-contrast/50 text-xs">{formatDate(client.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table view */
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">Nome</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">E-mail</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-surface-hover/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {getInitials(client.full_name)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-dark">{client.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-contrast">{client.email}</td>
                    <td className="px-5 py-3.5 text-sm text-contrast">{client.phone ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          client.is_active ? "text-success" : "text-contrast/50"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            client.is_active ? "bg-success" : "bg-contrast/30"
                          }`}
                        />
                        {client.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-contrast">{formatDate(client.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoClienteForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadClients}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Verificar visualmente**

Abrir `/clientes` em mobile. A lista de cards deve aparecer por padrão com avatar, nome, email e status. O toggle ≡/⊞ deve alternar para a tabela com scroll horizontal. Em desktop, a tabela deve aparecer por padrão.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/clientes/page.tsx"
git commit -m "feat(mobile): clientes page with card/table toggle"
```

---

## Task 12: Motoristas page — toggle Cards/Tabela

**Files:**
- Modify: `src/app/(dashboard)/motoristas/page.tsx`

- [ ] **Step 1: Adicionar toggle e view de cards**

Abrir `src/app/(dashboard)/motoristas/page.tsx`. Realizar as seguintes mudanças:

**Adicionar import e tipo:**
```tsx
// Após os imports existentes, adicionar:
type ViewMode = "cards" | "table";
```

**Adicionar helper de iniciais** (antes da função do componente):
```tsx
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
```

**No componente, adicionar estado viewMode** (após os outros useState):
```tsx
const [viewMode, setViewMode] = useState<ViewMode>(() => {
  if (typeof window === "undefined") return "table";
  return window.innerWidth < 768 ? "cards" : "table";
});
```

**Substituir o div do Page header** (linha ~76, que tem `flex items-center justify-between`):
```tsx
<div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
  <div>
    <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Motoristas</h1>
    <p className="text-contrast text-sm mt-1">
      Gerencie os motoristas cadastrados na plataforma
    </p>
  </div>
  <button
    onClick={() => setShowForm(true)}
    className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors cursor-pointer duration-200 whitespace-nowrap"
  >
    + Novo Motorista
  </button>
</div>
```

**Substituir o div de Search & Filters** (linha ~92):
```tsx
<div className="mb-5 flex flex-wrap items-center gap-3">
  <input
    type="text"
    placeholder="Buscar motorista..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="flex-1 min-w-40 px-4 py-2.5 rounded-lg border border-border bg-background text-dark placeholder:text-contrast/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base md:text-sm"
  />
  <div className="flex items-center gap-2">
    <span className="text-xs text-contrast">Status:</span>
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className="px-3 py-2.5 rounded-lg border border-border bg-background text-dark text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
    >
      <option value="">Todos</option>
      <option value="approved">Aprovados</option>
      <option value="pending">Pendentes</option>
      <option value="rejected">Rejeitados</option>
      <option value="suspended">Suspensos</option>
    </select>
  </div>
  <div className="flex bg-surface border border-border rounded-lg p-0.5 gap-0.5 shrink-0">
    <button
      onClick={() => setViewMode("cards")}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
        viewMode === "cards" ? "bg-primary text-background" : "text-contrast hover:text-dark"
      }`}
    >≡</button>
    <button
      onClick={() => setViewMode("table")}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
        viewMode === "table" ? "bg-primary text-background" : "text-contrast hover:text-dark"
      }`}
    >⊞</button>
  </div>
</div>
```

**Passo A — Envolver a tabela existente em overflow-x-auto:**

Localizar o bloco `<div className="bg-surface rounded-xl border border-border overflow-hidden">` que contém a `<table>`. Certificar que ele está estruturado assim:

```tsx
<div className="bg-surface rounded-xl border border-border overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      {/* thead e tbody existentes — não alterar */}
    </table>
  </div>
</div>
```

Se o `<div className="overflow-x-auto">` já existir, não fazer nada.

**Passo B — Adicionar renderização condicional em torno do bloco de conteúdo:**

Localizar o bloco `{loading ? (` existente e substituir por:

```tsx
{loading ? (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
) : filtered.length === 0 ? (
  <div className="text-center py-20 text-contrast text-sm">Nenhum motorista encontrado.</div>
) : viewMode === "cards" ? (
  <div className="flex flex-col gap-3">
    {filtered.map((driver) => {
      const name = driver.provider_profiles?.users?.full_name ?? "—";
      const phone = driver.provider_profiles?.users?.phone ?? "—";
      const status = (driver.provider_profiles?.status ?? "pending") as keyof typeof statusColors;
      const vehicleLabel = driver.vehicle
        ? `${driver.vehicle.brand} ${driver.vehicle.model}`
        : "Sem veículo";
      return (
        <div key={driver.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">{getInitials(name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-dark text-sm font-medium truncate">{name}</p>
            <p className="text-contrast text-xs">{phone}</p>
            <p className="text-contrast text-xs truncate">{vehicleLabel}</p>
          </div>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: `${statusColors[status]}20`, color: statusColors[status] }}
          >
            {statusLabels[status]}
          </span>
        </div>
      );
    })}
  </div>
) : (
  /* bloco da tabela com overflow-x-auto do Passo A */
  <div className="bg-surface rounded-xl border border-border overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {/* thead e tbody originais sem alteração */}
      </table>
    </div>
  </div>
)}
```

**Atenção:** manter o conteúdo original da `<table>` sem alteração. Apenas envolva-a em `<div className="overflow-x-auto">` se ainda não estiver.

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/motoristas/page.tsx"
git commit -m "feat(mobile): motoristas page with card/table toggle"
```

---

## Task 13: Prestadores page — toggle Cards/Tabela

**Files:**
- Modify: `src/app/(dashboard)/prestadores/page.tsx`

- [ ] **Step 1: Aplicar exatamente o mesmo padrão da Task 12**

Dados do card de prestador:
- Avatar: iniciais de `provider.users?.full_name ?? "—"`
- Nome: `provider.users?.full_name ?? "—"`
- Info: `provider.users?.phone ?? "—"`
- Status badge: `provider.status` usando `statusColors` e `statusLabels` já definidos na página

Aplicar as mesmas mudanças:
1. Adicionar tipo `ViewMode = "cards" | "table"`
2. Adicionar função `getInitials`
3. Adicionar estado `viewMode` com lazy initializer
4. Atualizar header para `flex-col sm:flex-row`
5. Adicionar toggle ≡/⊞ na barra de filtros
6. Adicionar renderização condicional de cards vs tabela
7. Envolver tabela existente em `overflow-x-auto`

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/prestadores/page.tsx"
git commit -m "feat(mobile): prestadores page with card/table toggle"
```

---

## Task 14: Usuários page — toggle Cards/Tabela

**Files:**
- Modify: `src/app/(dashboard)/usuarios/page.tsx`

- [ ] **Step 1: Aplicar o mesmo padrão das tasks anteriores**

Dados do card de usuário:
- Avatar: iniciais de `user.full_name`
- Nome: `user.full_name`
- Info: `user.email`, `user.phone ?? "—"`
- Badge: `user.role` usando `roleColors` e `roleLabels` já definidos na página

Aplicar as mesmas mudanças:
1. Adicionar tipo `ViewMode = "cards" | "table"`
2. Adicionar função `getInitials`
3. Adicionar estado `viewMode` com lazy initializer
4. Atualizar header para `flex-col sm:flex-row` e `text-xl md:text-3xl`
5. Trocar `max-w-md` do input de busca para `flex-1` + adicionar toggle ≡/⊞
6. Adicionar renderização condicional cards vs tabela
7. Envolver tabela existente em `overflow-x-auto` se não estiver

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/usuarios/page.tsx"
git commit -m "feat(mobile): usuarios page with card/table toggle"
```

---

## Task 15: Financeiro page — ajustes de header

**Files:**
- Modify: `src/app/(dashboard)/financeiro/page.tsx`

- [ ] **Step 1: Corrigir apenas o título**

A página já é praticamente responsiva (gráfico usa `w-full`, grid usa `md:grid-cols-3`, tabela tem `overflow-x-auto`, filtros usam `flex-col sm:flex-row`). A única mudança necessária:

```tsx
// antes (linha ~222)
<h1 className="text-3xl font-heading font-black text-dark">

// depois
<h1 className="text-xl md:text-3xl font-heading font-black text-dark">
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Verificar visualmente**

Abrir `/financeiro` em mobile. Os cards de stat devem estar empilhados. O gráfico de barras deve ocupar a largura total. A tabela deve ter scroll horizontal. Os filtros (Pendentes/Pagas + busca) devem estar em coluna no mobile.

- [ ] **Step 4: Commit final**

```bash
git add "src/app/(dashboard)/financeiro/page.tsx"
git commit -m "feat(mobile): financeiro page responsive header"
```

---

## Verificação final

- [ ] **Build limpo**

```bash
npm run build
```

Expected: zero TypeScript/lint errors, build bem-sucedido.

- [ ] **Teste visual completo em mobile (iPhone SE 375×667px)**

Verificar todas as 8 páginas:
1. `/dashboard` — KPIs em 2 colunas, tabelas empilhadas, header mobile visível, bottom nav visível
2. `/viagens` — toggle lista/board funcional, filtro por status funcional, bottom sheet ao criar viagem
3. `/outros-servicos` — mesmo comportamento de viagens
4. `/financeiro` — gráfico responsivo, tabela com scroll, filtros empilhados
5. `/clientes` — cards por padrão, toggle para tabela funcional
6. `/motoristas` — cards por padrão, toggle para tabela funcional
7. `/prestadores` — cards por padrão, toggle para tabela funcional
8. `/usuarios` — cards por padrão, toggle para tabela funcional

Verificar em desktop (>768px): sidebar deve aparecer normalmente, sem header mobile e sem bottom bar.

- [ ] **Commit de finalização**

```bash
git add -A
git commit -m "feat(mobile): complete mobile-responsive dashboard"
```
