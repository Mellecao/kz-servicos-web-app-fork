"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  PaymentMethod,
  ProviderProfile,
  ServiceRequest,
  ServiceRequestProviderCandidate,
} from "@/types/database";
import {
  addServiceRequestProviderCandidate,
  approveServiceRequestForClient,
  approveServiceRequestForProvider,
  approveServiceRequestProviderCandidate,
  fetchProviderProfiles,
  removeServiceRequestProviderCandidate,
  rejectServiceRequestProviderCandidatePrice,
  sendKzServiceRequestProposal,
  updateServiceRequestFinancial,
  updateServiceRequestProviderCandidatePrice,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import { canAdminApproveServiceForClient } from "@/lib/service-candidate-actions";

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
  awaiting_client_confirmation: "Aguardando Cliente",
  awaiting_provider_confirmation: "Aguardando Prestador",
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
  awaiting_client_confirmation: { bg: "#f9731620", text: "#f97316" },
  awaiting_provider_confirmation: { bg: "#f9731620", text: "#f97316" },
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
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [candidates, setCandidates] = useState<ServiceRequestProviderCandidate[]>([]);
  const [providerSelectionId, setProviderSelectionId] = useState("");
  const [candidatePriceInputs, setCandidatePriceInputs] = useState<Record<string, string>>({});
  const [candidateActioningId, setCandidateActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !request) return;
    setIsPaid(request.is_paid);
    setIsProviderPaied(request.is_provider_paied ?? false);
    setFinalPriceInput(request.final_price?.toString() ?? "");
    setPaymentMethodInput(request.payment_method ?? "");
    setCandidates(request.service_request_provider_candidates ?? []);
    setCandidatePriceInputs((current) => {
      const next = { ...current };
      for (const candidate of request.service_request_provider_candidates ?? []) {
        if (next[candidate.id] === undefined) {
          next[candidate.id] =
            candidate.offered_price == null ? "" : String(candidate.offered_price);
        }
      }
      return next;
    });
  }, [open, request]);

  useEffect(() => {
    if (!open || !request) return;
    fetchProviderProfiles()
      .then((items) =>
        setProviders(
          items.filter(
            (provider) =>
              provider.service_category_id === request.service_category_id,
          ).filter((provider) => provider.status === "approved"),
        ),
      )
      .catch(() => toast("danger", "Erro ao carregar prestadores"));
  }, [open, request, toast]);

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
  const candidateProviderIds = new Set(
    candidates.map((candidate) => candidate.provider_profile_id),
  );
  const availableProviders = providers.filter(
    (provider) => !candidateProviderIds.has(provider.id),
  );

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

  async function handleAddCandidate() {
    if (!providerSelectionId) return;
    setCandidateActioningId(providerSelectionId);
    try {
      const created = await addServiceRequestProviderCandidate(
        r.id,
        providerSelectionId,
      );
      setCandidates((current) => [created, ...current]);
      setProviderSelectionId("");
      onUpdate?.();
      toast("success", "Prestador adicionado como candidato");
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao adicionar prestador");
    } finally {
      setCandidateActioningId(null);
    }
  }

  async function handleRemoveCandidate(candidate: ServiceRequestProviderCandidate) {
    setCandidateActioningId(candidate.id);
    try {
      await removeServiceRequestProviderCandidate(
        r.id,
        candidate.provider_profile_id,
      );
      setCandidates((current) =>
        current.filter((item) => item.id !== candidate.id),
      );
      onUpdate?.();
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao remover candidato");
    } finally {
      setCandidateActioningId(null);
    }
  }

  async function handleUpdateCandidatePrice(
    candidate: ServiceRequestProviderCandidate,
  ) {
    const raw = candidatePriceInputs[candidate.id]?.trim() ?? "";
    const parsed = raw === "" ? null : Number(raw.replace(",", "."));
    if (parsed != null && Number.isNaN(parsed)) {
      toast("warning", "Informe um preço válido");
      return;
    }
    setCandidateActioningId(candidate.id);
    try {
      const updated = await updateServiceRequestProviderCandidatePrice(
        r.id,
        candidate.provider_profile_id,
        parsed,
      );
      setCandidates((current) =>
        current.map((item) => (item.id === candidate.id ? updated : item)),
      );
      setCandidatePriceInputs((current) => ({
        ...current,
        [candidate.id]: parsed == null ? "" : String(parsed),
      }));
      onUpdate?.();
      toast("success", "Preço atualizado");
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao atualizar preço");
    } finally {
      setCandidateActioningId(null);
    }
  }

  async function handleRejectCandidatePrice(
    candidate: ServiceRequestProviderCandidate,
  ) {
    setCandidateActioningId(candidate.id);
    try {
      const updated = await rejectServiceRequestProviderCandidatePrice(
        r.id,
        candidate.provider_profile_id,
      );
      setCandidates((current) =>
        current.map((item) => (item.id === candidate.id ? updated : item)),
      );
      setCandidatePriceInputs((current) => ({ ...current, [candidate.id]: "" }));
      onUpdate?.();
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao recusar preço");
    } finally {
      setCandidateActioningId(null);
    }
  }

  async function handleSendKzProposal(
    candidate: ServiceRequestProviderCandidate,
  ) {
    const raw = candidatePriceInputs[candidate.id]?.trim() ?? "";
    const parsed = raw === "" ? NaN : Number(raw.replace(",", "."));
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast("warning", "Informe uma proposta KZ válida");
      return;
    }
    setCandidateActioningId(candidate.id);
    try {
      const updated = await sendKzServiceRequestProposal(
        r.id,
        candidate.provider_profile_id,
        parsed,
      );
      setCandidates((current) =>
        current.map((item) => (item.id === candidate.id ? updated : item)),
      );
      setCandidatePriceInputs((current) => ({
        ...current,
        [candidate.id]: String(parsed),
      }));
      onUpdate?.();
      toast("success", "Proposta enviada");
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao enviar proposta");
    } finally {
      setCandidateActioningId(null);
    }
  }

  async function handleApproveCandidateForClient(
    candidate: ServiceRequestProviderCandidate,
  ) {
    if (
      !canAdminApproveServiceForClient(r.status, {
        status: candidate.status,
        admin_approved: candidate.admin_approved,
        offered_price: candidate.offered_price,
      })
    ) {
      toast("warning", "A proposta ainda não está pronta para o cliente");
      return;
    }
    setCandidateActioningId(candidate.id);
    try {
      await approveServiceRequestProviderCandidate(
        r.id,
        candidate.provider_profile_id,
        candidate.offered_price!,
      );
      onUpdate?.();
      toast("success", "Cliente: aprovar");
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao aprovar para o cliente");
    } finally {
      setCandidateActioningId(null);
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

            {r.service_request_photos && r.service_request_photos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-contrast font-medium mb-2">Fotos da solicitação</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {r.service_request_photos
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-border bg-background"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.photo_url}
                          alt="Foto da solicitação"
                          className="h-28 w-full object-cover"
                        />
                      </a>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-heading font-bold text-dark">
                    Propostas e prestadores
                  </p>
                  <p className="mt-1 text-xs text-contrast">
                    Adicione prestadores, registre o preço e avance o fluxo em etapas.
                  </p>
                </div>
                <span className="text-xs text-contrast">
                  {candidates.length} candidato{candidates.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={providerSelectionId}
                  onChange={(e) => setProviderSelectionId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Adicionar prestador à solicitação</option>
                  {availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.users?.full_name ?? provider.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCandidate}
                  disabled={!providerSelectionId || candidateActioningId !== null}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-heading font-bold text-background hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {candidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-contrast">
                    Nenhum prestador adicionado.
                  </div>
                ) : (
                  candidates.map((candidate) => {
                    const providerName =
                      candidate.provider_profiles?.users?.full_name ?? "Prestador";
                    const candidateStatusLabel =
                      candidate.status === "accepted"
                        ? "Aceito"
                        : candidate.status === "rejected"
                          ? "Recusado"
                          : "Pendente";
                    const canApproveForClient = canAdminApproveServiceForClient(
                      r.status,
                      {
                        status: candidate.status,
                        admin_approved: candidate.admin_approved,
                        offered_price: candidate.offered_price,
                      },
                    );

                    return (
                      <div
                        key={candidate.id}
                        className="rounded-xl border border-border bg-surface p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-heading font-bold text-dark">
                              {providerName}
                            </p>
                            <p className="mt-1 text-xs text-contrast">
                              {candidate.provider_profiles?.users?.phone ?? "Sem telefone"}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2 py-1 text-[11px] font-medium"
                            style={{
                              backgroundColor: `${candidate.admin_approved ? "#22c55e" : "#f97316"}20`,
                              color: candidate.admin_approved ? "#22c55e" : "#f97316",
                            }}
                          >
                            {candidateStatusLabel}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={candidatePriceInputs[candidate.id] ?? ""}
                            onChange={(e) =>
                              setCandidatePriceInputs((current) => ({
                                ...current,
                                [candidate.id]: e.target.value,
                              }))
                            }
                            placeholder="Preço do prestador"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateCandidatePrice(candidate)}
                              disabled={candidateActioningId === candidate.id}
                              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-dark hover:bg-background disabled:opacity-50"
                            >
                              Preço prestador
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendKzProposal(candidate)}
                              disabled={candidateActioningId === candidate.id}
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-background hover:bg-primary-dark disabled:opacity-50"
                            >
                              Enviar proposta KZ
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {canApproveForClient && (
                            <button
                              type="button"
                              onClick={() => handleApproveCandidateForClient(candidate)}
                              disabled={candidateActioningId === candidate.id}
                              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background hover:bg-accent-dark disabled:opacity-50"
                            >
                              Cliente: aprovar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRejectCandidatePrice(candidate)}
                            disabled={candidateActioningId === candidate.id}
                            className="rounded-lg border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                          >
                            Recusar preço
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCandidate(candidate)}
                            disabled={candidateActioningId === candidate.id}
                            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-contrast hover:text-dark hover:bg-background disabled:opacity-50"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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

            <div className="mt-4 rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-heading font-bold text-contrast uppercase tracking-wider mb-2">
                Próxima etapa
              </p>
              {r.status === "awaiting_provider_confirmation" ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await approveServiceRequestForProvider(r.id);
                      onUpdate?.();
                      toast("success", "Prestador: aprovar");
                    } catch (error) {
                      console.error(error);
                      toast("danger", "Erro ao aprovar prestador");
                    }
                  }}
                  className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background hover:bg-accent-dark"
                >
                  Prestador: aprovar
                </button>
              ) : r.status === "searching_provider" ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await approveServiceRequestForClient(r.id);
                      onUpdate?.();
                      toast("success", "Cliente: aprovar");
                    } catch (error) {
                      console.error(error);
                      toast("danger", "Erro ao aprovar cliente");
                    }
                  }}
                  className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background hover:bg-accent-dark"
                >
                  Cliente: aprovar
                </button>
              ) : (
                <p className="text-xs text-contrast">
                  Sem ação automática nesta etapa.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
