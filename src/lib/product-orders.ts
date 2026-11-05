/**
 * Lógica pura dos pedidos de produtos e do catálogo (sem React nem Supabase).
 * Só sintaxe apagável: product-orders.test.mjs corre este ficheiro diretamente no Node.
 * Fluxo da migration 20261105120000_products_module: pending → confirmed →
 * out_for_delivery → delivered, ou cancelled.
 */
import type { ProductOrder, ProductOrderStatus } from "@/types/database";

// ─── Estados ───────────────────────────────────────────────

export const ORDER_STATUSES: ProductOrderStatus[] = [
  "pending",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export const ORDER_STATUS_LABELS: Record<ProductOrderStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  out_for_delivery: "A caminho",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/** Texto do botão que avança o pedido para o estado seguinte. */
export const NEXT_ACTION_LABELS: Partial<Record<ProductOrderStatus, string>> = {
  pending: "Confirmar pedido",
  confirmed: "Enviar para entrega",
  out_for_delivery: "Marcar como entregue",
};

const FLOW: ProductOrderStatus[] = ["pending", "confirmed", "out_for_delivery", "delivered"];

/** Estado seguinte no fluxo normal; null para entregue e cancelado. */
export function nextStatus(status: ProductOrderStatus): ProductOrderStatus | null {
  const index = FLOW.indexOf(status);
  return index >= 0 && index < FLOW.length - 1 ? FLOW[index + 1] : null;
}

/** Só se pode mover um pedido para o estado imediatamente seguinte. */
export function isAllowedMove(from: ProductOrderStatus, to: ProductOrderStatus): boolean {
  return nextStatus(from) === to;
}

/** Cancela-se enquanto não estiver entregue nem já cancelado. */
export function canCancel(status: ProductOrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

// ─── Apresentação ──────────────────────────────────────────

/** "#E11769": # + 6 primeiros caracteres do uuid, em maiúsculas. */
export function shortOrderCode(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** "2× Água 20 L, 1× Botija de gás 12 kg +1" (mostra `max` itens e conta os restantes). */
export function summarizeItems(
  items: { product_name: string; quantity: number }[] | null | undefined,
  max = 2
): string {
  if (!items || items.length === 0) return "—";
  const shown = items
    .slice(0, max)
    .map((item) => `${item.quantity}× ${item.product_name}`)
    .join(", ");
  const extra = items.length - max;
  return extra > 0 ? `${shown} +${extra}` : shown;
}

/** Link do Google Maps: por coordenadas se houver as duas, senão pela morada. */
export function mapsUrl(
  order: Pick<ProductOrder, "delivery_address" | "delivery_lat" | "delivery_lng">
): string {
  const base = "https://www.google.com/maps/search/?api=1&query=";
  const { delivery_lat: lat, delivery_lng: lng } = order;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${base}${lat},${lng}`;
  }
  return base + encodeURIComponent(order.delivery_address);
}

// ─── Entrada de valores e validações ───────────────────────

/**
 * Lê um preço escrito pelo admin: "1500", "1.500,50", "35.000", "1500.5", "2500 Kz".
 * Vírgula é decimal; ponto seguido de 3 dígitos (ou vários pontos) é milhar;
 * ponto com 1–2 dígitos é decimal. Vazio, texto, negativo → null.
 */
export function parseKzInput(raw: string): number | null {
  const cleaned = raw.replace(/kz/gi, "").replace(/\s/g, "");
  if (!cleaned || !/^[0-9.,]+$/.test(cleaned)) return null;

  const commas = cleaned.split(",").length - 1;
  const dots = cleaned.split(".").length - 1;
  let normalized: string;

  if (commas > 1) return null;
  if (commas === 1) {
    const [integer, fraction] = cleaned.split(",");
    normalized = `${integer.replace(/\./g, "")}.${fraction}`;
  } else if (dots === 0) {
    normalized = cleaned;
  } else if (dots === 1) {
    const [integer, fraction] = cleaned.split(".");
    normalized = fraction.length <= 2 ? `${integer}.${fraction}` : `${integer}${fraction}`;
  } else {
    normalized = cleaned.replace(/\./g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Mensagem de erro, ou null se o motivo for aceitável (mínimo 3 caracteres úteis). */
export function validateCancelReason(reason: string): string | null {
  return reason.trim().length < 3
    ? "Indique o motivo do cancelamento (mínimo 3 caracteres)."
    : null;
}

export interface ProductInput {
  name: string;
  description: string;
  unitLabel: string;
  price: string;
  sortOrder: string;
}

export type ProductValidation =
  | {
      ok: true;
      value: {
        name: string;
        description: string | null;
        unit_label: string;
        price: number;
        sort_order: number;
      };
    }
  | { ok: false; error: string };

const MAX_PRICE = 9_999_999_999.99; // limite de numeric(12,2)
const MAX_INT = 2_147_483_647; // limite de integer

/** Valida e converte o formulário do catálogo em valores prontos para gravar. */
export function validateProductInput(input: ProductInput): ProductValidation {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Indique o nome do produto." };

  const unit = input.unitLabel.trim();
  if (!unit) return { ok: false, error: "Indique a unidade (ex.: garrafão, saco, botija)." };

  const parsed = parseKzInput(input.price);
  if (parsed === null) {
    return { ok: false, error: "Preço inválido. Use um valor em Kz, por exemplo 1.500,00." };
  }
  const price = Math.round(parsed * 100) / 100;
  if (price > MAX_PRICE) return { ok: false, error: "O preço é demasiado alto." };

  const order = input.sortOrder.trim();
  if (!/^-?\d+$/.test(order) || Math.abs(Number(order)) > MAX_INT) {
    return { ok: false, error: "A ordem tem de ser um número inteiro." };
  }

  return {
    ok: true,
    value: {
      name,
      description: input.description.trim() || null,
      unit_label: unit,
      price,
      sort_order: Number(order),
    },
  };
}

/**
 * Lê system_settings.product_delivery_fee (jsonb): número ou texto numérico,
 * como o RPC `(value #>> '{}')::numeric`. Ausente ou inválido → null.
 */
export function parseDeliveryFee(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}
