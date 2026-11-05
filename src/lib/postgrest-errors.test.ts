import assert from "node:assert/strict";
import test from "node:test";
import { isMissingPostgrestRelationError } from "./postgrest-errors.ts";

test("identifies missing PostgREST relationships and tables", () => {
  assert.equal(isMissingPostgrestRelationError({ code: "PGRST200" }), true);
  assert.equal(isMissingPostgrestRelationError({ code: "PGRST205" }), true);
});

test("does not hide unrelated PostgREST errors", () => {
  assert.equal(isMissingPostgrestRelationError({ code: "42501" }), false);
  assert.equal(isMissingPostgrestRelationError(new Error("network error")), false);
});
