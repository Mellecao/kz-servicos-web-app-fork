"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ServiceRequest, PaymentMethod } from "@/types/database";
import { updateServiceRequestFinancial } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface ServiceDetailModalProps {
  request: ServiceRequest | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  under_review: "Em Análise",
  review_rejected: "Rejeitado na Análise",
  searching_provider: "Buscando Prestador",
  assigned: "Atribuído",
  in_progress: "Em Andamento",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "#FEBF2220", text: "#FEBF22" },
  under_review: { bg: "#94A3B820", text: "#94A3B8" },
  review_rejected: { bg: "#ef444420", text: "#ef4444" },
  searching_provider: { bg: "#2261FE20", text: "#2261FE" },
  assigned: { bg: "#2261FE20", text: "#2261FE" },
  in_progress: { bg: "#22c55e20", text: "#22c55e" },
  finished: { bg: "#22c55e20", text: "#22c55e" },
  cancelled: { bg: "#ef444420", text: "#ef4444" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border last:border-0">
      <span className="text-xs text-contrast font-body shrink-0 mr-4">{label}</span>
      <span className="text-xs text-dark font-body text-right">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-heading font-bold text-contrast uppercase tracking-wider mb-2 mt-5 first:mt-0">
      {children}
    </p>
  );
}

export default function ServiceDetailModal({
  request,
  open,
  onClose,
  onUpdate,
}: ServiceDetailModalProps) {
  const { toast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  // Local state for financial editing (mirrors request props)
  const [isPaid, setIsPaid] = useState(false);
  const [isProviderPaied, setIsProviderPaied] = useState(false);
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod | "">("");
  const [financialSaving, setFinancialSaving] = useState(false);

  useEffect(() => {
    if (!open || !request) return;
    setIsPaid(request.is_paid);
    setIsProviderPaied(request.is_provider_paied ?? false);
    setFinalPriceInput(request.final_price?.toString() ?? "");
    setPaymentMethodInput(request.payment_method ?? "");
  }, [open, request]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (overlay) overlay.style.animation = "fade-out 200ms ease-in forwards";
    if (content) content.style.animation = "modal-out 200ms ease-in forwards";
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, 200);
  }, [onClose]);

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

  if (!open || !request) return null;

  const r = request;
  const statusColor = statusColors[r.status] ?? { bg: "#FEBF2220", text: "#FEBF22" };

  async function handleToggleIsPaid() {
    const next = !isPaid;
    setIsPaid(next);
    try {
      await updateServiceRequestFinancial(r.id, { is_paid: next });
      onUpdate?.();
    } catch {
      setIsPaid(!next);
      toast("danger", "Erro ao atualizar pagamento do serviço");
    }
  }

  async function handleToggleIsProviderPaied() {
    const next = !isProviderPaied;
    setIsProviderPaied(next);
    try {
      await updateServiceRequestFinancial(r.id, { is_provider_paied: next });
      onUpdate?.();
    } catch {
      setIsProviderPaied(!next);
      toast("danger", "Erro ao atualizar pagamento do prestador");
    }
  }

  async function handleSaveFinancial() {
    setFinancialSaving(true);
    try {
      const parsedPrice = finalPriceInput !== "" ? parseFloat(finalPriceInput) : null;
      await updateServiceRequestFinancial(r.id, {
        final_price: parsedPrice,
        payment_method: paymentMethodInput || null,
      });
      toast("success", "Dados financeiros salvos");
      onUpdate?.();
    } catch {
      toast("danger", "Erro ao salvar dados financeiros");
    } finally {
      setFinancialSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        style={{ animation: "fade-in 200ms ease-out forwards" }}
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={r.description}
        className="relative bg-surface border border-border rounded-xl flex flex-col"
        style={{
          width: "65vw",
          minWidth: "560px",
          maxHeight: "90vh",
          animation: "modal-in 300ms ease-out forwards",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-lg font-heading font-black text-dark leading-tight truncate">
              {r.description.length > 60 ? r.description.slice(0, 60) + "…" : r.description}
            </h2>
            <p className="text-sm text-contrast font-body mt-0.5">{r.users?.full_name ?? "—"}</p>
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

        {/* Body — 2 columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── LEFT COLUMN (65%) ── */}
          <div className="overflow-y-auto px-6 py-5 border-r border-border" style={{ width: "65%" }}>
            <SectionTitle>Informações do Serviço</SectionTitle>

            <InfoRow
              label="Status"
              value={
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                >
                  {statusLabels[r.status] ?? r.status}
                </span>
              }
            />
            <InfoRow label="Cliente" value={r.users?.full_name ?? "—"} />
            <InfoRow label="Categoria" value={r.service_categories?.name ?? "—"} />
            <InfoRow label="Data do serviço" value={formatDate(r.service_date)} />

            {r.addresses && (
              <InfoRow label="Endereço" value={r.addresses.formatted_address} />
            )}

            {r.provider_profiles?.users && (
              <InfoRow label="Prestador" value={r.provider_profiles.users.full_name} />
            )}

            <div className="mt-4">
              <p className="text-xs text-contrast font-medium mb-1">Descrição</p>
              <p className="text-xs text-dark leading-relaxed">{r.description}</p>
            </div>

            {r.observations && (
              <div className="mt-3 p-3 rounded-lg bg-background border border-border">
                <p className="text-xs text-contrast mb-1 font-medium">Observações</p>
                <p className="text-xs text-dark">{r.observations}</p>
              </div>
            )}

            {r.provider_observations && (
              <div className="mt-2 p-3 rounded-lg bg-background border border-border">
                <p className="text-xs text-contrast mb-1 font-medium">Observações do prestador</p>
                <p className="text-xs text-dark">{r.provider_observations}</p>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (35%) ── */}
          <div className="overflow-y-auto px-5 py-5 flex flex-col" style={{ width: "35%" }}>
            <SectionTitle>Área Financeira</SectionTitle>

            {/* Status toggles */}
            <div className="flex flex-col gap-2 mb-3">
              <button
                onClick={handleToggleIsPaid}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isPaid
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {isPaid ? "Serviço pago" : "Marcar serviço como pago"}
              </button>

              <button
                onClick={handleToggleIsProviderPaied}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isProviderPaied
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {isProviderPaied ? "Prestador pago" : "Marcar prestador como pago"}
              </button>
            </div>

            {/* Financial values */}
            <InfoRow label="Valor estimado" value={formatCurrency(r.estimated_price)} />

            <div className="py-2 border-b border-border">
              <label className="text-xs text-contrast block mb-1">Valor final</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={finalPriceInput}
                onChange={(e) => setFinalPriceInput(e.target.value)}
                placeholder="R$ 0,00"
                className="w-full rounded-md bg-background border border-border text-dark text-xs font-body px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-contrast/40"
              />
            </div>

            <div className="py-2 border-b border-border">
              <label className="text-xs text-contrast block mb-1">Forma de pagamento</label>
              <select
                value={paymentMethodInput}
                onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod | "")}
                className="w-full rounded-md bg-background border border-border text-dark text-xs font-body px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">— Selecione —</option>
                <option value="pix">PIX</option>
                <option value="debit">Débito</option>
                <option value="credit">Crédito</option>
                <option value="cash">Dinheiro</option>
                <option value="billing">Faturamento</option>
              </select>
            </div>

            <button
              onClick={handleSaveFinancial}
              disabled={financialSaving}
              className="mt-2 w-full py-1.5 rounded-lg bg-primary text-background text-xs font-heading font-bold hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50"
            >
              {financialSaving ? "Salvando..." : "Salvar valores"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
