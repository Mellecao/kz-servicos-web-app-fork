import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminNotificationHref } from "./admin-notification-navigation.ts";
import { isTripAdminActionRequired } from "./trip-status.ts";

test("links trip notifications to the highlighted trip on the trips page", () => {
  assert.equal(
    buildAdminNotificationHref({
      link: "/viagens",
      reference_type: "trip",
      reference_id: "trip-123",
    }),
    "/viagens?highlightTrip=trip-123",
  );
});

test("keeps regular notification links unchanged", () => {
  assert.equal(
    buildAdminNotificationHref({
      link: "/dashboard",
      reference_type: "service_request",
      reference_id: "service-123",
    }),
    "/dashboard",
  );
});

test("marks only trip statuses that need admin action", () => {
  assert.equal(isTripAdminActionRequired("under_review"), true);
  assert.equal(isTripAdminActionRequired("awaiting_driver_confirmation"), true);
  assert.equal(isTripAdminActionRequired("scheduled"), false);
  assert.equal(isTripAdminActionRequired("finished"), false);
});
