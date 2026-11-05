// Rótulos de pagamento de Angola. Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_LABELS, PAYMENT_OPTIONS, formatPaymentMethod } from "./payment.ts";

describe("rótulos de pagamento (Angola)", () => {
  test("cash, debit, credit e billing têm o rótulo do contrato", () => {
    assert.equal(PAYMENT_LABELS.cash, "Numerário");
    assert.equal(PAYMENT_LABELS.debit, "Multicaixa / cartão de débito");
    assert.equal(PAYMENT_LABELS.credit, "Cartão de crédito");
    assert.equal(PAYMENT_LABELS.billing, "Faturação");
  });

  test("pix não aparece nas opções que o utilizador pode escolher", () => {
    assert.deepEqual(
      PAYMENT_OPTIONS.map((o) => o.value),
      ["debit", "credit", "cash", "billing"]
    );
  });

  test("cada opção usa o mesmo rótulo do mapa", () => {
    for (const o of PAYMENT_OPTIONS) assert.equal(o.label, PAYMENT_LABELS[o.value]);
  });

  test("pix legado na BD continua a ter rótulo (só fica escondido das opções)", () => {
    assert.equal(formatPaymentMethod("pix"), "Pix");
  });

  test("nulo mostra traço e método desconhecido devolve-se tal como está", () => {
    assert.equal(formatPaymentMethod(null), "—");
    assert.equal(formatPaymentMethod(undefined), "—");
    assert.equal(formatPaymentMethod("xyz"), "xyz");
  });
});
