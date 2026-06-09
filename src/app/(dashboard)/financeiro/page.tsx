"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { fetchDebitos, updateTripFinancial, updateServiceRequestFinancial } from "@/lib/api";
import type { Debito, PaymentMethod } from "@/types/database";
import { useToast } from "@/components/Toast";

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPaymentMethod(method: string | null) {
  const map: Record<string, string> = {
    pix: "PIX",
    debit: "Débito",
    credit: "Crédito",
    cash: "Dinheiro",
    billing: "Faturamento",
  };
  return method ? map[method] ?? method : "—";
}

// ─── Mini Bar Chart (pure SVG) ─────────────────────────────
function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  const barW = 40;
  const gap = 12;
  const chartH = 140;
  const chartW = data.length * (barW + gap) - gap;

  return (
    <svg
      viewBox={`0 0 ${chartW + 20} ${chartH + 30}`}
      className="w-full h-44"
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((val, i) => {
        const barH = (val / max) * chartH || 2;
        const x = i * (barW + gap) + 10;
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} className="fill-primary" />
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" className="fill-contrast text-[10px]">
              {labels[i]}
            </text>
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-dark text-[9px] font-semibold">
              {val > 0 ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stat Card ─────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon, color }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20", color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-contrast text-xs font-body">{title}</p>
        <p className="text-dark text-xl font-heading font-black mt-0.5 truncate">{value}</p>
        <p className="text-contrast text-xs mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Detalhe Financeiro Modal ───────────────────────────────
function DetalheFinanceiroModal({
  debito,
  open,
  onClose,
  onUpdate,
}: {
  debito: Debito | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (updated: Debito) => void;
}) {
  const { toast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const [isPago, setIsPago] = useState(false);
  const [isMotoristaPago, setIsMotoristaPago] = useState(false);
  const [isPrestadorPago, setIsPrestadorPago] = useState(false);
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod | "">("");
  const [financialSaving, setFinancialSaving] = useState(false);

  useEffect(() => {
    if (!open || !debito) return;
    setIsPago(debito.pago);
    setIsMotoristaPago(debito.motorista_pago ?? false);
    setIsPrestadorPago(debito.prestador_pago ?? false);
    setFinalPriceInput(debito.valor_final?.toString() ?? "");
    setPaymentMethodInput(debito.metodo_pagamento ?? "");
  }, [open, debito]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (overlay) overlay.style.animation = "fade-out 200ms ease-in forwards";
    if (content) content.style.animation = "modal-out 200ms ease-in forwards";
    setTimeout(() => { closingRef.current = false; onClose(); }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, handleClose]);

  if (!open || !debito) return null;

  const d = debito;
  const isViagem = d.tipo === "viagem";

  async function handleTogglePago() {
    const next = !isPago;
    setIsPago(next);
    try {
      if (isViagem) {
        await updateTripFinancial(d.id, { is_paid: next, payment_date: next ? new Date().toISOString() : null });
      } else {
        await updateServiceRequestFinancial(d.id, { is_paid: next });
      }
      onUpdate({ ...d, pago: next });
    } catch {
      setIsPago(!next);
      toast("danger", "Erro ao atualizar status de pagamento");
    }
  }

  async function handleToggleMotoristaPago() {
    const next = !isMotoristaPago;
    setIsMotoristaPago(next);
    try {
      await updateTripFinancial(d.id, { is_driver_paied: next });
      onUpdate({ ...d, motorista_pago: next });
    } catch {
      setIsMotoristaPago(!next);
      toast("danger", "Erro ao atualizar pagamento do motorista");
    }
  }

  async function handleTogglePrestadorPago() {
    const next = !isPrestadorPago;
    setIsPrestadorPago(next);
    try {
      await updateServiceRequestFinancial(d.id, { is_provider_paied: next });
      onUpdate({ ...d, prestador_pago: next });
    } catch {
      setIsPrestadorPago(!next);
      toast("danger", "Erro ao atualizar pagamento do prestador");
    }
  }

  async function handleSaveFinancial() {
    setFinancialSaving(true);
    try {
      const parsedPrice = finalPriceInput !== "" ? parseFloat(finalPriceInput) : null;
      const method = paymentMethodInput || null;
      if (isViagem) {
        await updateTripFinancial(d.id, { final_price: parsedPrice, payment_method: method });
      } else {
        await updateServiceRequestFinancial(d.id, { final_price: parsedPrice, payment_method: method });
      }
      onUpdate({ ...d, valor_final: parsedPrice, metodo_pagamento: method });
      toast("success", "Dados financeiros salvos");
    } catch {
      toast("danger", "Erro ao salvar dados financeiros");
    } finally {
      setFinancialSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
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
        className="relative bg-surface border border-border rounded-xl flex flex-col w-[480px] max-h-[90vh]"
        style={{ animation: "modal-in 300ms ease-out forwards" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                isViagem ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
              }`}>
                {isViagem ? "Viagem" : "Serviço"}
              </span>
              <span className="text-xs text-contrast">{formatDate(d.data)}</span>
            </div>
            <h2 className="text-base font-heading font-black text-dark leading-tight truncate">
              {d.descricao}
            </h2>
            <p className="text-xs text-contrast mt-0.5">{d.cliente} · {d.categoria}</p>
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

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border ${
              isPago ? "bg-accent/10 border-accent/30 text-accent" : "bg-danger/10 border-danger/30 text-danger"
            }`}>
              {isPago ? "✓ " : "✗ "}
              {isViagem ? (isPago ? "Corrida paga" : "Corrida não paga") : (isPago ? "Serviço pago" : "Serviço não pago")}
            </span>
            {isViagem && (
              <span className={`flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border ${
                isMotoristaPago ? "bg-accent/10 border-accent/30 text-accent" : "bg-warning/10 border-warning/30 text-warning"
              }`}
              style={!isMotoristaPago ? { backgroundColor: "#f59e0b10", borderColor: "#f59e0b30", color: "#f59e0b" } : undefined}
              >
                {isMotoristaPago ? "✓ " : "✗ "}
                {isMotoristaPago ? "Motorista pago" : "Motorista não pago"}
              </span>
            )}
            {!isViagem && (
              <span className={`flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border ${
                isPrestadorPago ? "bg-accent/10 border-accent/30 text-accent" : ""
              }`}
              style={!isPrestadorPago ? { backgroundColor: "#f59e0b10", borderColor: "#f59e0b30", color: "#f59e0b" } : undefined}
              >
                {isPrestadorPago ? "✓ " : "✗ "}
                {isPrestadorPago ? "Prestador pago" : "Prestador não pago"}
              </span>
            )}
          </div>

          {/* Values */}
          <div className="bg-background rounded-lg border border-border divide-y divide-border">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-xs text-contrast">Valor estimado</span>
              <span className="text-xs text-dark font-medium">{formatCurrency(d.valor_estimado)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-xs text-contrast">Valor final</span>
              <span className="text-xs text-dark font-medium">{formatCurrency(d.valor_final)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-xs text-contrast">Forma de pagamento</span>
              <span className="text-xs text-dark">{formatPaymentMethod(d.metodo_pagamento)}</span>
            </div>
            {d.payment_date && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-contrast">Data do pagamento</span>
                <span className="text-xs text-dark">{formatDate(d.payment_date)}</span>
              </div>
            )}
          </div>

          {/* Toggle actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleTogglePago}
              className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isPago
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {isPago
                ? (isViagem ? "Corrida paga ✓" : "Serviço pago ✓")
                : (isViagem ? "Marcar corrida como paga" : "Marcar serviço como pago")}
            </button>

            {isViagem && (
              <button
                onClick={handleToggleMotoristaPago}
                className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isMotoristaPago
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {isMotoristaPago ? "Motorista pago ✓" : "Marcar motorista como pago"}
              </button>
            )}

            {!isViagem && (
              <button
                onClick={handleTogglePrestadorPago}
                className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isPrestadorPago
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {isPrestadorPago ? "Prestador pago ✓" : "Marcar prestador como pago"}
              </button>
            )}
          </div>

          {/* Edit financial values */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-heading font-bold text-contrast uppercase tracking-wider mb-3">Editar valores</p>
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs text-contrast block mb-1">Valor final</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalPriceInput}
                  onChange={(e) => setFinalPriceInput(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full rounded-md bg-background border border-border text-dark text-xs font-body px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-contrast/40"
                />
              </div>
              <div>
                <label className="text-xs text-contrast block mb-1">Forma de pagamento</label>
                <select
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod | "")}
                  className="w-full rounded-md bg-background border border-border text-dark text-xs font-body px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                className="w-full py-2 rounded-lg bg-primary text-background text-xs font-heading font-bold hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50"
              >
                {financialSaving ? "Salvando..." : "Salvar valores"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────
export default function FinanceiroPage() {
  const { toast } = useToast();
  const [debitos, setDebitos] = useState<Debito[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pendentes" | "pagas">("pendentes");
  const [search, setSearch] = useState("");
  const [selectedDebito, setSelectedDebito] = useState<Debito | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadDebitos = useCallback(() => {
    setLoading(true);
    fetchDebitos()
      .then(setDebitos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDebitos();
  }, [loadDebitos]);

  // Update a single debito in state (from modal actions)
  const handleDebitoUpdate = useCallback((updated: Debito) => {
    setDebitos((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setSelectedDebito(updated);
  }, []);

  // Quick-action: toggle pago directly from table row
  async function handleQuickTogglePago(e: React.MouseEvent, d: Debito) {
    e.stopPropagation();
    setActioningId(d.id);
    const next = !d.pago;
    setDebitos((prev) => prev.map((x) => (x.id === d.id ? { ...x, pago: next } : x)));
    try {
      if (d.tipo === "viagem") {
        await updateTripFinancial(d.id, { is_paid: next, payment_date: next ? new Date().toISOString() : null });
      } else {
        await updateServiceRequestFinancial(d.id, { is_paid: next });
      }
    } catch {
      setDebitos((prev) => prev.map((x) => (x.id === d.id ? { ...x, pago: !next } : x)));
      toast("danger", "Erro ao atualizar pagamento");
    } finally {
      setActioningId(null);
    }
  }

  // Quick-action: toggle motorista pago directly from table row
  async function handleQuickToggleMotoristaPago(e: React.MouseEvent, d: Debito) {
    e.stopPropagation();
    setActioningId(d.id + "_mtr");
    const next = !(d.motorista_pago ?? false);
    setDebitos((prev) => prev.map((x) => (x.id === d.id ? { ...x, motorista_pago: next } : x)));
    try {
      await updateTripFinancial(d.id, { is_driver_paied: next });
    } catch {
      setDebitos((prev) => prev.map((x) => (x.id === d.id ? { ...x, motorista_pago: !next } : x)));
      toast("danger", "Erro ao atualizar pagamento do motorista");
    } finally {
      setActioningId(null);
    }
  }

  // ─── Stats ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const pagos = debitos.filter((d) => d.pago);
    const pendentes = debitos.filter((d) => !d.pago);

    const totalPago = pagos.reduce((sum, d) => sum + (d.valor_final ?? d.valor_estimado ?? 0), 0);
    const totalPendente = pendentes.reduce((sum, d) => sum + (d.valor_final ?? d.valor_estimado ?? 0), 0);

    const now = new Date();
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const total = pagos
        .filter((p) => { const pd = new Date(p.data); return pd >= monthStart && pd <= monthEnd; })
        .reduce((sum, p) => sum + (p.valor_final ?? p.valor_estimado ?? 0), 0);
      months.push({ label, total });
    }

    const currentMonth = months[months.length - 1]?.total ?? 0;
    const previousMonth = months[months.length - 2]?.total ?? 0;
    const growth = previousMonth > 0
      ? ((currentMonth - previousMonth) / previousMonth) * 100
      : currentMonth > 0 ? 100 : 0;

    return { totalPago, totalPendente, totalDebitos: debitos.length, growth, months };
  }, [debitos]);

  // ─── Filtered list ───────────────────────────────────────
  const filtered = useMemo(() => {
    const byTab = debitos.filter((d) => (tab === "pagas" ? d.pago : !d.pago));
    if (!search.trim()) return byTab;
    const q = search.toLowerCase();
    return byTab.filter(
      (d) =>
        d.descricao.toLowerCase().includes(q) ||
        d.cliente.toLowerCase().includes(q) ||
        d.categoria.toLowerCase().includes(q)
    );
  }, [debitos, tab, search]);

  const pendentesCount = debitos.filter((d) => !d.pago).length;
  const pagasCount = debitos.filter((d) => d.pago).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Financeiro</h1>
        <p className="text-contrast text-sm mt-1">Acompanhe a saúde financeira da operação</p>
      </div>

      {/* Stats + Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Receita Total"
          value={formatCurrency(stats.totalPago)}
          subtitle={
            stats.growth >= 0
              ? `↑ ${stats.growth.toFixed(1)}% vs. mês anterior`
              : `↓ ${Math.abs(stats.growth).toFixed(1)}% vs. mês anterior`
          }
          color="#22C55E"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <StatCard
          title="Pendente"
          value={formatCurrency(stats.totalPendente)}
          subtitle={`${pendentesCount} débito${pendentesCount !== 1 ? "s" : ""} aguardando pagamento`}
          color="#f59e0b"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />

        {/* Chart card */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <p className="text-contrast text-xs font-body mb-2">Receita Mensal (últimos 6 meses)</p>
          {stats.months.every((m) => m.total === 0) ? (
            <div className="flex items-center justify-center h-36 text-contrast text-xs">Sem dados de receita ainda</div>
          ) : (
            <BarChart data={stats.months.map((m) => m.total)} labels={stats.months.map((m) => m.label)} />
          )}
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          <button
            onClick={() => setTab("pendentes")}
            className={`px-4 py-1.5 rounded-md text-sm font-body transition-colors cursor-pointer ${
              tab === "pendentes" ? "bg-primary text-background font-semibold" : "text-contrast hover:text-dark"
            }`}
          >
            Pendentes ({pendentesCount})
          </button>
          <button
            onClick={() => setTab("pagas")}
            className={`px-4 py-1.5 rounded-md text-sm font-body transition-colors cursor-pointer ${
              tab === "pagas" ? "bg-primary text-background font-semibold" : "text-contrast hover:text-dark"
            }`}
          >
            Pagas ({pagasCount})
          </button>
        </div>
        <input
          type="text"
          placeholder="Buscar por descrição, cliente ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-sm font-body"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">Carregando dados financeiros...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-contrast text-sm">
          {search ? "Nenhum resultado encontrado" : tab === "pendentes" ? "Nenhum débito pendente" : "Nenhum débito pago"}
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-contrast text-left">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDebito(d)}
                    className="hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-dark whitespace-nowrap">{formatDate(d.data)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        d.tipo === "viagem" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
                      }`}>
                        {d.tipo === "viagem" ? "Viagem" : "Serviço"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark max-w-[240px] truncate">{d.descricao}</td>
                    <td className="px-4 py-3 text-contrast">{d.cliente}</td>
                    <td className="px-4 py-3 text-contrast">{d.categoria}</td>
                    <td className="px-4 py-3 text-dark text-right font-medium whitespace-nowrap">
                      {formatCurrency(d.valor_final ?? d.valor_estimado)}
                    </td>
                    <td className="px-4 py-3 text-contrast">{formatPaymentMethod(d.metodo_pagamento)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Pago toggle */}
                        <button
                          onClick={(e) => handleQuickTogglePago(e, d)}
                          disabled={actioningId === d.id}
                          title={d.pago
                            ? (d.tipo === "viagem" ? "Corrida paga" : "Serviço pago")
                            : (d.tipo === "viagem" ? "Marcar corrida como paga" : "Marcar serviço como pago")}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                            d.pago
                              ? "bg-accent/10 border-accent/30 text-accent"
                              : "bg-background border-border text-contrast hover:border-accent hover:text-accent"
                          }`}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {d.tipo === "viagem" ? "Corrida" : "Serviço"}
                        </button>

                        {/* Motorista pago toggle (trips only) */}
                        {d.tipo === "viagem" && (
                          <button
                            onClick={(e) => handleQuickToggleMotoristaPago(e, d)}
                            disabled={actioningId === d.id + "_mtr"}
                            title={d.motorista_pago ? "Motorista pago" : "Marcar motorista como pago"}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                              d.motorista_pago
                                ? "bg-accent/10 border-accent/30 text-accent"
                                : "bg-background border-border text-contrast hover:border-accent hover:text-accent"
                            }`}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Motorista
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <DetalheFinanceiroModal
        debito={selectedDebito}
        open={!!selectedDebito}
        onClose={() => setSelectedDebito(null)}
        onUpdate={handleDebitoUpdate}
      />
    </div>
  );
}
