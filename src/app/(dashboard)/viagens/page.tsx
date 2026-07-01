"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, {
  type KanbanListColumn,
} from "@/components/KanbanListView";
import TripDetailModal from "@/components/TripDetailModal";
import NovaViagemForm from "@/components/forms/NovaViagemForm";
import { useToast } from "@/components/Toast";
import {
  fetchTripDriverCandidates,
  fetchTripDriverCandidatesForTrips,
  fetchTrips,
  updateTripStatus,
} from "@/lib/api";
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
import { filterTripsBySearch } from "@/lib/trip-search";
import type { Trip, TripDriverCandidate, TripStatus } from "@/types/database";

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

function groupCandidatesByTrip(candidates: TripDriverCandidate[]) {
  return candidates.reduce<Record<string, TripDriverCandidate[]>>(
    (acc, candidate) => {
      acc[candidate.trip_id] = [...(acc[candidate.trip_id] ?? []), candidate];
      return acc;
    },
    {},
  );
}

function getCandidateDriverNames(candidates: TripDriverCandidate[]) {
  return candidates
    .map(
      (candidate) =>
        candidate.driver_profiles?.provider_profiles?.users?.full_name,
    )
    .filter(Boolean)
    .join(", ");
}

export default function ViagensPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const openedTripFromUrlRef = useRef<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [candidatesByTrip, setCandidatesByTrip] = useState<
    Record<string, TripDriverCandidate[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripSearch, setTripSearch] = useState("");
  const [viewedTripIds, setViewedTripIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [viewMode, setViewMode] = useState<'list' | 'board'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'board'
  );
  const openTripId = searchParams.get("openTrip");
  const highlightedTripId = openTripId ?? searchParams.get("highlightTrip");

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const nextTrips = await fetchTrips();
      setTrips(nextTrips);

      const candidates = await fetchTripDriverCandidatesForTrips(
        nextTrips.map((trip) => trip.id),
      );
      setCandidatesByTrip(groupCandidatesByTrip(candidates));
    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
    } finally {
      setLoading(false);
    }
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

    setViewedTripIds((current) => new Set(current).add(highlightedTripId));
    if (openTripId && openedTripFromUrlRef.current !== openTripId) {
      openedTripFromUrlRef.current = openTripId;
      setSelectedTrip(targetTrip);
    }

    window.setTimeout(() => {
      setViewMode(window.innerWidth < 768 ? "list" : "board");
      const card = document.querySelector(
        `[data-card-id="${CSS.escape(highlightedTripId)}"]`,
      );
      card?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 100);
  }, [highlightedTripId, loading, openTripId, trips]);

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
      if (trip) {
        setViewedTripIds((current) => new Set(current).add(cardId));
        setSelectedTrip(trip);
      }
    },
    [trips]
  );

  const isSearching = tripSearch.trim().length > 0;
  const visibleTrips = useMemo(
    () => filterTripsBySearch(trips, tripSearch, candidatesByTrip),
    [candidatesByTrip, tripSearch, trips],
  );

  const columns = tripColumnConfig.map((col) => {
    const colTrips = (isSearching ? visibleTrips : trips).filter(
      (t) => t.status === col.id,
    );
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
        requiresAttention:
          isTripAdminActionRequired(t.status) && !viewedTripIds.has(t.id),
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

      <div className="mb-4">
        <label htmlFor="trip-search" className="sr-only">
          Pesquisar viagens
        </label>
        <input
          id="trip-search"
          type="text"
          value={tripSearch}
          onChange={(event) => setTripSearch(event.target.value)}
          placeholder="Pesquisar por cliente, motorista, destino, origem ou status"
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-dark outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {!isSearching && (
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
      )}

      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">Carregando viagens...</div>
      ) : isSearching ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-contrast">
            {visibleTrips.length} resultado{visibleTrips.length === 1 ? "" : "s"}
          </p>
          {visibleTrips.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              Nenhuma viagem encontrada
            </div>
          ) : (
            visibleTrips.map((trip) => {
              const column = tripColumnConfig.find(
                (item) => item.id === trip.status,
              );
              const candidateNames = getCandidateDriverNames(
                candidatesByTrip[trip.id] ?? [],
              );
              const assignedDriver =
                trip.driver_profiles?.provider_profiles?.users?.full_name;

              return (
                <button
                  key={trip.id}
                  type="button"
                  data-card-id={trip.id}
                  onClick={() => handleCardClick(trip.id)}
                  className="w-full rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 hover:bg-background"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-bold text-dark">
                        {shortenAddress(trip.pickup_address?.formatted_address)} →{" "}
                        {shortenAddress(trip.dropoff_address?.formatted_address)}
                      </p>
                      <p className="mt-1 text-xs text-contrast">
                        Cliente: {trip.users?.full_name ?? "—"} ·{" "}
                        {formatDate(trip.scheduled_datetime)}
                      </p>
                      <p className="mt-1 text-xs text-contrast">
                        Motorista: {assignedDriver || candidateNames || "—"}
                      </p>
                    </div>
                    <span
                      className="w-fit rounded-md px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `${column?.color ?? "#5C5956"}20`,
                        color: column?.color ?? "#5C5956",
                      }}
                    >
                      {column?.title ?? labelForTripStatus(trip.status)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
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
