import assert from "node:assert/strict";
import test from "node:test";
import { isProviderWithoutDriverProfile } from "./provider-filters.ts";

test("excludes providers with a driver profile relation", () => {
  assert.equal(
    isProviderWithoutDriverProfile({ driver_profiles: { id: "driver-1" } }),
    false,
  );
  assert.equal(
    isProviderWithoutDriverProfile({ driver_profiles: [{ id: "driver-1" }] }),
    false,
  );
});

test("keeps providers without a driver profile relation", () => {
  assert.equal(isProviderWithoutDriverProfile({ driver_profiles: null }), true);
  assert.equal(isProviderWithoutDriverProfile({ driver_profiles: [] }), true);
  assert.equal(isProviderWithoutDriverProfile({}), true);
});
