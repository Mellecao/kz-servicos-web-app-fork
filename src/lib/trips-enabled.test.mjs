// Interruptor system_settings.trips_enabled (viagens/caronas). Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TRIPS_ENABLED_KEY,
  TRIPS_REDIRECT_PATH,
  parseTripsEnabled,
  isTripsPath,
  tripsRedirectTarget,
  withoutTripsItems,
} from "./trips-enabled.ts";

describe("parseTripsEnabled (jsonb → boolean, à prova de falha)", () => {
  test("só true (e o texto 'true') ligam as viagens", () => {
    assert.equal(parseTripsEnabled(true), true);
    assert.equal(parseTripsEnabled("true"), true);
    assert.equal(parseTripsEnabled(" TRUE "), true);
  });

  test("false, ausente ou valor estranho ficam DESLIGADOS (nunca liga por engano)", () => {
    for (const v of [false, "false", null, undefined, 1, 0, "1", "sim", "", {}, [], [true], NaN]) {
      assert.equal(parseTripsEnabled(v), false, JSON.stringify(v));
    }
  });

  test("chave e destino do redirecionamento", () => {
    assert.equal(TRIPS_ENABLED_KEY, "trips_enabled");
    assert.equal(TRIPS_REDIRECT_PATH, "/outros-servicos");
  });
});

describe("isTripsPath", () => {
  test("/viagens e tudo por baixo dela", () => {
    for (const p of ["/viagens", "/viagens/", "/viagens/abc", "/viagens?x=1", "/viagens#topo"]) {
      assert.equal(isTripsPath(p), true, p);
    }
  });

  test("não apanha caminhos parecidos nem outras páginas", () => {
    for (const p of ["/viagens-futuro", "/viagensx", "/outros-servicos", "/", "/dashboard", "/pedidos-produtos", ""]) {
      assert.equal(isTripsPath(p), false, JSON.stringify(p));
    }
  });
});

describe("tripsRedirectTarget", () => {
  test("com viagens desligadas, /viagens (e subcaminhos) vão para os serviços", () => {
    assert.equal(tripsRedirectTarget("/viagens", false), "/outros-servicos");
    assert.equal(tripsRedirectTarget("/viagens/abc", false), "/outros-servicos");
  });

  test("com viagens ligadas, ou noutra página, não redireciona", () => {
    assert.equal(tripsRedirectTarget("/viagens", true), null);
    assert.equal(tripsRedirectTarget("/outros-servicos", false), null);
    assert.equal(tripsRedirectTarget("/dashboard", false), null);
    assert.equal(tripsRedirectTarget("/viagens-futuro", false), null);
  });
});

describe("withoutTripsItems (menu)", () => {
  const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/viagens", label: "Viagens" },
    { href: "/outros-servicos", label: "Serviços" },
    { href: "/pedidos-produtos", label: "Entregas" },
  ];

  test("desligado: tira só a entrada de viagens, mantém a ordem do resto", () => {
    assert.deepEqual(
      withoutTripsItems(items, false).map((i) => i.href),
      ["/dashboard", "/outros-servicos", "/pedidos-produtos"]
    );
  });

  test("ligado: devolve o menu completo, sem alterar nada", () => {
    assert.deepEqual(withoutTripsItems(items, true), items);
  });

  test("não muta a lista original", () => {
    const copy = items.map((i) => ({ ...i }));
    withoutTripsItems(items, false);
    assert.deepEqual(items, copy);
  });
});
