import { BRAND } from "@/lib/brand";
import type { ServiceRequestStatus } from "@/types/database";

/** Cor de cada estado do serviço (quadro, lista e detalhe). */
export const SERVICE_STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  open: BRAND.colors.primary,
  under_review: "#94A3B8",
  review_rejected: "#ef4444",
  searching_provider: "#2261FE",
  awaiting_client_confirmation: "#A855F7",
  awaiting_provider_confirmation: "#A855F7",
  assigned: "#2261FE",
  in_progress: "#22c55e",
  finished: "#22c55e",
  cancelled: "#ef4444",
};
