"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { fetchDashboardStats } from "@/lib/api";
import type { TripStatus, ServiceRequestStatus } from "@/types/database";
import QuotationOverrideCard from "./QuotationOverrideCard";

// ─── Types ─────────────────────────────────────────────────
interface MonthlyBar {
  month: string;
  label: string;
  trips: number;
  services: number;
}

interface DashboardData {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueChange: number | null;
  pendingRevenue: number;
  avgTicket: number;
  activeOps: number;
  completionRate: number;
  avgRating: number;
  driversAvailable: number;
  pendingProviders: number;
  totalTrips: number;
  totalServices: number;
  monthlyRevenue: MonthlyBar[];
  paymentMap: Record<string, number>;
  topDrivers: TopDriver[];
  tripStatusMap: Record<string, number>;
  serviceStatusMap: Record<string, number>;
  alertAwaitingClient: number;
  alertAwaitingDriver: number;
  alertUnderReview: number;
  alertUnpaidFinished: number;
  recentTrips: RecentTrip[];
  recentServices: RecentService[];
}

interface TopDriver {
  driverProfileId: string;
  fullName: string;
  avatarUrl: string | null;
  count: number;
}

interface RecentTrip {
  id: string;
  status: TripStatus;
  scheduled_datetime: string;
  final_price?: number | null;
  estimated_price?: number | null;
  is_paid?: boolean;
  payment_method?: string | null;
  users?: { full_name: string } | null;
  pickup_address?: { formatted_address: string } | null;
  dropoff_address?: { formatted_address: string } | null;
}

interface RecentService {
  id: string;
  status: ServiceRequestStatus;
  service_date: string;
  description: string;
  final_price?: number | null;
  estimated_price?: number | null;
  is_paid?: boolean;
  payment_method?: string | null;
  users?: { full_name: string } | null;
  service_categories?: { name: string } | null;
}

// ─── Status maps ───────────────────────────────────────────
const tripStatusLabels: Record<TripStatus, string> = {
  open: "Aberta",
  under_review: "Em análise",
  review_rejected: "Rejeitada",
  searching_drivers: "Buscando motorista",
  awaiting_client_confirmation: "Aguard. cliente",
  awaiting_driver_confirmation: "Aguard. motorista",
  scheduled: "Agendada",
  started: "Em andamento",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

const serviceStatusLabels: Record<ServiceRequestStatus, string> = {
  open: "Aberto",
  under_review: "Em análise",
  review_rejected: "Rejeitado",
  searching_provider: "Buscando prestador",
  awaiting_client_confirmation: "Aguard. cliente",
  awaiting_provider_confirmation: "Aguard. prestador",
  assigned: "Atribuído",
  in_progress: "Em andamento",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  open: "#FEBF22",
  under_review: "#94A3B8",
  review_rejected: "#ef4444",
  searching_drivers: "#2261FE",
  searching_provider: "#2261FE",
  awaiting_client_confirmation: "#f97316",
  awaiting_driver_confirmation: "#f97316",
  scheduled: "#2261FE",
  assigned: "#2261FE",
  started: "#22c55e",
  in_progress: "#22c55e",
  finished: "#22c55e",
  cancelled: "#ef4444",
};

const PAYMENT_COLORS: Record<string, string> = {
  pix: "#22C55E",
  debit: "#2261FE",
  credit: "#FEBF22",
  cash: "#f97316",
  billing: "#A855F7",
  outro: "#94A3B8",
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  debit: "Débito",
  credit: "Crédito",
  cash: "Dinheiro",
  billing: "Boleto",
  outro: "Outro",
};

// ─── Helpers ───────────────────────────────────────────────
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

// ─── Count-up hook ─────────────────────────────────────────
function useCountUp(target: number, duration = 900, decimals = 0): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (target === 0) {
      setVal(0);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Number((eased * target).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);
  return val;
}

// ─── Skeleton ──────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-surface-hover rounded-lg animate-pulse ${className}`} />;
}

// ─── Bar Chart ─────────────────────────────────────────────
function BarChart({ data, loaded }: { data: MonthlyBar[]; loaded: boolean }) {
  const maxVal = Math.max(...data.map((d) => d.trips + d.services), 1);

  return (
    <div>
      <div className="relative flex items-end gap-1.5" style={{ height: 148 }}>
        {/* Gridlines at 25 / 50 / 75 / 100% */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-border pointer-events-none"
            style={{ bottom: `${pct * 100}%`, opacity: 0.4 }}
          />
        ))}

        {data.map((bar, i) => {
          const total = bar.trips + bar.services;
          const totalPct = (total / maxVal) * 100;

          return (
            <div
              key={bar.month}
              className="relative flex-1 flex flex-col justify-end h-full"
            >
              {total === 0 ? (
                <div
                  className="w-full rounded"
                  style={{ height: 3, backgroundColor: "var(--color-border)", opacity: 0.5 }}
                />
              ) : (
                <div
                  className="w-full overflow-hidden"
                  style={{
                    height: loaded ? `${totalPct}%` : "0%",
                    minHeight: loaded ? 3 : 0,
                    borderRadius: "4px 4px 0 0",
                    transition: `height 0.65s cubic-bezier(0.34,1.56,0.64,1) ${i * 75}ms`,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Trips (blue) — top segment */}
                  <div
                    style={{
                      flex: bar.trips,
                      backgroundColor: "#2261FE",
                      minHeight: bar.trips > 0 ? 1 : 0,
                    }}
                  />
                  {/* Services (amber) — bottom segment */}
                  <div
                    style={{
                      flex: bar.services,
                      backgroundColor: "#FEBF22",
                      minHeight: bar.services > 0 ? 1 : 0,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Month labels */}
      <div className="flex gap-1.5 mt-2">
        {data.map((bar) => (
          <div key={bar.month} className="flex-1 text-center">
            <span className="text-[10px] text-contrast">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut Chart ───────────────────────────────────────────
function DonutChart({
  data,
  loaded,
  size = 108,
}: {
  data: Record<string, number>;
  loaded: boolean;
  size?: number;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const r = size * 0.35;
  const sw = size * 0.15;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const GAP = 1.5;

  let cumulative = 0;

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        {entries.length === 0 ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={sw}
            className="text-border"
          />
        ) : (
          entries.map(([method, count], i) => {
            const pct = count / total;
            const dashLen = Math.max(pct * C - GAP, 0);
            const offset = C - cumulative;
            cumulative += pct * C;
            return (
              <circle
                key={method}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={PAYMENT_COLORS[method] ?? PAYMENT_COLORS.outro}
                strokeWidth={sw}
                strokeDasharray={`${loaded ? dashLen : 0} ${C}`}
                strokeDashoffset={offset}
                style={{
                  transition: `stroke-dasharray 0.75s ease ${i * 110}ms`,
                }}
              />
            );
          })
        )}
        {/* Inner hole */}
        <circle cx={cx} cy={cy} r={r - sw / 2 - 1} fill="var(--color-surface)" />
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {entries.slice(0, 5).map(([method, count]) => (
          <div key={method} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: PAYMENT_COLORS[method] ?? PAYMENT_COLORS.outro }}
            />
            <span className="text-xs text-contrast truncate">
              {PAYMENT_LABELS[method] ?? method}
            </span>
            <span className="text-xs font-heading font-black text-dark ml-auto">
              {Math.round((count / total) * 100)}%
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <span className="text-xs text-contrast/50">Sem dados</span>
        )}
      </div>
    </div>
  );
}

// ─── Funnel Bar ────────────────────────────────────────────
function FunnelBar({
  label,
  count,
  total,
  color,
  loaded,
  delay = 0,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  loaded: boolean;
  delay?: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-contrast w-32 shrink-0 truncate leading-tight">
        {label}
      </span>
      <div className="flex-1 h-[18px] bg-surface-hover rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full absolute left-0 top-0"
          style={{
            backgroundColor: color + "CC",
            width: loaded ? `${Math.max(pct, count > 0 ? 2 : 0)}%` : "0%",
            transition: `width 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
          }}
        />
      </div>
      <span className="text-xs font-heading font-black text-dark w-7 text-right shrink-0 tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats()
      .then((d) => {
        setData(d as unknown as DashboardData);
        requestAnimationFrame(() => setTimeout(() => setLoaded(true), 40));
      })
      .catch((err) => {
        console.error("[Dashboard]", err);
        setError("Erro ao carregar dados. Verifique o console para detalhes.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Animated KPI values
  const revenue = useCountUp(data?.revenueThisMonth ?? 0, 1000);
  const pending = useCountUp(data?.pendingRevenue ?? 0, 950);
  const activeOps = useCountUp(data?.activeOps ?? 0, 750);
  const completion = useCountUp(data?.completionRate ?? 0, 800);
  const avgRating = useCountUp(data?.avgRating ?? 0, 750, 1);

  // Alerts (only show non-zero)
  const alerts = data
    ? [
        {
          label: "Aguardando confirmação do cliente",
          count: data.alertAwaitingClient,
          href: "/viagens",
          color: "#f97316",
        },
        {
          label: "Aguardando validação do motorista",
          count: data.alertAwaitingDriver,
          href: "/viagens",
          color: "#FEBF22",
        },
        {
          label: "Itens sob análise",
          count: data.alertUnderReview,
          href: "/viagens",
          color: "#94A3B8",
        },
        {
          label: "Prestadores pendentes",
          count: data.pendingProviders,
          href: "/prestadores",
          color: "#A855F7",
        },
        {
          label: "Finalizados não pagos",
          count: data.alertUnpaidFinished,
          href: "/financeiro",
          color: "#ef4444",
        },
      ].filter((a) => a.count > 0)
    : [];

  // Funnel data
  const tripFunnel = [
    { label: "Abertas", statuses: ["open"], color: "#FEBF22" },
    { label: "Em análise", statuses: ["under_review"], color: "#94A3B8" },
    { label: "Buscando motorista", statuses: ["searching_drivers"], color: "#2261FE" },
    {
      label: "Cliente/validação",
      statuses: ["awaiting_client_confirmation", "awaiting_driver_confirmation"],
      color: "#f97316",
    },
    { label: "Agendadas", statuses: ["scheduled"], color: "#2261FE" },
    { label: "Em andamento", statuses: ["started"], color: "#22C55E" },
    { label: "Finalizadas", statuses: ["finished"], color: "#22C55E" },
    { label: "Canceladas", statuses: ["cancelled"], color: "#ef4444" },
  ].map((item) => ({
    ...item,
    count: item.statuses.reduce(
      (sum, s) => sum + (data?.tripStatusMap[s] ?? 0),
      0
    ),
  }));

  const serviceFunnel = [
    { label: "Abertos", statuses: ["open"], color: "#FEBF22" },
    { label: "Em análise", statuses: ["under_review"], color: "#94A3B8" },
    { label: "Buscando prestador", statuses: ["searching_provider"], color: "#2261FE" },
    { label: "Atribuídos", statuses: ["assigned"], color: "#2261FE" },
    { label: "Em andamento", statuses: ["in_progress"], color: "#22C55E" },
    { label: "Finalizados", statuses: ["finished"], color: "#22C55E" },
    { label: "Cancelados", statuses: ["cancelled"], color: "#ef4444" },
  ].map((item) => ({
    ...item,
    count: item.statuses.reduce(
      (sum, s) => sum + (data?.serviceStatusMap[s] ?? 0),
      0
    ),
  }));

  const tripTotal = tripFunnel.reduce((s, i) => s + i.count, 0);
  const serviceTotal = serviceFunnel.reduce((s, i) => s + i.count, 0);

  // Unified activity feed
  const recentActivity = [
    ...(data?.recentTrips ?? []).map((t) => ({
      id: t.id,
      tipo: "viagem" as const,
      status: t.status,
      statusLabel: tripStatusLabels[t.status],
      date: t.scheduled_datetime,
      value: t.final_price ?? t.estimated_price ?? null,
      isPaid: t.is_paid ?? false,
      client: t.users?.full_name ?? "—",
      description: t.pickup_address
        ? `${t.pickup_address.formatted_address.split(",")[0]} → ${
            t.dropoff_address?.formatted_address.split(",")[0] ?? "—"
          }`
        : "Viagem",
    })),
    ...(data?.recentServices ?? []).map((s) => ({
      id: s.id,
      tipo: "servico" as const,
      status: s.status,
      statusLabel: serviceStatusLabels[s.status],
      date: s.service_date,
      value: s.final_price ?? s.estimated_price ?? null,
      isPaid: s.is_paid ?? false,
      client: s.users?.full_name ?? "—",
      description:
        s.service_categories?.name ??
        (s.description.length > 45
          ? s.description.slice(0, 45) + "…"
          : s.description),
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  // KPI cards config
  const kpiCards = [
    {
      label: "Receita do Mês",
      value: formatCurrency(revenue),
      change: data?.revenueChange,
      accent: "#FEBF22",
      highlight: true,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Receita Pendente",
      value: formatCurrency(pending),
      accent: "#f97316",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Ops. Ativas",
      value: String(activeOps),
      accent: "#22C55E",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: "Conclusão (30d)",
      value: `${completion}%`,
      accent: "#2261FE",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      label: "Avaliação Média",
      value: (data?.avgRating ?? 0) > 0 ? `${avgRating.toFixed(1)} ★` : "—",
      accent: "#FEBF22",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="flex items-end justify-between"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Dashboard
          </h1>
          <p className="text-contrast text-sm mt-0.5">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-contrast pb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block animate-pulse" />
          Ao vivo
        </div>
      </div>

      {/* ── Zone 1: KPI Cards ───────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px]" />
            ))
          : kpiCards.map((card, i) => (
              <div
                key={card.label}
                className="bg-surface rounded-xl border border-border p-4 overflow-hidden transition-shadow duration-200 hover:shadow-md"
                style={{
                  borderLeftWidth: "3px",
                  borderLeftColor: card.accent,
                  opacity: loaded ? 1 : 0,
                  transform: loaded ? "translateY(0)" : "translateY(14px)",
                  transition: `opacity 0.45s ease ${i * 55}ms, transform 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 55}ms, box-shadow 0.2s ease`,
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5"
                  style={{
                    backgroundColor: `${card.accent}1A`,
                    color: card.accent,
                  }}
                >
                  {card.icon}
                </div>

                <p
                  className="text-xl md:text-2xl font-heading font-black leading-none tabular-nums"
                  style={{
                    color: card.highlight ? card.accent : "var(--color-dark)",
                  }}
                >
                  {card.value}
                </p>

                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-contrast leading-tight">{card.label}</p>
                  {card.change !== undefined && card.change !== null && (
                    <span
                      className="text-xs font-heading font-black tabular-nums"
                      style={{ color: card.change >= 0 ? "#22C55E" : "#ef4444" }}
                    >
                      {card.change >= 0 ? "+" : ""}
                      {card.change.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* ── Zone 2: Charts ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Monthly revenue bar chart */}
        <div
          className="md:col-span-2 bg-surface rounded-xl border border-border p-5"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease 0.32s, transform 0.5s ease 0.32s",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-black text-dark text-sm">
              Receita Mensal
            </h2>
            <div className="flex items-center gap-4 text-xs text-contrast">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-[#2261FE] inline-block" />
                Viagens
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-primary inline-block" />
                Serviços
              </span>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-40" />
          ) : (
            <BarChart data={data?.monthlyRevenue ?? []} loaded={loaded} />
          )}
        </div>

        {/* Top drivers (últimos 30 dias) */}
        <div
          className="bg-surface rounded-xl border border-border p-5"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease 0.42s, transform 0.5s ease 0.42s",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-black text-dark text-sm">
              Motoristas em destaque
            </h2>
            <span className="text-xs text-contrast">30d</span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <Skeleton className="flex-1 h-3" />
                  <Skeleton className="w-8 h-4" />
                </div>
              ))}
            </div>
          ) : (data?.topDrivers?.length ?? 0) === 0 ? (
            <p className="text-xs text-contrast/60 text-center py-6">
              Nenhuma viagem finalizada nos últimos 30 dias.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {data!.topDrivers.map((d, i) => {
                const initial = d.fullName.charAt(0).toUpperCase() || "?";
                return (
                  <li
                    key={d.driverProfileId}
                    className="flex items-center gap-3"
                    style={{
                      opacity: loaded ? 1 : 0,
                      transform: loaded ? "translateX(0)" : "translateX(-6px)",
                      transition: `opacity 0.4s ease ${0.5 + i * 0.06}s, transform 0.4s ease ${0.5 + i * 0.06}s`,
                    }}
                  >
                    <span className="text-xs text-contrast font-heading font-black w-4 tabular-nums shrink-0">
                      {i + 1}
                    </span>
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-hover shrink-0 flex items-center justify-center">
                      {d.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.avatarUrl}
                          alt={d.fullName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xs font-bold text-dark">{initial}</span>
                      )}
                    </div>
                    <span className="flex-1 text-sm text-dark truncate">
                      {d.fullName}
                    </span>
                    <span className="text-xs font-heading font-black text-dark tabular-nums shrink-0">
                      {d.count} {d.count === 1 ? "corrida" : "corridas"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* ── Zone 3: Funnels ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Trip distribution */}
        <div
          className="bg-surface rounded-xl border border-border p-5"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-black text-dark text-sm">
                Distribuição de Viagens
              </h2>
              <p className="text-xs text-contrast mt-0.5">
                {tripTotal} total
              </p>
            </div>
            <Link
              href="/viagens"
              className="text-xs text-accent hover:text-accent-dark transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[18px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {tripFunnel.map((item, i) => (
                <FunnelBar
                  key={item.label}
                  label={item.label}
                  count={item.count}
                  total={tripTotal}
                  color={item.color}
                  loaded={loaded}
                  delay={i * 55}
                />
              ))}
            </div>
          )}
        </div>

        {/* Service distribution */}
        <div
          className="bg-surface rounded-xl border border-border p-5"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease 0.56s, transform 0.5s ease 0.56s",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-black text-dark text-sm">
                Distribuição de Serviços
              </h2>
              <p className="text-xs text-contrast mt-0.5">
                {serviceTotal} total
              </p>
            </div>
            <Link
              href="/outros-servicos"
              className="text-xs text-accent hover:text-accent-dark transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[18px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {serviceFunnel.map((item, i) => (
                <FunnelBar
                  key={item.label}
                  label={item.label}
                  count={item.count}
                  total={serviceTotal}
                  color={item.color}
                  loaded={loaded}
                  delay={i * 55}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Zone 3.5: Quotation Override ──────────── */}
      <QuotationOverrideCard />

      {/* ── Zone 4: Action Alerts ───────────────────── */}
      {!loading && alerts.length > 0 && (
        <div
          className="bg-surface rounded-xl border border-border p-5"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease 0.62s, transform 0.5s ease 0.62s",
          }}
        >
          <h2 className="font-heading font-black text-dark text-sm mb-3">
            Requer Atenção
          </h2>
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <Link
                key={alert.label}
                href={alert.href}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99]"
                style={{
                  borderColor: `${alert.color}35`,
                  backgroundColor: `${alert.color}0E`,
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-heading font-black text-white shrink-0 tabular-nums"
                  style={{ backgroundColor: alert.color }}
                >
                  {alert.count > 99 ? "99+" : alert.count}
                </span>
                <span className="text-xs text-dark">{alert.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone 5: Activity Feed ───────────────────── */}
      <div
        className="bg-surface rounded-xl border border-border overflow-hidden"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.5s ease 0.68s, transform 0.5s ease 0.68s",
        }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-black text-dark text-sm">
            Atividade Recente
          </h2>
          <span className="text-xs text-contrast">
            {recentActivity.length} itens
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-2.5 w-52" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-contrast/50 text-sm">Nenhuma atividade recente</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.map((item, i) => {
              const color = statusColors[item.status] ?? "#94A3B8";
              return (
                <div
                  key={`${item.tipo}-${item.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-surface-hover transition-colors duration-100 cursor-default"
                  style={{
                    opacity: loaded ? 1 : 0,
                    transform: loaded ? "translateX(0)" : "translateX(-6px)",
                    transition: `opacity 0.35s ease ${0.72 + i * 0.045}s, transform 0.35s ease ${0.72 + i * 0.045}s`,
                  }}
                >
                  {/* Type icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        item.tipo === "viagem" ? "#2261FE18" : "#FEBF2218",
                      color: item.tipo === "viagem" ? "#2261FE" : "#FEBF22",
                    }}
                  >
                    {item.tipo === "viagem" ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-dark truncate">
                        {item.client}
                      </span>
                      <span className="text-xs text-contrast/50 shrink-0 hidden sm:inline tabular-nums">
                        {new Date(item.date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-contrast mt-0.5 truncate">
                      {item.description}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 hidden md:inline"
                    style={{
                      backgroundColor: `${color}15`,
                      color,
                    }}
                  >
                    {item.statusLabel}
                  </span>

                  {/* Value */}
                  {item.value != null && item.value > 0 ? (
                    <div className="text-right shrink-0 min-w-[56px]">
                      <p
                        className="text-sm font-heading font-black tabular-nums"
                        style={{
                          color: item.isPaid ? "#22C55E" : "var(--color-dark)",
                        }}
                      >
                        {formatCurrency(item.value)}
                      </p>
                      {item.isPaid && (
                        <p className="text-[10px] text-contrast/50 leading-none mt-0.5">
                          pago
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-contrast/30 shrink-0 min-w-[56px] text-right">
                      —
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
