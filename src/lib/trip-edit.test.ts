import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditTripRoute,
  validateTripPatch,
  buildTripPatchPayload,
  type TripPatchCurrent,
} from "./trip-edit.ts";

test("canEditTripRoute only blocks trips already in progress or closed", () => {
  for (const status of ["started", "finished", "cancelled"] as const) {
    assert.equal(canEditTripRoute(status), false);
  }
  for (const status of ["open", "scheduled", "searching_drivers", "awaiting_client_confirmation", "awaiting_driver_confirmation", "under_review", "review_rejected"] as const) {
    assert.equal(canEditTripRoute(status), true);
  }
});

const baseCurrent: TripPatchCurrent = { is_round_trip: false, return_datetime: null };

test("validateTripPatch requires a return datetime only for active round trips", () => {
  assert.match(validateTripPatch({ is_round_trip: true }, baseCurrent) ?? "", /retorno/i);
  assert.equal(validateTripPatch({ is_round_trip: true, return_datetime: "2026-08-01T10:00:00.000Z" }, baseCurrent), null);
  assert.equal(validateTripPatch({ is_round_trip: false }, { is_round_trip: true, return_datetime: "2026-08-01T10:00:00.000Z" }), null);
  assert.equal(validateTripPatch({ scheduled_datetime: "2026-09-01T08:00:00.000Z" }, { is_round_trip: true, return_datetime: "2026-08-01T10:00:00.000Z" }), null);
  assert.ok(validateTripPatch({ scheduled_datetime: "2026-09-01T08:00:00.000Z" }, { is_round_trip: true, return_datetime: null }));
});

const addr1 = { formatted_address: "Rua A, 1", google_place_id: "p1" };
const addr2 = { formatted_address: "Rua B, 2", google_place_id: "p2" };
const addr3 = { formatted_address: "Rua C, 3", google_place_id: "p3" };
const baseOriginal = { pickup: addr1, dropoff: addr2, scheduled_datetime: "2026-08-01T08:00:00.000Z", stops: [] as typeof addr1[], is_round_trip: false, return_datetime: null as string | null };

test("buildTripPatchPayload returns only changed values", () => {
  assert.equal(buildTripPatchPayload(baseOriginal, baseOriginal), null);
  assert.deepEqual(buildTripPatchPayload(baseOriginal, { ...baseOriginal, scheduled_datetime: "2026-09-01T08:00:00.000Z" }), { scheduled_datetime: "2026-09-01T08:00:00.000Z" });
  assert.deepEqual(buildTripPatchPayload(baseOriginal, { ...baseOriginal, pickup: addr3 }), { pickup: addr3 });
  assert.deepEqual(buildTripPatchPayload(baseOriginal, { ...baseOriginal, stops: [addr3] }), { stops: [addr3] });
  assert.deepEqual(buildTripPatchPayload({ ...baseOriginal, stops: [addr3] }, baseOriginal), { stops: [] });
  assert.deepEqual(buildTripPatchPayload({ ...baseOriginal, stops: [addr1, addr2] }, { ...baseOriginal, stops: [addr2, addr1] }), { stops: [addr2, addr1] });
  assert.deepEqual(buildTripPatchPayload(baseOriginal, { ...baseOriginal, is_round_trip: true, return_datetime: "2026-08-10T10:00:00.000Z" }), { is_round_trip: true, return_datetime: "2026-08-10T10:00:00.000Z" });
  assert.deepEqual(buildTripPatchPayload({ ...baseOriginal, is_round_trip: true, return_datetime: "2026-08-10T10:00:00.000Z" }, baseOriginal), { is_round_trip: false, return_datetime: null });
});
