"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, { type KanbanListColumn } from "@/components/KanbanListView";
import TripDetailModal from "@/components/TripDetailModal";
import NovaViagemForm from "@/components/forms/NovaViagemForm";
import { useToast } from "@/components/Toast";
import { fetchTripDriverCandidates, fetchTrips, updateTripStatus } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  labelForTripStatus,
  requestNotificationPermission,
  showNotification,
} from "@/lib/notifications";
import {
  canMoveTripStatus,
  getClientConfirmationBlockReason,
  getTripStatusActions,
  isTripAdminActionRequired,
} from "@/lib/trip-status";
import { formatBrazilDateTime } from "@/lib/brazil-time";
import type { Trip, TripStatus } from "@/types/database";

const tripColumnConfig: { id: TripStatus; title: string; color: string }[] = [
  { id: "open", title: "Aberta", color: "#FEBF22" },
  { id: "under_review", title: "Em Análise", color: "#5C5956" },
  { id: "searching_drivers", title: "Buscando Motorista", color: "#2261FE" },
  { id: "awaiting_client_confirmation", title: "Aguardando Cliente", color: "#f97316" },
  { id: "awaiting_driver_confirmation", title: "Aguardando Validação Motorista", color: "#f97316" },
  { id: "scheduled", title: "Agendada", color: "#2261FE" },
  { id: "started", title: "Em Andamento", color: "#22c55e" },
  { id: "finished", title: "Finalizada", color: "#22c55e" },
  { id: "cancelled", title: "Cancelada", color: "#ef4444" },
];

function shortenAddress(addr: string | undefined | null) {
  if (!addr) return "—";
  const parts = addr.split(",");
  return parts[0]?.trim() ?? addr;
}

function formatDate(dateStr: string) {
  return formatBrazilDateTime(dateStr);
}

export default function ViagensPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'board'
  );
  const highlightedTripId = searchParams.get("highlightTrip");

  const loadTrips = useCallback(() => {
    setLoading(true);
    fetchTrips()
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadTrips);
  }, [loadTrips]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!highlightedTripId || loading) return;

    const targetTrip = trips.find((trip) => trip.id === highlightedTripId);
    if (!targetTrip) return;

    window.setTimeout(() => {
      setViewMode(window.innerWidth < 768 ? "list" : "board");
      const card = document.querySelector(
        `[data-card-id="${CSS.escape(highlightedTripId)}"]`,
      );
      card?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 100);
  }, [highlightedTripId, loading, trips]);

  useEffect(() => {
    const channel = supabase
      .channel("trips-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trips" },
        (payload) => {
          const next = payload.new as Trip;
          setTrips((current) =>
            current.some((trip) => trip.id === next.id)
              ? current
              : [next, ...current],
          );
          showNotification(
            "Nova viagem solicitada",
            `Status: ${labelForTripStatus(next.status)}`
          );
          loadTrips();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips" },
        (payload) => {
          const next = payload.new as Trip;
          const prev = payload.old as Partial<Trip>;
          // payload.old só carrega colunas alteradas (REPLICA IDENTITY DEFAULT).
          // Notificar apenas quando status estiver presente em old (mudou de fato).
          if (prev.status !== undefined && prev.status !== next.status) {
            showNotification(
              "Viagem atualizada",
              `Status: ${labelForTripStatus(prev.status)} → ${labelForTripStatus(next.status)}`
            );
          }
          loadTrips();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "trips" },
        () => loadTrips()
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Erro no realtime de viagens:", error);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTrips]);

  const handleCardMove = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string) => {
      const newStatus = toColumnId as TripStatus;
      if (
        fromColumnId === "searching_drivers" &&
        toColumnId === "awaiting_client_confirmation"
      ) {
        try {
          const candidates = await fetchTripDriverCandidates(cardId);
          const blockReason = getClientConfirmationBlockReason(candidates);
          if (blockReason) {
            toast("warning", blockReason);
            return;
          }
        } catch {
          toast("danger", "Erro ao verificar preços aprovados dos motoristas");
          return;
        }
      }

      // Optimistic update
      setTrips((prev) =>
        prev.map((t) => (t.id === cardId ? { ...t, status: newStatus } : t))
      );
      try {
        await updateTripStatus(cardId, newStatus);
        toast("success", "Status da viagem atualizado");
      } catch {
        toast("danger", "Erro ao atualizar status");
        loadTrips(); // Rollback
      }
    },
    [toast, loadTrips]
  );

  const handleCardClick = useCallback(
    (cardId: string) => {
      const trip = trips.find((t) => t.id === cardId);
      if (trip) setSelectedTrip(trip);
    },
    [trips]
  );

  const columns = tripColumnConfig.map((col) => {
    const colTrips = trips.filter((t) => t.status === col.id);
    return {
      ...col,
      actions: getTripStatusActions(col.id),
      cards: colTrips.map((t) => ({
        id: t.id,
        title: `${shortenAddress(t.pickup_address?.formatted_address)} → ${shortenAddress(t.dropoff_address?.formatted_address)}`,
        subtitle: `${t.users?.full_name ?? "—"} • ${t.passenger_count} passageiro${t.passenger_count !== 1 ? "s" : ""}`,
        date: formatDate(t.scheduled_datetime),
        ...(t.is_round_trip ? { tag: "Ida e volta", tagColor: "#2261FE" } : {}),
        ...(t.is_paid ? { tag: "Pago", tagColor: "#22c55e" } : {}),
        requiresAttention: isTripAdminActionRequired(t.status),
      })),
    };
  });

  const listColumns: KanbanListColumn[] = columns.map((col) => ({
    ...col,
    actions: getTripStatusActions(col.id),
  }));

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Viagens</h1>
          <p className="text-contrast text-sm mt-1">
            Gerencie todas as viagens da plataforma
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-background px-3 py-2 md:px-5 md:py-2.5 rounded-lg font-heading font-bold text-xs md:text-sm whitespace-nowrap hover:bg-primary-dark transition-colors duration-200 cursor-pointer"
        >
          + Nova Viagem
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'list' ? 'bg-primary text-background' : 'bg-surface border border-border text-dark'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Lista
        </button>
        <button
          onClick={() => setViewMode('board')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'board' ? 'bg-primary text-background' : 'bg-surface border border-border text-dark'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          Board
        </button>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">Carregando viagens...</div>
      ) : viewMode === 'list' ? (
        <KanbanListView
          columns={listColumns}
          onMoveCard={(cardId, fromCol, toCol) => handleCardMove(cardId, fromCol, toCol)}
          onCardClick={(card) => handleCardClick(card.id)}
          highlightedCardId={highlightedTripId}
        />
      ) : (
        <div className="overflow-x-auto">
          <KanbanBoard
            columns={columns}
            onCardMove={handleCardMove}
            onCardClick={(cardId) => handleCardClick(cardId)}
            highlightedCardId={highlightedTripId}
            canMoveCard={(fromCol, toCol) =>
              canMoveTripStatus(fromCol as TripStatus, toCol as TripStatus, "forward")
            }
          />
        </div>
      )}

      <NovaViagemForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadTrips}
      />

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        onUpdate={loadTrips}
      />
    </div>
  );
}
