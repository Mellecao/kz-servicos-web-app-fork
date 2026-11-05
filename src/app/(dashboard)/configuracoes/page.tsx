"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useTripsEnabled } from "@/lib/trips-enabled-context";

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const { tripsEnabled, loading, setTripsEnabled } = useTripsEnabled();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function apply(next: boolean) {
    setSaving(true);
    try {
      await setTripsEnabled(next);
      setConfirming(false);
      toast(
        "success",
        next
          ? "Caronas ativadas: as viagens voltaram ao menu e ao dashboard."
          : "Caronas desativadas: o Painel mostra só Serviços e Entregas."
      );
    } catch (err) {
      toast("danger", errorMessage(err, "Não foi possível alterar as caronas. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  // Desligar é imediato; ligar pede confirmação porque também muda o app Cliente.
  function handleToggle() {
    if (tripsEnabled) void apply(false);
    else setConfirming(true);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Definições</h1>
        <p className="text-contrast text-sm mt-1">Opções gerais da plataforma Só Serviços</p>
      </div>

      <section className="bg-surface rounded-xl border border-border p-5 max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-heading font-bold text-dark">Caronas (viagens)</h2>
            <p className="mt-1 text-xs text-contrast leading-relaxed">
              Com as caronas desativadas, o Painel mostra só <strong>Serviços</strong> e{" "}
              <strong>Entregas</strong>: a página «Viagens» sai do menu, o dashboard deixa de
              mostrar indicadores de viagens e <code>/viagens</code> redireciona para os serviços.
              Nada é apagado: ao ativar, tudo volta como estava.
            </p>
            <p className="mt-3 text-xs">
              <span className="text-contrast">Estado atual: </span>
              <span
                className={`font-semibold ${tripsEnabled ? "text-accent" : "text-contrast"}`}
              >
                {loading ? "a carregar…" : tripsEnabled ? "ativadas" : "desativadas"}
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={tripsEnabled}
              aria-label="Ativar caronas"
              disabled={loading || saving}
              onClick={handleToggle}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                tripsEnabled ? "bg-accent" : "bg-surface-hover"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  tripsEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-[11px] text-contrast">Ativar caronas</span>
          </div>
        </div>
      </section>

      <Modal
        open={confirming}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        title="Ativar caronas?"
        footer={
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-body text-contrast hover:text-dark transition-colors duration-200 cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void apply(true)}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-primary text-on-primary font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "A ativar..." : "Ativar caronas"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-dark font-body leading-relaxed">
          <p>
            As viagens voltam ao menu e ao dashboard do Painel, e a página «Viagens» fica
            novamente acessível.
          </p>
          <p className="text-contrast">
            Atenção: esta definição também é lida pelo app Cliente, que volta a abrir na tela
            de viagens em vez de «Buscar prestadores».
          </p>
        </div>
      </Modal>
    </div>
  );
}
