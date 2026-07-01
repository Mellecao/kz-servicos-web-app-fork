"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  Trip,
  TripDriverCandidate,
  TripDriverCandidateStatus,
  TripStatusHistory,
  DriverProfile,
  DriverTripHistoryEntry,
} from "@/types/database";
import {
  fetchTripById,
  fetchTripStatusHistory,
  fetchTripDriverCandidates,
  fetchDriverProfiles,
  updateTripStatus,
  approveTrip,
  rejectTrip,
  cancelTrip,
  deleteTrip,
  addTripDriverCandidate,
  removeTripDriverCandidate,
  updateTripDriverCandidateStatus,
  updateTripDriverCandidatePrice,
  rejectTripDriverCandidatePrice,
  sendKzDriverProposal,
  updateTripFinancial,
  selectTripDriver,
  approveDriverCandidate,
  resendDriverConfirmationNotification,
  fetchDriverTripHistory,
} from "@/lib/api";
import {
  getClientConfirmationBlockReason,
  getTripStatusActions,
} from "@/lib/trip-status";
import { canAdminApproveForClient } from "@/lib/trip-candidate-actions";
import { useToast } from "@/components/Toast";
import SearchableSelect from "@/components/SearchableSelect";
import { supabase } from "@/lib/supabase";
import { formatBrazilDateTime } from "@/lib/brazil-time";

interface TripDetailModalProps {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const statusLabels: Record<string, string> = {
  open: "Aberta",
  under_review: "Em Análise",
  review_rejected: "Rejeitada na Análise",
  searching_drivers: "Buscando Motorista",
  awaiting_client_confirmation: "Aguardando Confirmação do Cliente",
  awaiting_driver_confirmation: "Aguardando Validação do Motorista",
  scheduled: "Agendada",
  started: "Em Andamento",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "#FEBF2220", text: "#FEBF22" },
  under_review: { bg: "#94A3B820", text: "#94A3B8" },
  review_rejected: { bg: "#ef444420", text: "#ef4444" },
  searching_drivers: { bg: "#2261FE20", text: "#2261FE" },
  awaiting_client_confirmation: { bg: "#2261FE20", text: "#2261FE" },
  awaiting_driver_confirmation: { bg: "#f9731620", text: "#f97316" },
  scheduled: { bg: "#2261FE20", text: "#2261FE" },
  started: { bg: "#22c55e20", text: "#22c55e" },
  finished: { bg: "#22c55e20", text: "#22c55e" },
  cancelled: { bg: "#ef444420", text: "#ef4444" },
};

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  cash: "Dinheiro",
  billing: "Faturamento",
};

const candidateStatusLabels: Record<TripDriverCandidateStatus, string> = {
  pending: "pendente",
  accepted: "aceito",
  rejected: "rejeitado",
};

const candidateStatusColors: Record<
  TripDriverCandidateStatus,
  { bg: string; text: string }
> = {
  pending: { bg: "#FEBF2220", text: "#FEBF22" },
  accepted: { bg: "#22c55e20", text: "#22c55e" },
  rejected: { bg: "#ef444420", text: "#ef4444" },
};

function formatDate(dateStr: string) {
  return formatBrazilDateTime(dateStr);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function shortenAddress(addr: string | undefined | null) {
  if (!addr) return "—";
  const parts = addr.split(",");
  return parts[0]?.trim() ?? addr;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border last:border-0">
      <span className="text-xs text-contrast font-body shrink-0 mr-4">
        {label}
      </span>
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

export default function TripDetailModal({
  trip,
  open,
  onClose,
  onUpdate,
}: TripDetailModalProps) {
  const { toast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const [liveTrip, setLiveTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<TripStatusHistory[]>([]);
  const [candidates, setCandidates] = useState<TripDriverCandidate[]>([]);
  const [allDrivers, setAllDrivers] = useState<DriverProfile[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Status-action state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState(false);

  // Delete/cancel confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Driver selector state
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [addingDriver, setAddingDriver] = useState(false);
  const [resendingDriverConfirmation, setResendingDriverConfirmation] =
    useState(false);
  const [selectingCandidateId, setSelectingCandidateId] = useState<
    string | null
  >(null);
  const [candidatePriceInputs, setCandidatePriceInputs] = useState<
    Record<string, string>
  >({});
  const [driverHistoryName, setDriverHistoryName] = useState<string | null>(
    null,
  );
  const [driverHistory, setDriverHistory] = useState<DriverTripHistoryEntry[]>(
    [],
  );
  const [driverHistoryLoading, setDriverHistoryLoading] = useState(false);
  const [showClientPhonePopup, setShowClientPhonePopup] = useState(false);

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

  // Keyboard + scroll lock
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

  // Load data whenever trip changes
  const loadTripData = useCallback(
    async (tripId: string) => {
      setLoadingData(true);
      try {
        const [freshTrip, hist] = await Promise.all([
          fetchTripById(tripId),
          fetchTripStatusHistory(tripId),
        ]);
        setLiveTrip(freshTrip);
        setHistory(hist);

        // Tabela pode não existir ainda se a migration não foi aplicada
        try {
          const cands = await fetchTripDriverCandidates(tripId);
          setCandidates(cands);
        } catch {
          setCandidates([]);
        }

        if (freshTrip.status === "searching_drivers") {
          const drivers = await fetchDriverProfiles();
          setAllDrivers(drivers);
        }
      } catch {
        toast("danger", "Erro ao carregar detalhes da viagem");
      } finally {
        setLoadingData(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!open || !trip) return;
    setLiveTrip(trip);
    setHistory([]);
    setCandidates([]);
    setAllDrivers([]);
    setShowRejectForm(false);
    setRejectReason("");
    setShowDeleteConfirm(false);
    setSelectedDriverId("");
    setSelectingCandidateId(null);
    setCandidatePriceInputs({});
    setDriverHistoryName(null);
    setDriverHistory([]);
    setShowClientPhonePopup(false);
    loadTripData(trip.id);
  }, [open, trip, loadTripData]);

  useEffect(() => {
    setCandidatePriceInputs((prev) => {
      const next = { ...prev };
      for (const candidate of candidates) {
        if (next[candidate.id] === undefined) {
          next[candidate.id] =
            candidate.offered_price == null
              ? ""
              : String(candidate.offered_price);
        }
      }
      return next;
    });
  }, [candidates]);

  // Realtime subscription: atualiza candidatos quando motorista aceita/coloca preço
  useEffect(() => {
    if (!open || !trip) return;
    const channel = supabase
      .channel(`candidates-${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_driver_candidates",
          filter: `trip_id=eq.${trip.id}`,
        },
        () => {
          fetchTripDriverCandidates(trip.id)
            .then(setCandidates)
            .catch(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, trip]);

  // When status changes to searching_drivers, load drivers
  useEffect(() => {
    if (liveTrip?.status === "searching_drivers" && allDrivers.length === 0) {
      fetchDriverProfiles()
        .then(setAllDrivers)
        .catch(() => {});
    }
  }, [liveTrip?.status, allDrivers.length]);

  if (!open || !liveTrip) return null;

  const t = liveTrip;
  const route = `${shortenAddress(t.pickup_address?.formatted_address)} → ${shortenAddress(t.dropoff_address?.formatted_address)}`;
  const passengerName = t.users?.full_name ?? "—";
  const passengerPhone = t.users?.phone ?? "";
  const passengerPhoneDigits = passengerPhone.replace(/\D/g, "");
  const passengerWhatsappNumber =
    passengerPhoneDigits.length >= 10
      ? passengerPhoneDigits.startsWith("55")
        ? passengerPhoneDigits
        : `55${passengerPhoneDigits}`
      : "";
  const orderedStops = [...(t.trip_stops ?? [])].sort(
    (a, b) => a.stop_order - b.stop_order,
  );

  const statusColor = statusColors[t.status] ?? {
    bg: "#FEBF2220",
    text: "#FEBF22",
  };
  const forwardActions = getTripStatusActions(t.status).filter(
    (action) => action.direction === "forward",
  );
  const visibleForwardActions =
    t.status === "awaiting_driver_confirmation" ? [] : forwardActions;
  const rollbackActions = getTripStatusActions(t.status).filter(
    (action) => action.direction === "back",
  );

  // Drivers not yet added as candidates
  const candidateDriverIds = new Set(
    candidates.map((c) => c.driver_profile_id),
  );
  const availableDrivers = allDrivers
    .filter((d) => !candidateDriverIds.has(d.id))
    .map((d) => ({
      value: d.id,
      label: d.provider_profiles?.users?.full_name ?? d.id,
    }));

  async function handleApprove() {
    if (!t) return;
    setActioning(true);
    try {
      await approveTrip(t.id);
      toast("success", "Viagem aprovada — agora em Buscando Motorista");
      onUpdate();
      await loadTripData(t.id);
    } catch {
      toast("danger", "Erro ao aprovar viagem");
    } finally {
      setActioning(false);
    }
  }

  async function handleReject() {
    if (!t) return;
    setActioning(true);
    try {
      await rejectTrip(t.id, rejectReason);
      toast("success", "Viagem recusada — retornou para Aberta");
      setShowRejectForm(false);
      setRejectReason("");
      onUpdate();
      await loadTripData(t.id);
    } catch {
      toast("danger", "Erro ao recusar viagem");
    } finally {
      setActioning(false);
    }
  }

  async function handleCancel() {
    if (!t) return;
    setActioning(true);
    try {
      await cancelTrip(t.id);
      toast("success", "Viagem cancelada");
      onUpdate();
      handleClose();
    } catch {
      toast("danger", "Erro ao cancelar viagem");
    } finally {
      setActioning(false);
    }
  }

  async function handleDeleteTrip() {
    if (!t) return;
    setActioning(true);
    try {
      await deleteTrip(t.id);
      toast("success", "Viagem excluída");
      onUpdate();
      handleClose();
    } catch {
      toast("danger", "Erro ao excluir viagem");
    } finally {
      setActioning(false);
    }
  }

  async function handleMoveStatus(status: Trip["status"]) {
    if (!t) return;
    if (
      t.status === "searching_drivers" &&
      status === "awaiting_client_confirmation"
    ) {
      const blockReason = getClientConfirmationBlockReason(candidates);
      if (blockReason) {
        toast("warning", blockReason);
        return;
      }
    }

    setActioning(true);
    try {
      await updateTripStatus(t.id, status);
      toast("success", "Status da viagem atualizado");
      onUpdate();
      await loadTripData(t.id);
    } catch {
      toast("danger", "Erro ao atualizar status");
    } finally {
      setActioning(false);
    }
  }

  async function handleAddCandidate(driverProfileId: string) {
    if (!t || !driverProfileId) return;
    setAddingDriver(true);
    try {
      const newCandidate = await addTripDriverCandidate(t.id, driverProfileId);
      setCandidates((prev) => [newCandidate, ...prev]);
      setSelectedDriverId("");
      toast("success", "Motorista adicionado como candidato");
    } catch {
      toast("danger", "Erro ao adicionar candidato");
    } finally {
      setAddingDriver(false);
    }
  }

  async function handleRemoveCandidate(driverProfileId: string) {
    if (!t) return;
    try {
      await removeTripDriverCandidate(t.id, driverProfileId);
      setCandidates((prev) =>
        prev.filter((c) => c.driver_profile_id !== driverProfileId),
      );
      toast("success", "Candidato removido");
    } catch {
      toast("danger", "Erro ao remover candidato");
    }
  }

  async function handleUpdateCandidateStatus(
    driverProfileId: string,
    status: TripDriverCandidateStatus,
  ) {
    if (!t) return;
    try {
      const updated = await updateTripDriverCandidateStatus(
        t.id,
        driverProfileId,
        status,
      );
      setCandidates((prev) =>
        prev.map((c) =>
          c.driver_profile_id === driverProfileId ? updated : c,
        ),
      );
      toast(
        "success",
        `Candidato marcado como ${candidateStatusLabels[status]}`,
      );
    } catch {
      toast("danger", "Erro ao atualizar status do candidato");
    }
  }

  async function handleUpdateCandidatePrice(candidate: TripDriverCandidate) {
    if (!t) return;
    const rawValue = candidatePriceInputs[candidate.id]?.trim() ?? "";
    const parsed = rawValue
      ? Number(rawValue.replace(/\./g, "").replace(",", "."))
      : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast("warning", "Informe um preço válido");
      return;
    }

    try {
      const updated = await updateTripDriverCandidatePrice(
        t.id,
        candidate.driver_profile_id,
        parsed,
      );
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? updated : c)),
      );
      setCandidatePriceInputs((prev) => ({
        ...prev,
        [candidate.id]: parsed == null ? "" : String(parsed),
      }));
      toast("success", "Preço do motorista atualizado");
    } catch {
      toast("danger", "Erro ao atualizar preço do motorista");
    }
  }

  async function handleRejectCandidatePrice(candidate: TripDriverCandidate) {
    if (!t) return;
    try {
      const updated = await rejectTripDriverCandidatePrice(
        t.id,
        candidate.driver_profile_id,
      );
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? updated : c)),
      );
      setCandidatePriceInputs((prev) => ({ ...prev, [candidate.id]: "" }));
      toast("success", "Preço recusado e solicitação devolvida ao motorista");
    } catch {
      toast("danger", "Erro ao recusar preço do motorista");
    }
  }

  async function handleSendKzProposal(candidate: TripDriverCandidate) {
    if (!t) return;
    const rawValue = candidatePriceInputs[candidate.id]?.trim() ?? "";
    const parsed = Number(rawValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast("warning", "Informe uma proposta KZ válida");
      return;
    }

    try {
      const updated = await sendKzDriverProposal(
        t.id,
        candidate.driver_profile_id,
        parsed,
      );
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? updated : c)),
      );
      setCandidatePriceInputs((prev) => ({
        ...prev,
        [candidate.id]: String(parsed),
      }));
      toast("success", "Proposta KZ reenviada ao motorista");
    } catch {
      toast("danger", "Erro ao enviar proposta KZ");
    }
  }

  async function handleToggleIsPaid() {
    if (!t) return;
    const next = !t.is_paid;
    setLiveTrip((prev) => (prev ? { ...prev, is_paid: next } : prev));
    try {
      await updateTripFinancial(t.id, {
        is_paid: next,
        payment_date: next ? new Date().toISOString() : null,
      });
      onUpdate();
    } catch {
      setLiveTrip((prev) => (prev ? { ...prev, is_paid: !next } : prev));
      toast("danger", "Erro ao atualizar pagamento da corrida");
    }
  }

  async function handleToggleIsDriverPaied() {
    if (!t) return;
    const next = !t.is_driver_paied;
    setLiveTrip((prev) => (prev ? { ...prev, is_driver_paied: next } : prev));
    try {
      await updateTripFinancial(t.id, { is_driver_paied: next });
      onUpdate();
    } catch {
      setLiveTrip((prev) =>
        prev ? { ...prev, is_driver_paied: !next } : prev,
      );
      toast("danger", "Erro ao atualizar pagamento do motorista");
    }
  }

  const paymentMethodLabel = (m: string) =>
    ({
      pix: "PIX",
      debit: "Débito",
      credit: "Crédito",
      cash: "Dinheiro",
      billing: "Faturamento",
    })[m] ?? m;

  const handleSelectDriver = async (candidate: TripDriverCandidate) => {
    if (candidate.offered_price == null) return;
    const driverName =
      candidate.driver_profiles?.provider_profiles?.users?.full_name ??
      "Motorista";
    const confirmed = window.confirm(
      `Aprovar a proposta de ${driverName} em nome do cliente por R$ ${candidate.offered_price.toFixed(2)}?`,
    );
    if (!confirmed) return;

    setSelectingCandidateId(candidate.id);
    try {
      await selectTripDriver(
        t.id,
        candidate.id,
        candidate.driver_profile_id,
        candidate.offered_price,
      );
      const [updatedCandidates, updatedTrip] = await Promise.all([
        fetchTripDriverCandidates(t.id),
        fetchTripById(t.id),
      ]);
      setCandidates(updatedCandidates);
      setLiveTrip(updatedTrip);
      onUpdate();
      toast(
        "success",
        `Aguardando validação do motorista — R$ ${candidate.offered_price.toFixed(2)}`,
      );
    } catch {
      toast("danger", "Erro ao selecionar motorista");
    } finally {
      setSelectingCandidateId(null);
    }
  };

  const handleApproveCandidate = async (
    driverProfileId: string,
    approved: boolean,
  ) => {
    try {
      const updated = await approveDriverCandidate(
        t.id,
        driverProfileId,
        approved,
      );
      setCandidates((prev) =>
        prev.map((c) =>
          c.driver_profile_id === driverProfileId ? updated : c,
        ),
      );
      toast(
        "success",
        approved ? "Candidato aprovado para o cliente" : "Aprovação removida",
      );
    } catch {
      toast("danger", "Erro ao atualizar aprovação");
    }
  };

  const handleOpenDriverHistory = async (
    driverProfileId: string,
    driverName: string,
  ) => {
    setDriverHistoryName(driverName);
    setDriverHistory([]);
    setDriverHistoryLoading(true);
    try {
      const rows = await fetchDriverTripHistory(driverProfileId);
      setDriverHistory(rows);
    } catch {
      toast("danger", "Erro ao carregar histórico do motorista");
    } finally {
      setDriverHistoryLoading(false);
    }
  };

  const handleResendDriverConfirmation = async () => {
    if (!t) return;
    setResendingDriverConfirmation(true);
    try {
      await resendDriverConfirmationNotification(t.id);
      toast("success", "Pedido de validação reenviado ao motorista");
      await loadTripData(t.id);
      onUpdate();
    } catch (e) {
      toast(
        "danger",
        e instanceof Error
          ? e.message
          : "Erro ao reenviar validação ao motorista",
      );
    } finally {
      setResendingDriverConfirmation(false);
    }
  };

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
        aria-label={route}
        className="relative bg-surface border-0 md:border border-border rounded-none md:rounded-xl flex flex-col w-full h-full md:w-[70vw] md:min-w-[600px] md:h-auto md:max-h-[90vh] overflow-hidden"
        style={{ animation: "modal-in 300ms ease-out forwards" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 md:px-6 pt-4 md:pt-5 pb-4 border-b border-border shrink-0">
          {/* Botão voltar — mobile apenas */}
          <button
            onClick={handleClose}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer shrink-0"
            aria-label="Voltar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-heading font-black text-dark leading-tight truncate">
              {route}
            </h2>
            <p className="text-sm text-contrast font-body mt-0.5">
              {passengerName}
            </p>
          </div>

          {/* Botão fechar — desktop apenas */}
          <button
            onClick={handleClose}
            className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — 2 columns */}
        {loadingData ? (
          <div className="flex-1 flex items-center justify-center text-contrast text-sm py-12">
            Carregando...
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
            {/* ── LEFT COLUMN (65%) ── */}
            <div className="px-4 md:px-6 py-5 md:border-r border-border md:overflow-y-auto md:w-[65%]">
              {/* Main Info */}
              <SectionTitle>Informações da Viagem</SectionTitle>

              <InfoRow
                label="Status"
                value={
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: statusColor.bg,
                      color: statusColor.text,
                    }}
                  >
                    {statusLabels[t.status] ?? t.status}
                  </span>
                }
              />
              <InfoRow
                label="Cliente"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span>{t.users?.full_name ?? "—"}</span>
                    {passengerPhone && (
                      <button
                        type="button"
                        onClick={() => setShowClientPhonePopup(true)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-contrast hover:bg-surface-hover hover:text-dark transition-colors"
                        aria-label="Abrir contato do cliente"
                        title="Telefone do cliente"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.92.32 1.82.6 2.69a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 7 7l.48-.86a2 2 0 0 1 2.11-.45c.87.28 1.77.48 2.69.6A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </button>
                    )}
                  </span>
                }
              />
              <InfoRow
                label="Categoria"
                value={t.service_categories?.name ?? "—"}
              />
              <InfoRow
                label="Embarque"
                value={t.pickup_address?.formatted_address ?? "—"}
              />
              {orderedStops.map((stop, index) => (
                <InfoRow
                  key={stop.id}
                  label={`Parada ${index + 1}`}
                  value={stop.addresses?.formatted_address ?? "—"}
                />
              ))}
              <InfoRow
                label="Desembarque"
                value={t.dropoff_address?.formatted_address ?? "—"}
              />
              <InfoRow
                label="Data e hora"
                value={formatDate(t.scheduled_datetime)}
              />
              {t.is_round_trip && (
                <InfoRow
                  label="Retorno"
                  value={
                    t.return_datetime ? formatDate(t.return_datetime) : "—"
                  }
                />
              )}
              <InfoRow label="Passageiros" value={String(t.passenger_count)} />
              <InfoRow label="Crianças" value={String(t.children_count)} />
              <InfoRow label="Malas" value={String(t.luggage_count)} />

              {t.observations && (
                <div className="mt-3 p-3 rounded-lg bg-background border border-border">
                  <p className="text-xs text-contrast mb-1 font-medium">
                    Observações
                  </p>
                  <p className="text-xs text-dark">{t.observations}</p>
                </div>
              )}

              {t.status === "awaiting_driver_confirmation" && (
                <>
                  <SectionTitle>Validação do Motorista</SectionTitle>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <p className="text-xs text-dark font-body leading-relaxed">
                      O cliente aceitou o motorista. A viagem só será agendada
                      depois que o motorista confirmar novamente.
                    </p>
                    <button
                      onClick={handleResendDriverConfirmation}
                      disabled={resendingDriverConfirmation}
                      className="mt-3 w-full py-2 rounded-lg bg-primary text-background text-sm font-heading font-bold hover:bg-primary-dark transition-colors duration-150 cursor-pointer disabled:opacity-50"
                    >
                      {resendingDriverConfirmation
                        ? "Reenviando..."
                        : "Reenviar pedido ao motorista"}
                    </button>
                    <button
                      onClick={() => handleMoveStatus("scheduled")}
                      disabled={actioning}
                      className="mt-2 w-full py-2 rounded-lg bg-accent text-background text-sm font-heading font-bold hover:bg-accent-dark transition-colors duration-150 cursor-pointer disabled:opacity-50"
                    >
                      {actioning ? "Aprovando..." : "Motorista: aprovar"}
                    </button>
                  </div>
                </>
              )}

              {/* Status-based actions */}
              {t.status === "under_review" && (
                <>
                  <SectionTitle>Ações</SectionTitle>
                  {!showRejectForm ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-3">
                        <button
                          onClick={handleApprove}
                          disabled={actioning}
                          className="flex-1 py-2 rounded-lg bg-accent text-background text-sm font-heading font-bold hover:bg-accent-dark transition-colors duration-150 cursor-pointer disabled:opacity-50"
                        >
                          Avançar etapa
                        </button>
                        <button
                          onClick={() => setShowRejectForm(true)}
                          disabled={actioning}
                          className="flex-1 py-2 rounded-lg border border-danger text-danger text-sm font-heading font-bold hover:bg-danger/10 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                        >
                          Recusar Viagem
                        </button>
                      </div>
                      {rollbackActions.map((action) => (
                        <button
                          key={action.to}
                          onClick={() => handleMoveStatus(action.to)}
                          disabled={actioning}
                          className="w-full py-2 rounded-lg border border-border text-contrast text-sm font-heading font-bold hover:text-dark hover:bg-surface-hover transition-colors duration-150 cursor-pointer disabled:opacity-50"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Motivo da recusa (opcional)..."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background text-dark text-sm font-body px-3 py-2 resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-contrast/40"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleReject}
                          disabled={actioning}
                          className="flex-1 py-2 rounded-lg bg-danger text-white text-sm font-heading font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                        >
                          Confirmar Recusa
                        </button>
                        <button
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectReason("");
                          }}
                          className="px-4 py-2 rounded-lg border border-border text-contrast text-sm font-body hover:text-dark hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {t.status !== "under_review" &&
                (visibleForwardActions.length > 0 ||
                  rollbackActions.length > 0) && (
                  <>
                    <SectionTitle>Ações</SectionTitle>
                    <div className="flex flex-col gap-2">
                      {visibleForwardActions.map((action) => (
                        <button
                          key={action.to}
                          onClick={() => handleMoveStatus(action.to)}
                          disabled={actioning}
                          className="w-full py-2 rounded-lg bg-accent text-background text-sm font-heading font-bold hover:bg-accent-dark transition-colors duration-150 cursor-pointer disabled:opacity-50"
                        >
                          Avançar etapa
                        </button>
                      ))}
                      {rollbackActions.map((action) => (
                        <button
                          key={action.to}
                          onClick={() => handleMoveStatus(action.to)}
                          disabled={actioning}
                          className="w-full py-2 rounded-lg border border-border text-contrast text-sm font-heading font-bold hover:text-dark hover:bg-surface-hover transition-colors duration-150 cursor-pointer disabled:opacity-50"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
            </div>

            {/* ── RIGHT COLUMN (35%) ── */}
            <div className="border-t md:border-t-0 border-border px-4 md:px-5 py-5 flex flex-col gap-0 md:overflow-y-auto md:w-[35%]">
              {/* Driver Candidates */}
              <SectionTitle>Motoristas Candidatos</SectionTitle>

              {/* Search input — visible only in searching_drivers */}
              {t.status === "searching_drivers" && (
                <div className="mb-2">
                  <SearchableSelect
                    options={availableDrivers}
                    value={selectedDriverId}
                    onChange={(val) => {
                      setSelectedDriverId(val);
                      handleAddCandidate(val);
                    }}
                    placeholder="Buscar e adicionar motorista..."
                    disabled={addingDriver}
                  />
                </div>
              )}

              {t.status === "under_review" ? (
                <p className="text-xs text-contrast italic">
                  Indisponível durante análise.
                </p>
              ) : candidates.length === 0 ? (
                <p className="text-xs text-contrast italic">
                  Nenhum candidato indicado.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {candidates.map((c) => {
                    const driverName =
                      c.driver_profiles?.provider_profiles?.users?.full_name ??
                      "Motorista";
                    const candStatus = (c.status ??
                      "pending") as TripDriverCandidateStatus;
                    const candColor = candidateStatusColors[candStatus];
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg bg-background border border-border"
                      >
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDriverHistory(
                                c.driver_profile_id,
                                driverName,
                              )
                            }
                            className="block max-w-full text-left text-sm font-semibold text-dark font-body truncate hover:text-primary transition-colors cursor-pointer"
                            title="Ver histórico do motorista"
                          >
                            {driverName}
                          </button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: candColor.bg,
                                color: candColor.text,
                              }}
                            >
                              {candidateStatusLabels[candStatus]}
                            </span>
                            {c.offered_price != null ? (
                              <span className="text-sm font-bold text-green-500">
                                R$ {c.offered_price.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-contrast/50 italic">
                                Aguardando valor
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={candidatePriceInputs[c.id] ?? ""}
                              onChange={(e) =>
                                setCandidatePriceInputs((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value,
                                }))
                              }
                              placeholder="Valor"
                              className="min-w-0 flex-1 rounded-lg border border-border bg-surface text-dark text-xs font-body px-2 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-contrast/40"
                              aria-label={`Preço ofertado por ${driverName}`}
                            />
                            <button
                              onClick={() => handleUpdateCandidatePrice(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-primary text-background text-xs font-heading font-bold hover:bg-primary-dark transition-colors cursor-pointer"
                            >
                              Salvar
                            </button>
                          </div>
                          {c.price_rejection_reason ? (
                            <p className="mt-1 text-xs font-body text-danger">
                              {c.price_rejection_reason}
                            </p>
                          ) : null}
                          {c.kz_proposal_locked &&
                          c.kz_proposed_price != null ? (
                            <p className="mt-1 text-xs font-body font-semibold text-green-600">
                              proposta feita pela KZ
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {c.offered_price != null && (
                              <button
                                type="button"
                                onClick={() => handleRejectCandidatePrice(c)}
                                className="px-3 py-1.5 rounded text-xs font-heading font-bold bg-danger/10 text-danger hover:bg-danger/20 transition-colors cursor-pointer"
                              >
                                Recusar preço
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSendKzProposal(c)}
                              className="px-3 py-1.5 rounded text-xs font-heading font-bold bg-green-500/10 text-green-700 hover:bg-green-500/20 transition-colors cursor-pointer"
                            >
                              Enviar proposta KZ
                            </button>
                          </div>
                          {t.status === "searching_drivers" &&
                            candStatus === "accepted" && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApproveCandidate(
                                      c.driver_profile_id,
                                      !c.admin_approved,
                                    )
                                  }
                                  disabled={selectingCandidateId !== null}
                                  className={`px-3 py-1.5 rounded text-xs font-heading font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    c.admin_approved
                                      ? "bg-green-500/20 text-green-600 hover:bg-red-500/20 hover:text-red-600"
                                      : "bg-surface-hover text-contrast hover:bg-accent/20 hover:text-accent"
                                  }`}
                                >
                                  {c.admin_approved
                                    ? "Aprovado ✓"
                                    : "Aprovar para cliente"}
                                </button>
                                {canAdminApproveForClient(t.status, c) && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDriver(c)}
                                    disabled={selectingCandidateId !== null}
                                    className="px-3 py-1.5 rounded bg-primary text-background text-xs font-heading font-bold hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {selectingCandidateId === c.id
                                      ? "Aprovando..."
                                      : "Cliente: aprovar"}
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Only show manual accept/reject for non-searching_drivers statuses */}
                          {t.status !== "searching_drivers" && (
                            <>
                              {candStatus !== "accepted" && (
                                <button
                                  onClick={() =>
                                    handleUpdateCandidateStatus(
                                      c.driver_profile_id,
                                      "accepted",
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                                  aria-label="Marcar como aceito"
                                  title="Marcar como aceito"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </button>
                              )}
                              {candStatus !== "rejected" && (
                                <button
                                  onClick={() =>
                                    handleUpdateCandidateStatus(
                                      c.driver_profile_id,
                                      "rejected",
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                  aria-label="Marcar como rejeitado"
                                  title="Marcar como rejeitado"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              )}
                              {candStatus !== "pending" && (
                                <button
                                  onClick={() =>
                                    handleUpdateCandidateStatus(
                                      c.driver_profile_id,
                                      "pending",
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                  aria-label="Voltar para pendente"
                                  title="Voltar para pendente"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M3 12a9 9 0 1 0 9-9" />
                                    <polyline points="3 4 3 10 9 10" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() =>
                              handleRemoveCandidate(c.driver_profile_id)
                            }
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-danger hover:bg-danger/10 border-l border-border ml-1 pl-2 transition-colors cursor-pointer"
                            aria-label="Remover candidato"
                            title="Remover candidato"
                          >
                            <svg
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Confirmed Driver */}
              {t.driver_profiles?.provider_profiles?.users && (
                <>
                  <SectionTitle>Motorista Confirmado</SectionTitle>
                  <div className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/30">
                    <button
                      type="button"
                      onClick={() =>
                        t.driver_profile_id &&
                        handleOpenDriverHistory(
                          t.driver_profile_id,
                          t.driver_profiles?.provider_profiles?.users
                            ?.full_name ?? "Motorista",
                        )
                      }
                      className="text-left text-xs text-dark font-body hover:text-primary transition-colors cursor-pointer"
                      title="Ver histórico do motorista"
                    >
                      {t.driver_profiles.provider_profiles.users.full_name}
                    </button>
                  </div>
                </>
              )}

              {/* Status History */}
              <SectionTitle>Histórico de Status</SectionTitle>
              {history.length === 0 ? (
                <p className="text-xs text-contrast italic">
                  Sem histórico registrado.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {history.map((h) => (
                    <div key={h.id} className="relative pl-4 pb-3 last:pb-0">
                      <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-border" />
                      <span className="absolute left-[2px] top-3 bottom-0 w-px bg-border last:hidden" />
                      <p className="text-xs text-dark font-body leading-tight">
                        {h.from_status ? (
                          <>
                            <span className="text-contrast">
                              {statusLabels[h.from_status] ?? h.from_status}
                            </span>
                            {" → "}
                          </>
                        ) : null}
                        <span>{statusLabels[h.to_status] ?? h.to_status}</span>
                      </p>
                      {h.observations && (
                        <p className="text-xs text-contrast mt-0.5 italic">
                          {h.observations}
                        </p>
                      )}
                      <p className="text-[10px] text-contrast/60 mt-0.5">
                        {formatDate(h.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Financial Area */}
              <SectionTitle>Área Financeira</SectionTitle>

              {/* Status toggles */}
              <div className="flex flex-col gap-2 mb-3">
                <button
                  onClick={handleToggleIsPaid}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    t.is_paid
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
                  }`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t.is_paid ? "Corrida paga" : "Marcar corrida como paga"}
                </button>

                <button
                  onClick={handleToggleIsDriverPaied}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    t.is_driver_paied
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : "bg-background border-border text-contrast hover:border-primary hover:text-primary"
                  }`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t.is_driver_paied
                    ? "Motorista pago"
                    : "Marcar motorista como pago"}
                </button>
              </div>

              {/* Financial values — read-only */}
              <div className="flex flex-col gap-1.5">
                {t.estimated_price != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-contrast"
                    >
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <span className="text-xs text-contrast">
                      Preço estimado:
                    </span>
                    <span className="text-xs text-dark font-medium ml-auto">
                      {formatCurrency(t.estimated_price)}
                    </span>
                  </div>
                )}
                {t.final_price != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-contrast"
                    >
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <span className="text-xs text-contrast">Valor final:</span>
                    <span className="text-xs text-dark font-medium ml-auto">
                      {formatCurrency(t.final_price)}
                    </span>
                  </div>
                )}
                {t.payment_method != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-contrast"
                    >
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    <span className="text-xs text-contrast">Pagamento:</span>
                    <span className="text-xs text-dark font-medium ml-auto">
                      {paymentMethodLabel(t.payment_method)}
                    </span>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="mt-6 pt-4 border-t border-danger/30">
                <p className="text-xs font-heading font-bold text-danger uppercase tracking-wider mb-3">
                  Zona de Risco
                </p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2 rounded-lg border border-danger/50 text-danger text-sm font-heading font-bold hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                  >
                    {t.status === "cancelled"
                      ? "Excluir Definitivamente"
                      : "Cancelar Viagem"}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-contrast">
                      {t.status === "cancelled"
                        ? "Deseja excluir essa viagem? Essa ação não poderá ser desfeita."
                        : "Deseja cancelar essa viagem?"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={actioning}
                        className="flex-1 py-2 rounded-lg border border-border text-contrast text-xs font-body hover:text-dark hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Não
                      </button>
                      <button
                        onClick={
                          t.status === "cancelled"
                            ? handleDeleteTrip
                            : handleCancel
                        }
                        disabled={actioning}
                        className="flex-1 py-2 rounded-lg bg-danger text-white text-sm font-heading font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                      >
                        Sim
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {driverHistoryName && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl max-h-[82vh] overflow-hidden rounded-xl bg-surface border border-border shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-heading font-bold text-dark">
                  Histórico de viagens
                </p>
                <p className="text-xs text-contrast font-body">
                  {driverHistoryName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDriverHistoryName(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-colors cursor-pointer"
                aria-label="Fechar histórico"
              >
                x
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[68vh]">
              {driverHistoryLoading ? (
                <p className="text-sm text-contrast font-body">
                  Carregando histórico...
                </p>
              ) : driverHistory.length === 0 ? (
                <p className="text-sm text-contrast font-body">
                  Nenhuma viagem finalizada encontrada para este motorista.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {driverHistory.map(({ trip: historyTrip, ratings }) => {
                    const price =
                      historyTrip.final_price ?? historyTrip.estimated_price;
                    return (
                      <div
                        key={historyTrip.id}
                        className="rounded-xl border border-border bg-background p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-heading font-bold text-dark">
                              {historyTrip.users?.full_name ?? "Cliente"}
                            </p>
                            <p className="text-xs text-contrast font-body">
                              {formatDate(
                                historyTrip.finished_at ??
                                  historyTrip.scheduled_datetime,
                              )}
                            </p>
                          </div>
                          <span className="text-sm font-heading font-bold text-green-500">
                            {formatCurrency(price)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-body">
                          <p className="text-contrast">
                            Origem:{" "}
                            <span className="text-dark">
                              {historyTrip.pickup_address?.formatted_address ??
                                "—"}
                            </span>
                          </p>
                          <p className="text-contrast">
                            Destino:{" "}
                            <span className="text-dark">
                              {historyTrip.dropoff_address?.formatted_address ??
                                "—"}
                            </span>
                          </p>
                          <p className="text-contrast">
                            Pagamento:{" "}
                            <span className="text-dark">
                              {historyTrip.payment_method
                                ? (paymentLabels[historyTrip.payment_method] ??
                                  historyTrip.payment_method)
                                : "—"}
                            </span>
                          </p>
                          <p className="text-contrast">
                            Passageiros:{" "}
                            <span className="text-dark">
                              {historyTrip.passenger_count}
                            </span>
                          </p>
                        </div>
                        <div className="mt-3 border-t border-border pt-3">
                          {ratings.length === 0 ? (
                            <p className="text-xs text-contrast italic">
                              Sem avaliações registradas.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {ratings.map((rating) => (
                                <div
                                  key={rating.id}
                                  className="rounded-lg bg-surface px-3 py-2"
                                >
                                  <p className="text-xs font-heading font-bold text-dark">
                                    Nota {Number(rating.rating).toFixed(1)}
                                    <span className="ml-2 font-body font-normal text-contrast">
                                      {rating.rater?.full_name ?? "Usuário"}{" "}
                                      avaliou{" "}
                                      {rating.rated?.full_name ?? "usuário"}
                                    </span>
                                  </p>
                                  {rating.comment && (
                                    <p className="mt-1 text-xs text-contrast font-body">
                                      {rating.comment}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showClientPhonePopup && passengerPhone && (
        <div className="fixed inset-0 z-[330] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-heading font-bold text-dark">
                  Telefone do cliente
                </p>
                <p className="mt-1 text-sm text-contrast">{passengerPhone}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowClientPhonePopup(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-contrast hover:bg-background hover:text-dark transition-colors"
                aria-label="Fechar popup"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  window.open(`tel:${passengerPhone}`, "_self");
                  setShowClientPhonePopup(false);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-heading font-bold text-background hover:bg-primary-dark transition-colors"
              >
                Ligar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(passengerPhone);
                  toast("success", "Número copiado");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-heading font-bold text-dark hover:bg-background transition-colors"
              >
                Copiar número
              </button>
              <button
                type="button"
                onClick={() => {
                  const whatsappUrl = passengerWhatsappNumber
                    ? `https://wa.me/${passengerWhatsappNumber}`
                    : `https://wa.me/?text=${encodeURIComponent(passengerPhone)}`;
                  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                }}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-heading font-bold text-white hover:opacity-90 transition-opacity"
              >
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
