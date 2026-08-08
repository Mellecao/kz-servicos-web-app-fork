import assert from "node:assert/strict";
import test from "node:test";
import { isLogClickable } from "./admin-log-utils.ts";

test("isLogClickable returns true when entity_id is present", () => {
  assert.equal(isLogClickable({ entity_id: "abc-123" }), true);
});

test("isLogClickable returns false when entity_id is null", () => {
  assert.equal(isLogClickable({ entity_id: null }), false);
});

test("isLogClickable returns false when entity_id is an empty string", () => {
  assert.equal(isLogClickable({ entity_id: "" }), false);
});
