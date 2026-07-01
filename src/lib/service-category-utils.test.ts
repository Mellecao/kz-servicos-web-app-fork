import assert from "node:assert/strict";
import test from "node:test";
import { buildServiceCategorySlug } from "./service-category-utils.ts";

test("builds lowercase accent-free service category slug", () => {
  assert.equal(buildServiceCategorySlug("Instalação Elétrica!"), "instalacao-eletrica");
});

test("collapses duplicate separators in service category slug", () => {
  assert.equal(buildServiceCategorySlug("  Limpeza   Pós Obra  "), "limpeza-pos-obra");
});
