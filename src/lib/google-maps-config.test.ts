import assert from "node:assert/strict";
import test from "node:test";
import {
  LUANDA_METRO_BOUNDS,
  SERVICE_AREA_BOUNDS,
  GOOGLE_MAPS_LIBRARIES,
} from "./google-maps-config.ts";

type Bounds = { south: number; north: number; west: number; east: number };

function contains(bounds: Bounds, lat: number, lng: number): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

test("LUANDA_METRO_BOUNDS contém os bairros e municípios de referência", () => {
  assert.ok(contains(LUANDA_METRO_BOUNDS, -8.8383, 13.2344), "Luanda centro");
  assert.ok(contains(LUANDA_METRO_BOUNDS, -8.92, 13.18), "Talatona");
  assert.ok(contains(LUANDA_METRO_BOUNDS, -8.9, 13.37), "Viana");
  assert.ok(contains(LUANDA_METRO_BOUNDS, -8.78, 13.37), "Cacuaco");
  assert.ok(contains(LUANDA_METRO_BOUNDS, -8.99, 13.27), "Kilamba");
  assert.ok(contains(LUANDA_METRO_BOUNDS, -8.84, 13.28), "Cazenga");
});

test("LUANDA_METRO_BOUNDS NÃO contém cidades fora de Luanda nem o Brasil", () => {
  assert.ok(!contains(LUANDA_METRO_BOUNDS, -12.58, 13.4), "Benguela");
  assert.ok(!contains(LUANDA_METRO_BOUNDS, -12.78, 15.74), "Huambo");
  assert.ok(!contains(LUANDA_METRO_BOUNDS, -14.92, 13.5), "Lubango");
  assert.ok(!contains(LUANDA_METRO_BOUNDS, -23.55, -46.63), "São Paulo");
});

test("SERVICE_AREA_BOUNDS abrange toda a zona urbana e exclui o Brasil", () => {
  for (const [lat, lng] of [
    [LUANDA_METRO_BOUNDS.south, LUANDA_METRO_BOUNDS.west],
    [LUANDA_METRO_BOUNDS.north, LUANDA_METRO_BOUNDS.east],
  ]) {
    assert.ok(contains(SERVICE_AREA_BOUNDS, lat, lng));
  }
  assert.ok(!contains(SERVICE_AREA_BOUNDS, -23.55, -46.63), "São Paulo");
});

test("GOOGLE_MAPS_LIBRARIES inclui Places (usado pelo autocomplete de morada)", () => {
  assert.deepEqual(GOOGLE_MAPS_LIBRARIES, ["places"]);
});
