import type {
  ServiceRequestProviderCandidate,
  ServiceRequestStatus,
} from "@/types/database";

export type ServiceStatusAction = {
  label: string;
  to: ServiceRequestStatus;
  direction: "forward" | "back";
};

export const SERVICE_STATUS_ACTIONS: Record<
  ServiceRequestStatus,
  ServiceStatusAction[]
> = {
  open: [{ label: "Enviar para análise", to: "under_review", direction: "forward" }],
  under_review: [
    { label: "Buscar prestador", to: "searching_provider", direction: "forward" },
    { label: "Voltar para abertas", to: "open", direction: "back" },
  ],
  review_rejected: [],
  searching_provider: [
    {
      label: "Aguardar cliente",
      to: "awaiting_client_confirmation",
      direction: "forward",
    },
    { label: "Voltar para análise", to: "under_review", direction: "back" },
  ],
  awaiting_client_confirmation: [
    {
      label: "Validar prestador",
      to: "awaiting_provider_confirmation",
      direction: "forward",
    },
  ],
  awaiting_provider_confirmation: [
    { label: "Agendar", to: "assigned", direction: "forward" },
  ],
  assigned: [{ label: "Iniciar", to: "in_progress", direction: "forward" }],
  in_progress: [{ label: "Finalizar", to: "finished", direction: "forward" }],
  finished: [],
  cancelled: [],
};

export function getServiceStatusActions(
  status: ServiceRequestStatus,
): ServiceStatusAction[] {
  return SERVICE_STATUS_ACTIONS[status] ?? [];
}

export function isServiceAdminActionRequired(status: ServiceRequestStatus): boolean {
  return [
    "open",
    "under_review",
    "searching_provider",
    "awaiting_client_confirmation",
    "awaiting_provider_confirmation",
  ].includes(status);
}

export function getServiceClientConfirmationBlockReason(
  candidates: Pick<
    ServiceRequestProviderCandidate,
    "status" | "admin_approved" | "offered_price"
  >[],
): string | null {
  if (candidates.length === 0) {
    return "Adicione ao menos um prestador para ele informar o preço antes de aguardar o cliente.";
  }

  const acceptedWithPrice = candidates.filter(
    (candidate) =>
      candidate.status === "accepted" && candidate.offered_price != null,
  );

  if (acceptedWithPrice.length === 0) {
    return "Aguarde um prestador aceitar a solicitação e informar o preço antes de aguardar o cliente.";
  }

  if (!acceptedWithPrice.some((candidate) => candidate.admin_approved)) {
    return "Aprove ao menos um preço de prestador para o cliente antes de avançar a etapa.";
  }

  return null;
}
