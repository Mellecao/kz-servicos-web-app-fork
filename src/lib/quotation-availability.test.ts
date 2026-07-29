import assert from "node:assert/strict";
import test from "node:test";
import {
  computeQuotationAvailability,
  type QuotationOverride,
} from "./quotation-availability.ts";

function at(hour: number): Date {
  const d = new Date("2026-07-29T00:00:00");
  d.setHours(hour, 0, 0, 0);
  return d;
}

test("override='auto' e hora=14 → available", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(14), adminOverride: "auto" }),
    "available"
  );
});

test("override='auto' e hora=6 → unavailable", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(6), adminOverride: "auto" }),
    "unavailable"
  );
});

test("override='auto' borda inferior: 07:00 → available, 06:59 → unavailable", () => {
  const seven = at(7);
  const sixFiftyNine = new Date(seven.getTime() - 60_000);
  assert.equal(
    computeQuotationAvailability({ nowInSp: seven, adminOverride: "auto" }),
    "available"
  );
  assert.equal(
    computeQuotationAvailability({ nowInSp: sixFiftyNine, adminOverride: "auto" }),
    "unavailable"
  );
});

test("override='auto' borda superior: 19:59 → available, 20:00 → unavailable", () => {
  const twenty = at(20);
  const nineteenFiftyNine = new Date(twenty.getTime() - 60_000);
  assert.equal(
    computeQuotationAvailability({ nowInSp: nineteenFiftyNine, adminOverride: "auto" }),
    "available"
  );
  assert.equal(
    computeQuotationAvailability({ nowInSp: twenty, adminOverride: "auto" }),
    "unavailable"
  );
});

test("override='force_enabled' + hora=3 → available (ignora horário)", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(3), adminOverride: "force_enabled" }),
    "available"
  );
});

test("override='force_disabled' + hora=12 → unavailable (ignora horário)", () => {
  assert.equal(
    computeQuotationAvailability({ nowInSp: at(12), adminOverride: "force_disabled" }),
    "unavailable"
  );
});

test("QuotationOverride type exportado é literal union", () => {
  const values: QuotationOverride[] = ["auto", "force_enabled", "force_disabled"];
  assert.equal(values.length, 3);
});
