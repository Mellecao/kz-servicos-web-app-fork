import assert from "node:assert/strict";
import test from "node:test";
import {
  getServiceClientConfirmationBlockReason,
  getServiceStatusActions,
  isServiceAdminActionRequired,
} from "./service-status.ts";

test("requires admin action while service is in proposal confirmation stages", () => {
  assert.equal(isServiceAdminActionRequired("searching_provider"), true);
  assert.equal(isServiceAdminActionRequired("awaiting_client_confirmation"), true);
  assert.equal(isServiceAdminActionRequired("awaiting_provider_confirmation"), true);
  assert.equal(isServiceAdminActionRequired("assigned"), false);
});

test("blocks client confirmation until a provider has an admin-approved price", () => {
  assert.equal(
    getServiceClientConfirmationBlockReason([]),
    "Adicione ao menos um prestador para ele informar o preço antes de aguardar o cliente.",
  );
  assert.equal(
    getServiceClientConfirmationBlockReason([
      {
        status: "accepted",
        admin_approved: false,
        offered_price: 250,
      },
    ]),
    "Aprove ao menos um preço de prestador para o cliente antes de avançar a etapa.",
  );
  assert.equal(
    getServiceClientConfirmationBlockReason([
      {
        status: "accepted",
        admin_approved: true,
        offered_price: 250,
      },
    ]),
    null,
  );
});

test("maps service status actions through client and provider re-check", () => {
  assert.deepEqual(
    getServiceStatusActions("awaiting_client_confirmation").map(
      (action) => action.to,
    ),
    ["awaiting_provider_confirmation"],
  );
  assert.deepEqual(
    getServiceStatusActions("awaiting_provider_confirmation").map(
      (action) => action.to,
    ),
    ["assigned"],
  );
});
