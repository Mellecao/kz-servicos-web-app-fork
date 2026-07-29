"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeQuotationAvailability,
  type QuotationOverride,
} from "@/lib/quotation-availability";
import {
  getScheduledQuoteOverride,
  setScheduledQuoteOverride,
} from "@/lib/system-settings";

const OVERRIDE_OPTIONS: { value: QuotationOverride; label: string }[] = [
  { value: "auto", label: "Auto (segue horário 07-20h)" },
  { value: "force_enabled", label: "Forçar ON" },
  { value: "force_disabled", label: "Forçar OFF" },
];

export default function QuotationOverrideCard() {
  const [override, setOverride] = useState<QuotationOverride | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScheduledQuoteOverride()
      .then((v) => {
        if (!cancelled) setOverride(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao ler override");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(async (v: QuotationOverride) => {
    setSaving(true);
    setError(null);
    try {
      await setScheduledQuoteOverride(v);
      setOverride(v);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  }, []);

  const availabilityLabel = (() => {
    if (override === null) return "Carregando…";
    const availability = computeQuotationAvailability({
      nowInSp: new Date(),
      adminOverride: override,
    });
    if (override === "auto") {
      return availability === "available" ? "Auto (dentro do horário — ativa)" : "Auto (fora do horário — inativa)";
    }
    return override === "force_enabled" ? "Forçada ON (ativa)" : "Forçada OFF (inativa)";
  })();

  return (
    <div className="p-4 rounded-lg border border-border bg-surface">
      <h2 className="text-lg font-semibold text-dark mb-1">Cotação de Corrida Agendada</h2>
      <p className="text-sm text-contrast mb-3">Estado atual: <strong className="text-dark">{availabilityLabel}</strong></p>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {OVERRIDE_OPTIONS.map((opt) => {
          const isActive = override === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={saving || isActive}
              onClick={() => handleChange(opt.value)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                isActive
                  ? "bg-primary text-background border-primary font-semibold"
                  : "bg-surface text-dark border-border hover:bg-surface-hover"
              } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
