/**
 * Rótulos de forma de pagamento (Angola) — única fonte.
 * Só sintaxe apagável: payment.test.mjs corre este ficheiro diretamente no Node.
 */
import type { PaymentMethod } from "@/types/database";

/**
 * Rótulo de todos os métodos que podem existir na BD. `pix` é legado (o
 * contrato manda escondê-lo): continua aqui para registos antigos não ficarem
 * sem nome, mas não está em PAYMENT_OPTIONS.
 */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  debit: "Multicaixa / cartão de débito",
  credit: "Cartão de crédito",
  cash: "Numerário",
  billing: "Faturação",
};

/** Opções que o utilizador pode escolher (sem pix). */
export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = (
  ["debit", "credit", "cash", "billing"] as const
).map((value) => ({ value, label: PAYMENT_LABELS[value] }));

/** Rótulo para mostrar; nulo → "—"; método desconhecido devolve-se como está. */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  return (PAYMENT_LABELS as Record<string, string>)[method] ?? method;
}
