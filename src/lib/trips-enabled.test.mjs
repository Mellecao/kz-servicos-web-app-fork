// Interruptor system_settings.trips_enabled (viagens/caronas). Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TRIPS_ENABLED_KEY,
  TRIPS_REDIRECT_PATH,
  TRIPS_ONLY_PATHS,
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

describe("isTripsPath (páginas que só existem com as caronas ligadas)", () => {
  test("a lista de páginas só de caronas é viagens, mapa e motoristas", () => {
    assert.deepEqual([...TRIPS_ONLY_PATHS], ["/viagens", "/mapa", "/motoristas"]);
  });

  test("/viagens, /mapa, /motoristas e tudo por baixo deles", () => {
    for (const p of [
      "/viagens", "/viagens/", "/viagens/abc", "/viagens?x=1", "/viagens#topo",
      "/mapa", "/mapa/", "/mapa?driver=1",
      "/motoristas", "/motoristas/abc", "/motoristas#topo",
    ]) {
      assert.equal(isTripsPath(p), true, p);
    }
  });

  test("não apanha caminhos parecidos nem as páginas que ficam", () => {
    for (const p of [
      "/viagens-futuro", "/viagensx", "/mapa-futuro", "/mapax", "/motoristasx", "/motoristas-novos",
      "/outros-servicos", "/", "/dashboard", "/pedidos-produtos", "/produtos", "/clientes",
      "/prestadores", "/financeiro", "/logs", "/chats", "/usuarios", "/configuracoes", "",
    ]) {
      assert.equal(isTripsPath(p), false, JSON.stringify(p));
    }
  });
});

describe("tripsRedirectTarget", () => {
  test("com viagens desligadas, /viagens, /mapa e /motoristas (e subcaminhos) vão para os serviços", () => {
    for (const p of ["/viagens", "/viagens/abc", "/mapa", "/motoristas", "/motoristas/abc"]) {
      assert.equal(tripsRedirectTarget(p, false), "/outros-servicos", p);
    }
  });

  test("com viagens ligadas, nenhuma dessas páginas redireciona", () => {
    for (const p of ["/viagens", "/mapa", "/motoristas"]) {
      assert.equal(tripsRedirectTarget(p, true), null, p);
    }
  });

  test("as páginas que ficam nunca redirecionam, nem desligado", () => {
    for (const p of ["/prestadores", "/clientes", "/financeiro", "/logs", "/pedidos-produtos", "/configuracoes"]) {
      assert.equal(tripsRedirectTarget(p, false), null, p);
    }
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
    { href: "/mapa", label: "Mapa" },
    { href: "/chats", label: "Chats" },
    { href: "/outros-servicos", label: "Serviços" },
    { href: "/pedidos-produtos", label: "Entregas" },
    { href: "/clientes", label: "Clientes" },
    { href: "/motoristas", label: "Motoristas" },
    { href: "/prestadores", label: "Prestadores" },
    { href: "/financeiro", label: "Financeiro" },
    { href: "/logs", label: "Logs" },
    { href: "/configuracoes", label: "Definições" },
  ];

  test("desligado: tira Viagens, Mapa e Motoristas e mantém a ordem do resto", () => {
    assert.deepEqual(
      withoutTripsItems(items, false).map((i) => i.href),
      [
        "/dashboard", "/chats", "/outros-servicos", "/pedidos-produtos", "/clientes",
        "/prestadores", "/financeiro", "/logs", "/configuracoes",
      ]
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
