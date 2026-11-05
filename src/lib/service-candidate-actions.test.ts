import assert from "node:assert/strict";
import test from "node:test";
import { canAdminApproveServiceForClient } from "./service-candidate-actions.ts";

const eligibleCandidate = {
  status: "accepted" as const,
  admin_approved: true,
  offered_price: 180,
};

test("allows client approval for an accepted admin-approved provider proposal with price", () => {
  assert.equal(
    canAdminApproveServiceForClient("searching_provider", eligibleCandidate),
    true,
  );
});

test("blocks client approval when provider proposal is not admin-approved", () => {
  assert.equal(
    canAdminApproveServiceForClient("searching_provider", {
      ...eligibleCandidate,
      admin_approved: false,
    }),
    false,
  );
});

test("blocks client approval outside provider search status", () => {
  assert.equal(
    canAdminApproveServiceForClient(
      "awaiting_client_confirmation",
      eligibleCandidate,
    ),
    false,
  );
});
