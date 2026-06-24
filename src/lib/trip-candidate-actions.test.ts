import assert from "node:assert/strict";
import test from "node:test";
import { canAdminApproveForClient } from "./trip-candidate-actions.ts";

const eligibleCandidate = {
  status: "accepted" as const,
  admin_approved: true,
  offered_price: 300,
};

test("allows client approval for an accepted admin-approved proposal with price", () => {
  assert.equal(
    canAdminApproveForClient("searching_drivers", eligibleCandidate),
    true
  );
});

test("hides client approval before admin approval", () => {
  assert.equal(
    canAdminApproveForClient("searching_drivers", {
      ...eligibleCandidate,
      admin_approved: false,
    }),
    false
  );
});

test("hides client approval when the proposal has no price", () => {
  assert.equal(
    canAdminApproveForClient("searching_drivers", {
      ...eligibleCandidate,
      offered_price: null,
    }),
    false
  );
});

test("hides client approval outside the searching drivers stage", () => {
  assert.equal(
    canAdminApproveForClient("awaiting_client_confirmation", eligibleCandidate),
    false
  );
});
