// Prestadores reais vs fictícios (is_demo). Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_ORIGIN_LABELS,
  isDemoProvider,
  filterProvidersByOrigin,
  countByOrigin,
} from "./provider-origin.ts";

const real = { id: "r1", is_demo: false };
const legacy = { id: "r2" }; // sem a coluna (ou null) conta como real
const nul = { id: "r3", is_demo: null };
const demo1 = { id: "d1", is_demo: true };
const demo2 = { id: "d2", is_demo: true };
const all = [real, demo1, legacy, demo2, nul];

describe("isDemoProvider", () => {
  test("só is_demo === true é fictício; ausente ou null conta como real", () => {
    assert.equal(isDemoProvider(demo1), true);
    assert.equal(isDemoProvider(real), false);
    assert.equal(isDemoProvider(legacy), false);
    assert.equal(isDemoProvider(nul), false);
  });
});

describe("filterProvidersByOrigin", () => {
  test("todos devolve tudo, pela mesma ordem", () => {
    assert.deepEqual(filterProvidersByOrigin(all, "all").map((p) => p.id), ["r1", "d1", "r2", "d2", "r3"]);
  });

  test("reais exclui os fictícios (e mantém os sem is_demo)", () => {
    assert.deepEqual(filterProvidersByOrigin(all, "real").map((p) => p.id), ["r1", "r2", "r3"]);
  });

  test("fictícios devolve só os is_demo", () => {
    assert.deepEqual(filterProvidersByOrigin(all, "demo").map((p) => p.id), ["d1", "d2"]);
  });

  test("lista vazia não rebenta", () => {
    for (const mode of ["all", "real", "demo"]) assert.deepEqual(filterProvidersByOrigin([], mode), []);
  });
});

describe("countByOrigin e rótulos", () => {
  test("conta reais e fictícios", () => {
    assert.deepEqual(countByOrigin(all), { all: 5, real: 3, demo: 2 });
    assert.deepEqual(countByOrigin([]), { all: 0, real: 0, demo: 0 });
  });

  test("rótulos pt-AO do filtro", () => {
    assert.equal(PROVIDER_ORIGIN_LABELS.all, "Todos");
    assert.equal(PROVIDER_ORIGIN_LABELS.real, "Reais");
    assert.equal(PROVIDER_ORIGIN_LABELS.demo, "Demo");
  });
});
