"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import TripDetailModal from "@/components/TripDetailModal";
import { formatBrazilDateTime } from "@/lib/brazil-time";
import { labelForTripStatus } from "@/lib/notifications";
import type {
  ClientMetrics,
  ClientTripHistoryEntry,
  DriverMetricPeriod,
  Trip,
  User,
} from "@/types/database";

interface Props {
  client: User | null;
  open: boolean;
  onClose: () => void;
  metrics: ClientMetrics | null;
  history: ClientTripHistoryEntry[];
  period: DriverMetricPeriod;
  onPeriodChange: (period: DriverMetricPeriod) => void;
  loading: boolean;
  onTripUpdated?: () => void;
}

const periodOptions: { value: DriverMetricPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function shortAddr(addr: string | undefined | null): string {
  if (!addr) return "—";
  return addr.split(",")[0]?.trim() ?? addr;
}

export default function ClientTripHistoryModal({
  client,
  open,
  onClose,
  metrics,
  history,
  period,
  onPeriodChange,
  loading,
  onTripUpdated,
}: Props) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={client ? `Histórico de ${client.full_name}` : "Histórico"}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Realizadas</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {metrics?.finishedTrips ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Canceladas</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {metrics?.cancelledTrips ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Total gasto</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {formatBRL(metrics?.totalSpent ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-contrast">Avaliação</p>
              <p className="text-2xl font-heading font-bold text-dark">
                {metrics && metrics.averageRating > 0
                  ? metrics.averageRating.toFixed(1)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPeriodChange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-heading font-bold transition-colors ${
                  period === opt.value
                    ? "bg-primary text-background"
                    : "border border-border text-dark hover:bg-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-contrast">
              Carregando histórico...
            </p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-contrast">
              Nenhuma corrida no período selecionado.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((entry) => (
                <li key={entry.trip.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTrip(entry.trip)}
                    className="w-full rounded-lg border border-border bg-surface p-3 text-left hover:border-primary/40 hover:bg-background"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-bold text-dark">
                          {shortAddr(entry.trip.pickup_address?.formatted_address)} →{" "}
                          {shortAddr(entry.trip.dropoff_address?.formatted_address)}
                        </p>
                        <p className="mt-1 text-xs text-contrast">
                          {formatBrazilDateTime(entry.trip.scheduled_datetime)}
                        </p>
                        <p className="mt-1 text-xs text-contrast">
                          Motorista:{" "}
                          {entry.trip.driver_profiles?.provider_profiles?.users
                            ?.full_name ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-dark">
                          {labelForTripStatus(entry.trip.status)}
                        </span>
                        {entry.trip.final_price ? (
                          <span className="text-xs font-heading font-bold text-dark">
                            {formatBRL(Number(entry.trip.final_price))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        onUpdate={() => {
          onTripUpdated?.();
        }}
      />
    </>
  );
}
