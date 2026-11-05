import assert from "node:assert/strict";
import test from "node:test";
import { isFlashTrip, isQuotationTrip, isChooseDriverTrip } from "./trip-status.ts";

test("isFlashTrip returns true for trip_type=flash", () => {
  assert.equal(isFlashTrip({ trip_type: "flash" }), true);
});

test("isFlashTrip returns false for trip_type=standard", () => {
  assert.equal(isFlashTrip({ trip_type: "standard" }), false);
});

test("isFlashTrip returns false for null/undefined/missing trip_type", () => {
  assert.equal(isFlashTrip(null), false);
  assert.equal(isFlashTrip(undefined), false);
  assert.equal(isFlashTrip({}), false);
  assert.equal(isFlashTrip({ trip_type: null }), false);
});

test("isQuotationTrip returns true for trip_type=scheduled_quote", () => {
  assert.equal(isQuotationTrip({ trip_type: "scheduled_quote" }), true);
});

test("isQuotationTrip returns false for other trip_types", () => {
  assert.equal(isQuotationTrip({ trip_type: "standard" }), false);
  assert.equal(isQuotationTrip({ trip_type: "flash" }), false);
  assert.equal(isQuotationTrip(null), false);
  assert.equal(isQuotationTrip({}), false);
});

test("isChooseDriverTrip returns true for trip_type=scheduled_choose_driver", () => {
  assert.equal(isChooseDriverTrip({ trip_type: "scheduled_choose_driver" }), true);
});

test("isChooseDriverTrip returns false for other trip_types", () => {
  assert.equal(isChooseDriverTrip({ trip_type: "standard" }), false);
  assert.equal(isChooseDriverTrip({ trip_type: "scheduled_quote" }), false);
  assert.equal(isChooseDriverTrip(null), false);
  assert.equal(isChooseDriverTrip({}), false);
});
