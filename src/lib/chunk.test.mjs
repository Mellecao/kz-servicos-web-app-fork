// Divisão em lotes (para filtros .in() com muitos ids). Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chunk } from "./chunk.ts";

describe("chunk", () => {
  test("divide em lotes do tamanho pedido, com o resto no último", () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  test("lista vazia dá nenhum lote", () => {
    assert.deepEqual(chunk([], 50), []);
  });

  test("lista mais curta que o lote dá um só lote", () => {
    assert.deepEqual(chunk(["a", "b"], 50), [["a", "b"]]);
  });

  test("não perde nem repete elementos (632 ids em lotes de 50)", () => {
    const ids = Array.from({ length: 632 }, (_, i) => `id-${i}`);
    const parts = chunk(ids, 50);
    assert.equal(parts.length, 13);
    assert.ok(parts.every((p) => p.length <= 50));
    assert.deepEqual(parts.flat(), ids);
  });

  test("tamanho inválido (0 ou negativo) é erro, não ciclo infinito", () => {
    assert.throws(() => chunk([1, 2], 0), /tamanho/i);
    assert.throws(() => chunk([1, 2], -1), /tamanho/i);
  });
});
