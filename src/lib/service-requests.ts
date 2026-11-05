/**
 * Lógica pura do quadro de serviços (service_requests), sem React nem Supabase.
 * Só sintaxe apagável: service-requests.test.mjs corre este ficheiro diretamente no Node.
 * Enum real do banco: 20260410120001_create_enums + 20260814133242_service_request_proposals.
 */
import type { ServiceRequest, ServiceRequestStatus } from "@/types/database";

/**
 * Ordem das colunas do quadro: cobre todos os estados do banco.
 * O quadro só deixa arrastar para a coluna seguinte, por isso os passos manuais
 * (open → under_review → searching_provider; assigned → in_progress → finished →
 * cancelled) ficam adjacentes e o estado lateral `review_rejected` vai para o fim.
 */
export const SERVICE_STATUSES: ServiceRequestStatus[] = [
  "open",
  "under_review",
  "searching_provider",
  "awaiting_client_confirmation",
  "awaiting_provider_confirmation",
  "assigned",
  "in_progress",
  "finished",
  "cancelled",
  "review_rejected",
];

export const SERVICE_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  open: "Aberto",
  under_review: "Em análise",
  review_rejected: "Rejeitado na análise",
  searching_provider: "À procura de prestador",
  awaiting_client_confirmation: "A aguardar cliente",
  awaiting_provider_confirmation: "A aguardar prestador",
  assigned: "Atribuído",
  in_progress: "Em curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

/** Estados que só fazem sentido com um prestador já escolhido. */
const NEEDS_PROVIDER: ServiceRequestStatus[] = [
  "awaiting_client_confirmation",
  "awaiting_provider_confirmation",
  "assigned",
  "in_progress",
  "finished",
];

/**
 * Motivo pelo qual um serviço não pode ser arrastado para `to`, ou null se pode.
 * O banco aceita estas mudanças sem prestador e deixa o pedido incoerente
 * (finalizado, sem prestador nem preço), por isso o painel barra-as.
 */
export function serviceMoveBlockReason(
  request: Pick<ServiceRequest, "provider_profile_id">,
  to: ServiceRequestStatus
): string | null {
  if (NEEDS_PROVIDER.includes(to) && !request.provider_profile_id) {
    return `Este serviço ainda não tem prestador atribuído. Escolha o prestador antes de o passar para "${SERVICE_STATUS_LABELS[to]}".`;
  }
  return null;
}

// ─── Fluxo do admin: análise, convites e escolha ─────────────

/** Prestador com o mínimo necessário para decidir se pode ser convidado. */
export interface ProviderForInvite {
  id: string;
  status: string;
  service_category_id: string;
  provider_category_services?: { service_category_id: string }[] | null;
}

/**
 * Prestadores que o admin pode convidar: aprovados, que cobrem a categoria do
 * pedido (categoria principal ou extra) e que ainda não foram convidados.
 * Sem categoria (profissão livre) não se filtra por categoria.
 */
export function eligibleProviders<T extends ProviderForInvite>(
  providers: T[],
  categoryId: string | null,
  invitedProviderIds: string[]
): T[] {
  return providers.filter((p) => {
    if (p.status !== "approved") return false;
    if (invitedProviderIds.includes(p.id)) return false;
    if (!categoryId) return true;
    return (
      p.service_category_id === categoryId ||
      (p.provider_category_services ?? []).some((c) => c.service_category_id === categoryId)
    );
  });
}

export type CandidateState = "invited" | "proposed" | "chosen" | "declined";

/**
 * Estado real de um convite. O app do Prestador responde com status `accepted`
 * + `offered_price` ao propor preço; quem foi escolhido é quem tem `admin_approved`
 * (definido por select_service_request_provider). `rejected` = recusou ou não foi escolhido.
 */
export function candidateState(candidate: {
  status: string;
  offered_price: number | null;
  admin_approved: boolean;
}): CandidateState {
  if (candidate.status === "rejected") return "declined";
  if (candidate.admin_approved) return "chosen";
  if (candidate.status === "accepted" || candidate.offered_price != null) return "proposed";
  return "invited";
}

const CANDIDATE_LABELS: Record<CandidateState, string> = {
  invited: "Convite enviado",
  proposed: "Proposta recebida",
  chosen: "Escolhido",
  declined: "Recusado",
};

/** Estado de um convite, para o admin (pt-AO). */
export function candidateStatusLabel(candidate: {
  status: string;
  offered_price: number | null;
  admin_approved: boolean;
}): string {
  return CANDIDATE_LABELS[candidateState(candidate)];
}

/** Só se escolhe prestador enquanto o serviço o procura e o candidato não foi recusado. */
export function canChooseCandidate(
  request: { status: ServiceRequestStatus },
  candidate: { status: string }
): boolean {
  return request.status === "searching_provider" && candidate.status !== "rejected";
}

/** Mensagem de erro, ou null se o motivo for aceitável (mínimo 3 caracteres úteis). */
export function validateRejectReason(reason: string): string | null {
  return reason.trim().length < 3
    ? "Indique o motivo da rejeição (mínimo 3 caracteres)."
    : null;
}

/** Mensagem de erro, ou null se o preço final for válido (acima de zero). */
export function validateChoicePrice(price: number | null): string | null {
  return price === null || !(price > 0) ? "Indique o preço final do serviço (acima de 0 Kz)." : null;
}

/** Aviso só de leitura enquanto se espera a confirmação de alguém; null nos outros estados. */
export function awaitingConfirmationNotice(status: ServiceRequestStatus): string | null {
  if (status === "awaiting_client_confirmation") return "A aguardar a confirmação do cliente";
  if (status === "awaiting_provider_confirmation") return "A aguardar a confirmação do prestador";
  return null;
}

/**
 * Morada e notas de um serviço. O app Cliente não grava `address_id`: guarda a morada
 * em `observations`. Sem `address_id`, `observations` é a morada (não se repete como
 * nota); com `address_id`, `observations` são notas do pedido. Os pedidos criados pelo
 * admin gravam a morada nos dois sítios (address_id com coordenadas + observations, como o
 * app Cliente): se `observations` for igual à morada registada, não se repete como nota.
 */
export function serviceAddress(request: {
  address_id: string | null;
  addresses?: { formatted_address: string | null } | null;
  observations: string | null;
}): { address: string | null; notes: string | null } {
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const observations = clean(request.observations);
  if (request.address_id) {
    const address = clean(request.addresses?.formatted_address);
    const repeatsAddress =
      address !== null && observations !== null && address.toLowerCase() === observations.toLowerCase();
    return { address, notes: repeatsAddress ? null : observations };
  }
  return { address: observations, notes: null };
}

/**
 * Pedido DIRETO: o cliente escolheu um prestador no mapa e o RPC
 * client_request_service_from_provider criou o pedido já em `searching_provider` com
 * esse prestador convidado, sem a aprovação inicial do admin. O banco não deixa nenhuma
 * marca, por isso reconhece-se pelo que falta: o pedido nunca passou por `under_review`
 * e já tem convites (o primeiro é a escolha do cliente; se o admin convidar mais, o
 * pedido continua direto na origem).
 */
export function isDirectRequest(input: {
  status: string;
  candidateCount: number;
  history: { to_status: string }[];
}): boolean {
  return (
    input.status === "searching_provider" &&
    input.candidateCount >= 1 &&
    !input.history.some((change) => change.to_status === "under_review")
  );
}

/** Junta as notas à descrição (o app Cliente também só tem descrição + morada). */
export function composeServiceDescription(description: string, notes: string): string {
  const d = description.trim();
  const n = notes.trim();
  return n ? `${d} — Notas: ${n}` : d;
}

/** Mensagem de erro, ou null se a morada estiver preenchida. */
export function validateServiceAddress(address: string): string | null {
  return address.trim() ? null : "Indique a morada do serviço.";
}
