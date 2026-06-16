import type { TripStatus } from "@/types/database";
import type { TripDriverCandidate } from "@/types/database";

export type TripStatusAction = {
  label: string;
  to: TripStatus;
  direction: "forward" | "back";
};

export const TRIP_STATUS_ACTIONS: Record<TripStatus, TripStatusAction[]> = {
  open: [{ label: "Enviar para aprovação", to: "under_review", direction: "forward" }],
  under_review: [
    { label: "Buscar motorista", to: "searching_drivers", direction: "forward" },
    { label: "Voltar para abertas", to: "open", direction: "back" },
  ],
  review_rejected: [],
  searching_drivers: [
    { label: "Aguardar cliente", to: "awaiting_client_confirmation", direction: "forward" },
    { label: "Voltar para aprovação", to: "under_review", direction: "back" },
  ],
  awaiting_client_confirmation: [
    { label: "Validar motorista", to: "awaiting_driver_confirmation", direction: "forward" },
  ],
  awaiting_driver_confirmation: [
    { label: "Agendar", to: "scheduled", direction: "forward" },
  ],
  scheduled: [{ label: "Iniciar", to: "started", direction: "forward" }],
  started: [{ label: "Finalizar", to: "finished", direction: "forward" }],
  finished: [],
  cancelled: [],
};

export function getTripStatusActions(status: TripStatus): TripStatusAction[] {
  return TRIP_STATUS_ACTIONS[status] ?? [];
}

export function canMoveTripStatus(
  fromStatus: TripStatus,
  toStatus: TripStatus,
  direction?: TripStatusAction["direction"]
): boolean {
  return getTripStatusActions(fromStatus).some(
    (action) =>
      action.to === toStatus && (direction === undefined || action.direction === direction)
  );
}

export function getClientConfirmationBlockReason(
  candidates: TripDriverCandidate[]
): string | null {
  if (candidates.length === 0) {
    return "Adicione ao menos um motorista para ele informar o preço antes de aguardar o cliente.";
  }

  const acceptedWithPrice = candidates.filter(
    (candidate) => candidate.status === "accepted" && candidate.offered_price != null
  );
  if (acceptedWithPrice.length === 0) {
    return "Aguarde um motorista aceitar a solicitação e informar o preço antes de aguardar o cliente.";
  }

  if (!acceptedWithPrice.some((candidate) => candidate.admin_approved)) {
    return "Aprove ao menos um preço de motorista para o cliente antes de avançar a etapa.";
  }

  return null;
}
