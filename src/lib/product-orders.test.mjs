// Lógica pura dos pedidos de produtos e do catálogo. Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  NEXT_ACTION_LABELS,
  nextStatus,
  isAllowedMove,
  canCancel,
  shortOrderCode,
  summarizeItems,
  mapsUrl,
  parseKzInput,
  validateCancelReason,
  validateProductInput,
  parseDeliveryFee,
} from "./product-orders.ts";

describe("estados do pedido", () => {
  test("ordem do fluxo e rótulos em pt-AO", () => {
    assert.deepEqual(ORDER_STATUSES, ["pending", "confirmed", "out_for_delivery", "delivered", "cancelled"]);
    assert.equal(ORDER_STATUS_LABELS.pending, "Pendente");
    assert.equal(ORDER_STATUS_LABELS.confirmed, "Confirmado");
    assert.equal(ORDER_STATUS_LABELS.out_for_delivery, "A caminho");
    assert.equal(ORDER_STATUS_LABELS.delivered, "Entregue");
    assert.equal(ORDER_STATUS_LABELS.cancelled, "Cancelado");
  });

  test("nextStatus percorre pending → confirmed → out_for_delivery → delivered", () => {
    assert.equal(nextStatus("pending"), "confirmed");
    assert.equal(nextStatus("confirmed"), "out_for_delivery");
    assert.equal(nextStatus("out_for_delivery"), "delivered");
  });

  test("entregue e cancelado não têm estado seguinte", () => {
    assert.equal(nextStatus("delivered"), null);
    assert.equal(nextStatus("cancelled"), null);
  });

  test("cada estado com seguinte tem rótulo de ação", () => {
    assert.equal(NEXT_ACTION_LABELS.pending, "Confirmar pedido");
    assert.equal(NEXT_ACTION_LABELS.confirmed, "Enviar para entrega");
    assert.equal(NEXT_ACTION_LABELS.out_for_delivery, "Marcar como entregue");
    assert.equal(NEXT_ACTION_LABELS.delivered, undefined);
  });

  test("isAllowedMove só aceita o estado seguinte (arrastar entregue→cancelado é recusado)", () => {
    assert.equal(isAllowedMove("pending", "confirmed"), true);
    assert.equal(isAllowedMove("out_for_delivery", "delivered"), true);
    assert.equal(isAllowedMove("pending", "out_for_delivery"), false);
    assert.equal(isAllowedMove("confirmed", "pending"), false);
    assert.equal(isAllowedMove("delivered", "cancelled"), false);
    assert.equal(isAllowedMove("pending", "cancelled"), false);
  });

  test("canCancel: só enquanto não for entregue nem já cancelado", () => {
    assert.equal(canCancel("pending"), true);
    assert.equal(canCancel("confirmed"), true);
    assert.equal(canCancel("out_for_delivery"), true);
    assert.equal(canCancel("delivered"), false);
    assert.equal(canCancel("cancelled"), false);
  });
});

describe("apresentação do pedido", () => {
  test("shortOrderCode: # + 6 primeiros caracteres do uuid em maiúsculas", () => {
    assert.equal(shortOrderCode("e11769df-1ae1-436a-96a2-03812f8346cf"), "#E11769");
  });

  test("summarizeItems: 1 e 2 itens completos, acima do limite mostra +N", () => {
    const items = [
      { product_name: "Água 20 L", quantity: 2 },
      { product_name: "Botija de gás 12 kg", quantity: 1 },
      { product_name: "Gelo em cubos", quantity: 3 },
    ];
    assert.equal(summarizeItems(items.slice(0, 1)), "2× Água 20 L");
    assert.equal(summarizeItems(items.slice(0, 2)), "2× Água 20 L, 1× Botija de gás 12 kg");
    assert.equal(summarizeItems(items), "2× Água 20 L, 1× Botija de gás 12 kg +1");
  });

  test("summarizeItems: sem itens (ou indefinido) não rebenta", () => {
    assert.equal(summarizeItems([]), "—");
    assert.equal(summarizeItems(undefined), "—");
  });

  test("mapsUrl: com coordenadas usa lat,lng", () => {
    assert.equal(
      mapsUrl({ delivery_address: "Talatona", delivery_lat: -8.9205, delivery_lng: 13.1912 }),
      "https://www.google.com/maps/search/?api=1&query=-8.9205,13.1912"
    );
  });

  test("mapsUrl: sem coordenadas pesquisa pela morada, com acentos e vírgulas codificados", () => {
    const url = mapsUrl({ delivery_address: "Rua Rainha Ginga, Ingombota, São Paulo", delivery_lat: null, delivery_lng: null });
    assert.equal(
      url,
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Rua Rainha Ginga, Ingombota, São Paulo")
    );
    assert.ok(!url.includes(" "));
  });

  test("mapsUrl: só uma coordenada preenchida cai para a morada", () => {
    const url = mapsUrl({ delivery_address: "Viana", delivery_lat: -8.9, delivery_lng: null });
    assert.match(url, /query=Viana$/);
  });
});

describe("parseKzInput (preço escrito pelo admin)", () => {
  test("formatos de Angola e simples", () => {
    assert.equal(parseKzInput("1500"), 1500);
    assert.equal(parseKzInput("1500,50"), 1500.5);
    assert.equal(parseKzInput("1.500,50"), 1500.5);
    assert.equal(parseKzInput("35.000"), 35000);
    assert.equal(parseKzInput("1 500"), 1500);
    assert.equal(parseKzInput("2500 Kz"), 2500);
    assert.equal(parseKzInput("0"), 0);
  });

  test("ponto decimal com 1 ou 2 casas é decimal (1500.5, 1500.50)", () => {
    assert.equal(parseKzInput("1500.5"), 1500.5);
    assert.equal(parseKzInput("1500.50"), 1500.5);
  });

  test("vazio, texto, negativo e vários separadores decimais dão null", () => {
    for (const raw of ["", "  ", "abc", "-5", "1,2,3", "Kz"]) {
      assert.equal(parseKzInput(raw), null, JSON.stringify(raw));
    }
  });
});

describe("validações de formulário", () => {
  test("validateCancelReason: obrigatório, mínimo 3 caracteres úteis", () => {
    assert.equal(typeof validateCancelReason(""), "string");
    assert.equal(typeof validateCancelReason("   "), "string");
    assert.equal(typeof validateCancelReason("ab"), "string");
    assert.equal(validateCancelReason("Sem stock"), null);
    assert.equal(validateCancelReason("  Sem stock  "), null);
  });

  const ok = { name: "Água 20 L", description: "Garrafão", unitLabel: "garrafão", price: "1.200,00", sortOrder: "40" };

  test("validateProductInput: entrada válida devolve valores prontos para gravar", () => {
    assert.deepEqual(validateProductInput(ok), {
      ok: true,
      value: { name: "Água 20 L", description: "Garrafão", unit_label: "garrafão", price: 1200, sort_order: 40 },
    });
  });

  test("validateProductInput: descrição vazia grava null; espaços são aparados", () => {
    const r = validateProductInput({ ...ok, name: "  Água 20 L ", description: "   " });
    assert.equal(r.ok, true);
    assert.equal(r.value.name, "Água 20 L");
    assert.equal(r.value.description, null);
  });

  test("validateProductInput: nome vazio, unidade vazia, preço inválido/negativo e ordem não inteira são recusados", () => {
    for (const bad of [
      { ...ok, name: "  " },
      { ...ok, unitLabel: "" },
      { ...ok, price: "" },
      { ...ok, price: "-10" },
      { ...ok, price: "abc" },
      { ...ok, sortOrder: "1,5" },
      { ...ok, sortOrder: "abc" },
      { ...ok, sortOrder: "" },
    ]) {
      const r = validateProductInput(bad);
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.equal(typeof r.error, "string");
    }
  });

  test("validateProductInput: arredonda o preço a 2 casas e recusa acima do limite da coluna numeric(12,2)", () => {
    assert.equal(validateProductInput({ ...ok, price: "10,999" }).value.price, 11);
    assert.equal(validateProductInput({ ...ok, price: "10000000000" }).ok, false);
  });
});

describe("taxa de entrega (system_settings.product_delivery_fee, jsonb)", () => {
  test("aceita número e texto numérico, como o RPC (value #>> '{}')::numeric", () => {
    assert.equal(parseDeliveryFee(1000), 1000);
    assert.equal(parseDeliveryFee("1000"), 1000);
    assert.equal(parseDeliveryFee(1500.5), 1500.5);
    assert.equal(parseDeliveryFee(0), 0);
  });

  test("valor ausente ou inválido dá null (a UI mostra traço, não 0)", () => {
    for (const v of [null, undefined, "", "abc", NaN, -1, {}, []]) {
      assert.equal(parseDeliveryFee(v), null, JSON.stringify(v));
    }
  });
});
