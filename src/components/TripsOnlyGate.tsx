"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTripsPath, tripsRedirectTarget } from "@/lib/trips-enabled";
import { useTripsEnabled } from "@/lib/trips-enabled-context";

/**
 * Guarda das páginas só de caronas (/viagens, /mapa, /motoristas): só se mostram com o
 * interruptor trips_enabled ligado. Desligado, redireciona para os serviços; enquanto o
 * valor não é lido mostra "A carregar…" (a página nem chega a montar nem a consultar
 * dados). Qualquer outra página passa direta, sem esperar. As páginas ficam intactas.
 */
export default function TripsOnlyGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { tripsEnabled, loading } = useTripsEnabled();
  const target = loading ? null : tripsRedirectTarget(pathname, tripsEnabled);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (isTripsPath(pathname) && (loading || !tripsEnabled)) {
    return <div className="text-center py-16 text-contrast text-sm">A carregar…</div>;
  }
  return <>{children}</>;
}
