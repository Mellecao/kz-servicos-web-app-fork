import assert from "node:assert/strict";
import test from "node:test";
import {
  DRIVER_MAP_COLOR_SCHEME,
  DRIVER_MAP_STYLES,
} from "./driver-map-style";

function stylerColor(styler: object): string | undefined {
  return "color" in styler && typeof styler.color === "string"
    ? styler.color
    : undefined;
}

test("usa a variante escura definida em exported_style.json", () => {
  assert.equal(DRIVER_MAP_COLOR_SCHEME, "DARK");
});

test("converte as cores das vias do tema exportado", () => {
  assert.ok(
    DRIVER_MAP_STYLES.some(
      (style) =>
        style.featureType === "road.highway" &&
        style.elementType === "geometry.fill" &&
        style.stylers.some((styler) => stylerColor(styler) === "#8f8f8f")
    )
  );
});

test("converte a cor dos nomes das cidades do tema exportado", () => {
  assert.ok(
    DRIVER_MAP_STYLES.some(
      (style) =>
        style.featureType === "administrative.locality" &&
        style.elementType === "labels.text.fill" &&
        style.stylers.some((styler) => stylerColor(styler) === "#fbd960")
    )
  );
});
