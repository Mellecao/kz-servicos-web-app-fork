"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { formatKz, formatPhoneAO } from "@/lib/format";
import { parseKzInput } from "@/lib/product-orders";
import {
  approveServiceRequest,
  fetchInvitableProviders,
  fetchRejectionReason,
  fetchServiceCandidates,
  fetchServiceStatusHistory,
  inviteProviders,
  rejectServiceRequest,
  selectServiceProvider,
  startServiceReview,
  type InvitableProvider,
  type ServiceStatusChange,
} from "@/lib/service-flow-api";
import {
  type CandidateState,
  candidateState,
  candidateStatusLabel,
  awaitingConfirmationNotice,
  canChooseCandidate,
  eligibleProviders,
  isDirectRequest,
  validateChoicePrice,
  validateRejectReason,
} from "@/lib/service-requests";
import type { ServiceCandidate, ServiceRequest } from "@/types/database";

interface ServiceFlowPanelProps {
  request: ServiceRequest;
  /** Chamado depois de uma alteração, para a página recarregar a lista. */
  onChanged: () => void;
}

const CANDIDATE_COLORS: Record<CandidateState, string> = {
  invited: "#2261FE",
  proposed: "#A855F7",
  chosen: "#22c55e",
  declined: "#ef4444",
};

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

const priceToInput = (value: number | null | undefined) =>
  value == null ? "" : formatKz(value).replace(" Kz", "");

const primaryButton =
  "px-4 py-2 rounded-lg bg-primary text-on-primary font-heading font-bold text-xs hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const ghostButton =
  "px-4 py-2 rounded-lg border border-border text-dark text-xs font-medium hover:bg-surface-hover transition-colors duration-200 cursor-pointer disabled:opacity-50";

/**
 * Gestão do serviço pelo admin: aprovar/rejeitar na análise, convidar prestadores
 * e escolher um. O pai monta-o com `key` = id do serviço, por isso o estado interno
 * reinicia-se ao abrir outro serviço.
 */
export default function ServiceFlowPanel({ request, onChanged }: ServiceFlowPanelProps) {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<ServiceCandidate[]>([]);
  const [providers, setProviders] = useState<InvitableProvider[]>([]);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [history, setHistory] = useState<ServiceStatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [priceError, setPriceError] = useState("");

  const { id: requestId, status } = request;
  const searching = status === "searching_provider";
  const rejected = status === "review_rejected";
  const awaitingNotice = awaitingConfirmationNotice(status);

  // Recarregamento silencioso: `loading` só vale para a primeira carga.
  const load = useCallback(() => {
    Promise.all([
      fetchServiceCandidates(requestId),
      status === "searching_provider" ? fetchInvitableProviders() : Promise.resolve([]),
      status === "review_rejected" ? fetchRejectionReason(requestId) : Promise.resolve(null),
      // O histórico só serve para reconhecer o pedido direto (enquanto se procura prestador).
      status === "searching_provider" ? fetchServiceStatusHistory(requestId) : Promise.resolve([]),
    ])
      .then(([cands, provs, rejection, changes]) => {
        setCandidates(cands);
        setProviders(provs);
        setRejectionReason(rejection);
        setHistory(changes);
        setLoadError(null);
      })
      .catch((err: unknown) =>
        setLoadError(errorMessage(err, "Não foi possível carregar os dados do serviço."))
      )
      .finally(() => setLoading(false));
  }, [requestId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const invitable = useMemo(
    () =>
      eligibleProviders(
        providers,
        request.service_category_id,
        candidates.map((c) => c.provider_profile_id)
      ),
    [providers, candidates, request.service_category_id]
  );

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setBusy(true);
    try {
      await action();
      toast("success", success);
      return true;
    } catch (err) {
      toast("danger", errorMessage(err, failure));
      return false;
    } finally {
      setBusy(false);
      load();
      onChanged();
    }
  }

  function handleStartReview() {
    return run(
      () => startServiceReview(requestId),
      "Análise iniciada",
      "Erro ao iniciar a análise."
    );
  }

  function handleApprove() {
    return run(
      () => approveServiceRequest(requestId),
      "Serviço aprovado: já pode convidar prestadores",
      "Erro ao aprovar o serviço."
    );
  }

  async function handleReject() {
    const error = validateRejectReason(reason);
    if (error) {
      setReasonError(error);
      return;
    }
    const done = await run(
      () => rejectServiceRequest(requestId, reason),
      "Serviço rejeitado",
      "Erro ao rejeitar o serviço."
    );
    if (done) {
      setRejecting(false);
      setReason("");
    }
  }

  async function handleInvite() {
    const done = await run(
      () => inviteProviders(requestId, selectedIds),
      selectedIds.length === 1 ? "Prestador convidado" : `${selectedIds.length} prestadores convidados`,
      "Erro ao convidar os prestadores."
    );
    if (done) setSelectedIds([]);
  }

  function startChoosing(candidate: ServiceCandidate) {
    setChoosingId(candidate.id);
    setPriceInput(priceToInput(candidate.offered_price ?? request.estimated_price));
    setPriceError("");
  }

  async function handleChoose(candidate: ServiceCandidate) {
    const price = parseKzInput(priceInput);
    const error = validateChoicePrice(price);
    if (error || price === null) {
      setPriceError(error ?? "");
      return;
    }
    const done = await run(
      () => selectServiceProvider(requestId, candidate.provider_profile_id, price),
      "Prestador escolhido: a aguardar a confirmação do cliente",
      "Erro ao escolher o prestador."
    );
    if (done) setChoosingId(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const showCandidates = candidates.length > 0;
  // Pedido direto: o cliente escolheu o prestador no mapa (o 1.º convite) e não houve análise.
  const direct =
    searching && isDirectRequest({ status, candidateCount: candidates.length, history });
  const directProviderName = candidates[0]?.provider_profiles?.users?.full_name ?? null;
  const reviewable = status === "under_review";

  return (
    <section
      aria-label="Gestão do serviço"
      className="mt-5 rounded-xl border border-border bg-background p-4"
    >
      <p className="text-xs font-heading font-bold text-contrast uppercase tracking-wider mb-3">
        Gestão do serviço
      </p>

      {status === "open" && (
        <div>
          <p className="text-xs text-contrast mb-3">
            Pedido novo. Inicie a análise para o poder aprovar ou rejeitar.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleStartReview}
            className={primaryButton}
          >
            {busy ? "A iniciar..." : "Iniciar análise"}
          </button>
        </div>
      )}

      {awaitingNotice && (
        <div className="rounded-lg border border-border bg-surface p-3 text-xs">
          <p className="text-dark font-medium">{awaitingNotice}</p>
          <p className="mt-1 text-contrast">
            Prestador: {request.provider_profiles?.users?.full_name ?? "—"} · Preço final:{" "}
            {formatKz(request.final_price)}
          </p>
        </div>
      )}

      {reviewable && (
        <div>
          <p className="text-xs text-contrast mb-3">
            Reveja os dados do pedido. Ao aprovar, o serviço passa a procurar prestador.
          </p>
          {rejecting ? (
            <div>
              <label htmlFor="reject-reason" className="block text-xs text-contrast mb-1">
                Motivo da rejeição *
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError("");
                }}
                rows={3}
                placeholder="Ex.: pedido fora da zona de cobertura…"
                className={`w-full rounded-lg bg-surface border text-dark placeholder:text-contrast/40 focus:outline-none focus:ring-1 px-3 py-2 text-xs font-body resize-none ${
                  reasonError ? "border-danger focus:ring-danger" : "border-border focus:ring-primary"
                }`}
              />
              {reasonError && <p className="mt-1 text-xs text-danger">{reasonError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                    setReasonError("");
                  }}
                  className={ghostButton}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleReject}
                  className="px-4 py-2 rounded-lg bg-danger text-white font-heading font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {busy ? "A rejeitar..." : "Confirmar rejeição"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={handleApprove} className={primaryButton}>
                {busy ? "A aprovar..." : "Aprovar"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="px-4 py-2 rounded-lg border border-danger/40 text-danger text-xs font-medium hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          )}
        </div>
      )}

      {rejected && (
        <div className="text-xs text-contrast">
          <p>Este serviço foi rejeitado na análise.</p>
          {rejectionReason && (
            <p className="mt-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-dark">
              <span className="font-semibold text-danger">Motivo: </span>
              {rejectionReason}
            </p>
          )}
        </div>
      )}

      {searching && (
        <div>
          {direct && !loading && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-dark">
              <p className="font-semibold">Pedido direto do cliente</p>
              <p className="mt-1 leading-relaxed">
                O cliente escolheu{" "}
                {directProviderName ? <strong>{directProviderName}</strong> : "um prestador"} e
                pediu-lhe o serviço diretamente, sem passar pela análise. Aguarde a proposta de
                preço desse prestador
                {candidates.length > 1
                  ? " (já há " + candidates.length + " convites; o primeiro é a escolha do cliente)."
                  : ". Pode convidar outros prestadores para comparar propostas."}
              </p>
            </div>
          )}
          <p className="text-xs text-dark font-medium mb-2">Convidar prestadores</p>
          {loading ? (
            <p className="text-xs text-contrast">A carregar prestadores...</p>
          ) : loadError ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs">
              <p className="text-danger">{loadError}</p>
              <button type="button" onClick={load} className={`${ghostButton} mt-2`}>
                Tentar novamente
              </button>
            </div>
          ) : invitable.length === 0 ? (
            <p className="text-xs text-contrast">
              {showCandidates
                ? "Não há mais prestadores aprovados nesta categoria por convidar."
                : "Não há prestadores aprovados nesta categoria por convidar."}
            </p>
          ) : (
            <>
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface">
                {invitable.map((p) => (
                  <li key={p.id} className="border-b border-border last:border-0">
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        className="accent-primary"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs text-dark truncate">
                          {p.users?.full_name ?? "—"}
                        </span>
                        <span className="block text-[11px] text-contrast">
                          {formatPhoneAO(p.users?.phone)}
                          {p.average_rating > 0 &&
                            ` · ★ ${p.average_rating.toFixed(1).replace(".", ",")}`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={busy || selectedIds.length === 0}
                  onClick={handleInvite}
                  className={primaryButton}
                >
                  {busy
                    ? "A convidar..."
                    : `Convidar${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showCandidates && (
        <div className={searching ? "mt-5" : ""}>
          <p className="text-xs text-dark font-medium mb-2">Convidados</p>
          <ul className="flex flex-col gap-2">
            {candidates.map((c) => {
              const color = CANDIDATE_COLORS[candidateState(c)];
              const choosing = choosingId === c.id;
              return (
                <li key={c.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-dark font-medium truncate">
                        {c.provider_profiles?.users?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-contrast">
                        {formatPhoneAO(c.provider_profiles?.users?.phone)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {candidateStatusLabel(c)}
                    </span>
                  </div>

                  {(c.offered_price != null || c.kz_proposed_price != null) && (
                    <p className="mt-1.5 text-[11px] text-contrast">
                      {c.offered_price != null && (
                        <>
                          {candidateState(c) === "chosen" ? "Preço final" : "Proposta do prestador"}:{" "}
                          {formatKz(c.offered_price)}
                        </>
                      )}
                      {c.offered_price != null && c.kz_proposed_price != null && " · "}
                      {c.kz_proposed_price != null && (
                        <>Contraproposta: {formatKz(c.kz_proposed_price)}</>
                      )}
                    </p>
                  )}

                  {canChooseCandidate(request, c) &&
                    (choosing ? (
                      <div className="mt-3">
                        <label
                          htmlFor={`price-${c.id}`}
                          className="block text-[11px] text-contrast mb-1"
                        >
                          Preço final do serviço *
                        </label>
                        <div className="relative">
                          <input
                            id={`price-${c.id}`}
                            type="text"
                            inputMode="decimal"
                            value={priceInput}
                            onChange={(e) => {
                              setPriceInput(e.target.value);
                              if (priceError) setPriceError("");
                            }}
                            placeholder="15.000,00"
                            className={`w-full rounded-md bg-background border text-dark text-xs font-body pl-2 pr-8 py-1.5 focus:outline-none focus:ring-1 ${
                              priceError
                                ? "border-danger focus:ring-danger"
                                : "border-border focus:ring-primary"
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-contrast pointer-events-none">
                            Kz
                          </span>
                        </div>
                        {priceError && <p className="mt-1 text-[11px] text-danger">{priceError}</p>}
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setChoosingId(null)}
                            className={ghostButton}
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleChoose(c)}
                            className={primaryButton}
                          >
                            {busy ? "A escolher..." : "Confirmar escolha"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startChoosing(c)}
                          className={primaryButton}
                        >
                          Escolher
                        </button>
                      </div>
                    ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!loading && !showCandidates && !searching && !reviewable && !rejected && status !== "open" && (
        <p className="text-xs text-contrast">Este serviço não teve prestadores convidados.</p>
      )}
    </section>
  );
}
