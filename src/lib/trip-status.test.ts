import assert from "node:assert/strict";
import test from "node:test";
import { isFlashTrip } from "./trip-status.ts";

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
