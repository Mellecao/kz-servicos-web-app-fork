import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdminApproveForClient,
  shouldResetTripAfterCandidateRemoval,
} from "./trip-candidate-actions.ts";

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

test("resets trip search when removing the confirmed driver", () => {
  assert.equal(
    shouldResetTripAfterCandidateRemoval({
      currentDriverProfileId: "driver-1",
      removedDriverProfileId: "driver-1",
    }),
    true
  );
});

test("does not reset trip search when removing another candidate", () => {
  assert.equal(
    shouldResetTripAfterCandidateRemoval({
      currentDriverProfileId: "driver-1",
      removedDriverProfileId: "driver-2",
    }),
    false
  );
});

test("does not reset trip search when trip has no confirmed driver", () => {
  assert.equal(
    shouldResetTripAfterCandidateRemoval({
      currentDriverProfileId: null,
      removedDriverProfileId: "driver-1",
    }),
    false
  );
});
