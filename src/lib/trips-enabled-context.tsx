"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchTripsEnabled, updateTripsEnabled } from "@/lib/trips-enabled-api";

interface TripsEnabledValue {
  /** Viagens/caronas ligadas? Falso até o interruptor ser lido, e se a leitura falhar. */
  tripsEnabled: boolean;
  /**
   * Verdadeiro enquanto a sessão carrega ou o interruptor não foi lido. Durante este
   * tempo não se esconde nem se redireciona nada, para não haver "piscadelas".
   */
  loading: boolean;
  /** Grava o interruptor e atualiza o menu na hora. Lança erro se a escrita falhar. */
  setTripsEnabled: (next: boolean) => Promise<void>;
}

const TripsEnabledContext = createContext<TripsEnabledValue | null>(null);

export function TripsEnabledProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;
  // Guarda também de que utilizador é o valor lido: ao trocar de sessão volta a "a carregar".
  const [state, setState] = useState<{ userId: string; value: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTripsEnabled()
      .catch(() => false)
      .then((value) => {
        if (!cancelled) setState({ userId, value });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loaded = state !== null && state.userId === userId;
  const loading = authLoading || (userId !== null && !loaded);
  const tripsEnabled = loaded ? state.value : false;

  const setTripsEnabled = useCallback(
    async (next: boolean) => {
      await updateTripsEnabled(next);
      if (userId) setState({ userId, value: next });
    },
    [userId]
  );

  const value = useMemo(
    () => ({ tripsEnabled, loading, setTripsEnabled }),
    [tripsEnabled, loading, setTripsEnabled]
  );

  return <TripsEnabledContext value={value}>{children}</TripsEnabledContext>;
}

export function useTripsEnabled(): TripsEnabledValue {
  const ctx = useContext(TripsEnabledContext);
  if (!ctx) throw new Error("useTripsEnabled must be used within TripsEnabledProvider");
  return ctx;
}
