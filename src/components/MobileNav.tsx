"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/api";

// --- Icon components (22px, stroke-based) ---

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 12 15 12 15 21" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9 5.8 7.2l-1.4 1.4 7 3-2 2-2.5-.5-1.4 1.4 2.5 1.5 1.5 2.5 1.4-1.4-.5-2.5 2-2 3 7z" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ClientesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MotoristasIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function PrestadoresIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function UsuariosIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// --- Tab items (bottom bar) ---

const tabItems = [
  { href: "/dashboard", label: "Home", icon: <HomeIcon /> },
  { href: "/viagens", label: "Viagens", icon: <PlaneIcon /> },
  { href: "/outros-servicos", label: "Serviços", icon: <WrenchIcon /> },
  { href: "/financeiro", label: "Financeiro", icon: <FinanceIcon /> },
];

// --- Drawer secondary nav tiles ---

function LogsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const drawerItems = [
  { href: "/clientes", label: "Clientes", icon: <ClientesIcon /> },
  { href: "/motoristas", label: "Motoristas", icon: <MotoristasIcon /> },
  { href: "/prestadores", label: "Prestadores", icon: <PrestadoresIcon /> },
  { href: "/usuarios", label: "Usuários", icon: <UsuariosIcon /> },
  { href: "/logs", label: "Logs", icon: <LogsIcon /> },
];

// --- Main component ---

export default function MobileNav() {
  const pathname = usePathname();
  const { userProfile, session } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const displayName =
    userProfile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    "Usuário";
  const displayEmail = userProfile?.email || session?.user?.email || "";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Prevent body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  function openDrawer() {
    setIsClosing(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setIsClosing(true);
    setTimeout(() => {
      setDrawerOpen(false);
      setIsClosing(false);
    }, 310);
  }

  async function handleSignOut() {
    closeDrawer();
    try {
      await signOut();
    } catch (e) {
      console.error("Sign out failed", e);
    }
    window.location.href = "/login";
  }

  function handleDrawerLinkClick() {
    closeDrawer();
  }

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex md:hidden h-14 bg-surface border-t border-border">
        {tabItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-primary" : "text-contrast"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu button (5th tab) */}
        <button
          onClick={openDrawer}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-contrast transition-colors cursor-pointer"
          aria-label="Abrir menu"
        >
          <MenuIcon />
          <span className="text-[10px] font-medium leading-none">Menu</span>
        </button>
      </nav>

      {/* Drawer Overlay + Sheet */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Bottom sheet */}
          <div
            className={`fixed bottom-0 inset-x-0 z-[51] bg-surface rounded-t-2xl p-6 ${
              isClosing ? "slide-down" : "slide-up"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-dark font-heading font-black text-lg">Menu</span>
              <button
                onClick={closeDrawer}
                className="text-contrast hover:text-dark transition-colors cursor-pointer p-1 -mr-1"
                aria-label="Fechar menu"
              >
                <CloseIcon />
              </button>
            </div>

            {/* 2×2 grid of secondary nav tiles */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {drawerItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleDrawerLinkClick}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      isActive
                        ? "bg-primary text-background border-primary font-semibold"
                        : "bg-surface-hover text-dark border-border hover:border-primary/40"
                    }`}
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* User profile row */}
            <div className="flex items-center gap-3 py-4 border-t border-border mb-4">
              <div className="w-10 h-10 rounded-full bg-contrast flex items-center justify-center shrink-0">
                <span className="text-background text-sm font-semibold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-dark text-sm font-medium truncate">{displayName}</p>
                <p className="text-contrast text-xs truncate">{displayEmail}</p>
              </div>
            </div>

            {/* Sign out button */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors font-medium text-sm cursor-pointer"
            >
              <LogoutIcon />
              Sair
            </button>
          </div>
        </>
      )}
    </>
  );
}
