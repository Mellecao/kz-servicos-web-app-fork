"use client";

import Image from "next/image";
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
    <header className="sticky top-0 z-30 h-14 flex md:hidden items-center justify-between px-4 border-b bg-surface border-border">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image
          src="/assets/logo.png"
          alt="KZ Servicos"
          width={890}
          height={494}
          className="h-8 w-auto object-contain"
        />
        <span className="font-heading font-black text-base tracking-tight text-dark">
          Painel ADM
        </span>
      </Link>

      {/* User avatar */}
      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-background">
          {initials}
        </span>
      </div>
    </header>
  );
}
