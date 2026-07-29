import assert from "node:assert/strict";
import test from "node:test";
import { SP_CAMPINAS_BOUNDS, GOOGLE_MAPS_LIBRARIES } from "./google-maps-config.ts";

function contains(bounds: typeof SP_CAMPINAS_BOUNDS, lat: number, lng: number): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

test("SP_CAMPINAS_BOUNDS contém pontos de referência da região", () => {
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.55, -46.63), "SP centro");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.46, -46.53), "Guarulhos");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.53, -46.79), "Osasco");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -22.90, -47.06), "Campinas centro");
  assert.ok(contains(SP_CAMPINAS_BOUNDS, -23.19, -46.88), "Jundiaí");
});

test("SP_CAMPINAS_BOUNDS NÃO contém pontos fora da região", () => {
  assert.ok(!contains(SP_CAMPINAS_BOUNDS, -22.90, -43.20), "Rio de Janeiro");
  assert.ok(!contains(SP_CAMPINAS_BOUNDS, -19.91, -43.94), "Belo Horizonte");
  assert.ok(!contains(SP_CAMPINAS_BOUNDS, -25.42, -49.27), "Curitiba");
});

test("GOOGLE_MAPS_LIBRARIES é uma lista vazia (sem Places/Directions)", () => {
  assert.deepEqual(GOOGLE_MAPS_LIBRARIES, []);
});
