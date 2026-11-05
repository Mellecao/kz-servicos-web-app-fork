import { BRAND } from "@/lib/brand";
import type { ProductOrderStatus } from "@/types/database";

/** Cor de cada estado do pedido (kanban, lista e detalhe). */
export const ORDER_STATUS_COLORS: Record<ProductOrderStatus, string> = {
  pending: BRAND.colors.primary,
  confirmed: "#2261FE",
  out_for_delivery: "#A855F7",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};
