import assert from "node:assert/strict";
import test from "node:test";
import { formatTimeAgo } from "./time-ago.ts";

const NOW = new Date("2026-07-29T12:00:00.000Z").getTime();

test("formatTimeAgo: 0-59s retorna 'agora'", () => {
  assert.equal(formatTimeAgo(new Date(NOW - 0).toISOString(), NOW), "agora");
  assert.equal(formatTimeAgo(new Date(NOW - 30_000).toISOString(), NOW), "agora");
  assert.equal(formatTimeAgo(new Date(NOW - 59_000).toISOString(), NOW), "agora");
});

test("formatTimeAgo: 1-59m retorna 'há Xm'", () => {
  assert.equal(formatTimeAgo(new Date(NOW - 60_000).toISOString(), NOW), "há 1m");
  assert.equal(formatTimeAgo(new Date(NOW - 15 * 60_000).toISOString(), NOW), "há 15m");
  assert.equal(formatTimeAgo(new Date(NOW - 59 * 60_000).toISOString(), NOW), "há 59m");
});

test("formatTimeAgo: >=1h retorna 'há Xh'", () => {
  assert.equal(formatTimeAgo(new Date(NOW - 60 * 60_000).toISOString(), NOW), "há 1h");
  assert.equal(formatTimeAgo(new Date(NOW - 3 * 60 * 60_000).toISOString(), NOW), "há 3h");
});

test("formatTimeAgo: timestamp futuro (drift de clock) retorna 'agora'", () => {
  assert.equal(formatTimeAgo(new Date(NOW + 5000).toISOString(), NOW), "agora");
});
