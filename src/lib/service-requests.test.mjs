// Estados e regras do quadro de serviços (service_requests). Corre com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SERVICE_STATUSES,
  SERVICE_STATUS_LABELS,
  serviceMoveBlockReason,
  eligibleProviders,
  candidateStatusLabel,
  candidateState,
  canChooseCandidate,
  validateRejectReason,
  validateChoicePrice,
  awaitingConfirmationNotice,
  serviceAddress,
  isDirectRequest,
  composeServiceDescription,
  validateServiceAddress,
} from "./service-requests.ts";

// Enum real do banco (20260410120001 + 20260814133242).
const DB_STATUSES = [
  "open",
  "under_review",
  "review_rejected",
  "searching_provider",
  "awaiting_client_confirmation",
  "awaiting_provider_confirmation",
  "assigned",
  "in_progress",
  "finished",
  "cancelled",
];

describe("estados do quadro de serviços", () => {
  test("o quadro cobre todos os estados do banco (nenhum pedido fica invisível)", () => {
    assert.deepEqual([...SERVICE_STATUSES].sort(), [...DB_STATUSES].sort());
  });

  test("cada estado tem rótulo em pt-AO, sem brasileirismos", () => {
    for (const s of DB_STATUSES) {
      const label = SERVICE_STATUS_LABELS[s];
      assert.ok(label && label.length > 0, `falta rótulo para ${s}`);
      assert.doesNotMatch(label, /andamento|aguardando|buscando/i);
    }
    assert.equal(SERVICE_STATUS_LABELS.in_progress, "Em curso");
    assert.equal(SERVICE_STATUS_LABELS.awaiting_client_confirmation, "A aguardar cliente");
    assert.equal(SERVICE_STATUS_LABELS.awaiting_provider_confirmation, "A aguardar prestador");
  });

  // O quadro só deixa arrastar para a coluna SEGUINTE (KanbanBoard.isNextColumn):
  // os passos que o admin dá à mão têm de ficar lado a lado.
  test("os passos manuais do admin ficam em colunas adjacentes", () => {
    const next = (a, b) => SERVICE_STATUSES.indexOf(b) === SERVICE_STATUSES.indexOf(a) + 1;
    assert.equal(SERVICE_STATUSES[0], "open");
    assert.ok(next("open", "under_review"), "open → under_review");
    assert.ok(next("under_review", "searching_provider"), "under_review → searching_provider");
    assert.ok(next("assigned", "in_progress"), "assigned → in_progress");
    assert.ok(next("in_progress", "finished"), "in_progress → finished");
    assert.ok(next("finished", "cancelled"), "finished → cancelled");
  });

  test("o estado lateral review_rejected não se mete entre passos do fluxo", () => {
    assert.equal(SERVICE_STATUSES.at(-1), "review_rejected");
  });
});

describe("serviceMoveBlockReason (arrastar no quadro)", () => {
  const noProvider = { provider_profile_id: null };
  const withProvider = { provider_profile_id: "a1403188-379a-4804-9672-3154a5cf4f21" };

  test("não deixa avançar para estados que exigem prestador sem prestador", () => {
    for (const to of [
      "awaiting_client_confirmation",
      "awaiting_provider_confirmation",
      "assigned",
      "in_progress",
      "finished",
    ]) {
      const reason = serviceMoveBlockReason(noProvider, to);
      assert.ok(reason, `${to} devia ser barrado`);
      assert.match(reason, /prestador/i);
    }
  });

  test("com prestador esses estados são permitidos", () => {
    for (const to of [
      "awaiting_client_confirmation",
      "awaiting_provider_confirmation",
      "assigned",
      "in_progress",
      "finished",
    ]) {
      assert.equal(serviceMoveBlockReason(withProvider, to), null);
    }
  });

  test("análise, procura e cancelamento não precisam de prestador", () => {
    for (const to of ["under_review", "review_rejected", "searching_provider", "cancelled", "open"]) {
      assert.equal(serviceMoveBlockReason(noProvider, to), null);
    }
  });
});

// ─── Fluxo do admin: análise, convites e escolha ─────────────

const PLUMBER = "cat-plumber";
const ELECTRICIAN = "cat-electrician";
const provider = (id, over = {}) => ({
  id,
  status: "approved",
  service_category_id: ELECTRICIAN,
  provider_category_services: [],
  ...over,
});

describe("eligibleProviders (quem pode ser convidado)", () => {
  test("só prestadores aprovados", () => {
    const list = [
      provider("a", { service_category_id: PLUMBER }),
      provider("b", { service_category_id: PLUMBER, status: "pending" }),
      provider("c", { service_category_id: PLUMBER, status: "rejected" }),
    ];
    assert.deepEqual(eligibleProviders(list, PLUMBER, []).map((p) => p.id), ["a"]);
  });

  test("cobre a categoria pela categoria principal ou pelas categorias extra", () => {
    const list = [
      provider("principal", { service_category_id: PLUMBER }),
      provider("extra", { provider_category_services: [{ service_category_id: PLUMBER }] }),
      provider("outra"),
    ];
    assert.deepEqual(
      eligibleProviders(list, PLUMBER, []).map((p) => p.id).sort(),
      ["extra", "principal"]
    );
  });

  test("não repete quem já foi convidado", () => {
    const list = [
      provider("a", { service_category_id: PLUMBER }),
      provider("b", { service_category_id: PLUMBER }),
    ];
    assert.deepEqual(eligibleProviders(list, PLUMBER, ["a"]).map((p) => p.id), ["b"]);
  });

  test("sem categoria no pedido (profissão livre) não filtra por categoria", () => {
    const list = [provider("a"), provider("b", { service_category_id: PLUMBER })];
    assert.deepEqual(eligibleProviders(list, null, []).map((p) => p.id), ["a", "b"]);
  });
});

describe("candidateStatusLabel (semântica real dos apps)", () => {
  test("convite sem resposta", () => {
    const c = { status: "pending", offered_price: null, admin_approved: false };
    assert.equal(candidateStatusLabel(c), "Convite enviado");
  });

  test("o app do Prestador propõe preço gravando status 'accepted' + offered_price: é só proposta", () => {
    const c = { status: "accepted", offered_price: 15000, admin_approved: false };
    assert.equal(candidateStatusLabel(c), "Proposta recebida");
  });

  test("escolhido é quem tem admin_approved (definido pela RPC select_service_request_provider)", () => {
    const c = { status: "accepted", offered_price: 15000, admin_approved: true };
    assert.equal(candidateStatusLabel(c), "Escolhido");
  });

  test("recusado, mesmo com admin_approved antigo ou preço", () => {
    assert.equal(
      candidateStatusLabel({ status: "rejected", offered_price: null, admin_approved: false }),
      "Recusado"
    );
    assert.equal(
      candidateStatusLabel({ status: "rejected", offered_price: 1500, admin_approved: false }),
      "Recusado"
    );
  });
});

describe("candidateState (para cores e lógica)", () => {
  test("invited | proposed | chosen | declined", () => {
    assert.equal(candidateState({ status: "pending", offered_price: null, admin_approved: false }), "invited");
    assert.equal(candidateState({ status: "accepted", offered_price: 1, admin_approved: false }), "proposed");
    assert.equal(candidateState({ status: "accepted", offered_price: 1, admin_approved: true }), "chosen");
    assert.equal(candidateState({ status: "rejected", offered_price: null, admin_approved: false }), "declined");
  });
});

describe("canChooseCandidate", () => {
  test("só enquanto o serviço procura prestador e o candidato não foi recusado", () => {
    assert.equal(canChooseCandidate({ status: "searching_provider" }, { status: "pending" }), true);
    assert.equal(canChooseCandidate({ status: "searching_provider" }, { status: "rejected" }), false);
    assert.equal(canChooseCandidate({ status: "under_review" }, { status: "pending" }), false);
    assert.equal(canChooseCandidate({ status: "assigned" }, { status: "accepted" }), false);
  });
});

describe("validações do admin", () => {
  test("motivo da rejeição precisa de pelo menos 3 caracteres úteis", () => {
    assert.match(validateRejectReason("  "), /motivo/i);
    assert.match(validateRejectReason("ab"), /motivo/i);
    assert.equal(validateRejectReason("Fora da zona"), null);
  });

  test("preço final tem de ser um valor acima de zero", () => {
    assert.match(validateChoicePrice(null), /pre[cç]o/i);
    assert.match(validateChoicePrice(0), /pre[cç]o/i);
    assert.equal(validateChoicePrice(15000), null);
  });
});

describe("awaitingConfirmationNotice (só leitura para o admin)", () => {
  test("diz quem tem de confirmar", () => {
    assert.equal(
      awaitingConfirmationNotice("awaiting_client_confirmation"),
      "A aguardar a confirmação do cliente"
    );
    assert.equal(
      awaitingConfirmationNotice("awaiting_provider_confirmation"),
      "A aguardar a confirmação do prestador"
    );
  });

  test("outros estados não têm aviso de espera", () => {
    for (const s of ["open", "under_review", "searching_provider", "assigned", "finished"]) {
      assert.equal(awaitingConfirmationNotice(s), null);
    }
  });
});

describe("serviceAddress (morada do serviço)", () => {
  test("com morada registada, usa-a e mantém observations como notas", () => {
    const r = {
      address_id: "a1",
      addresses: { formatted_address: "Rua Rainha Ginga, Ingombota, Luanda" },
      observations: "Tocar duas vezes",
    };
    assert.deepEqual(serviceAddress(r), {
      address: "Rua Rainha Ginga, Ingombota, Luanda",
      notes: "Tocar duas vezes",
    });
  });

  test("o app Cliente não grava address_id: a morada vem em observations", () => {
    const r = { address_id: null, addresses: null, observations: "Talatona, Luanda" };
    assert.deepEqual(serviceAddress(r), { address: "Talatona, Luanda", notes: null });
  });

  test("sem address_id e sem observations não há morada nem notas", () => {
    assert.deepEqual(serviceAddress({ address_id: null, observations: null }), {
      address: null,
      notes: null,
    });
    assert.deepEqual(serviceAddress({ address_id: null, observations: "   " }), {
      address: null,
      notes: null,
    });
  });

  test("morada registada mas vazia: observations continuam a ser notas, não morada", () => {
    const r = { address_id: "a1", addresses: { formatted_address: " " }, observations: "Nota" };
    assert.deepEqual(serviceAddress(r), { address: null, notes: "Nota" });
  });

  test("pedido criado pelo admin grava a morada nos dois sítios: não se repete como nota", () => {
    const r = {
      address_id: "a1",
      addresses: { formatted_address: "Talatona, Luanda" },
      observations: "  talatona, LUANDA ",
    };
    assert.deepEqual(serviceAddress(r), { address: "Talatona, Luanda", notes: null });
  });

  test("com morada registada, notas diferentes da morada mantêm-se como notas", () => {
    const r = {
      address_id: "a1",
      addresses: { formatted_address: "Talatona, Luanda" },
      observations: "Talatona, Luanda — portão azul",
    };
    assert.deepEqual(serviceAddress(r), {
      address: "Talatona, Luanda",
      notes: "Talatona, Luanda — portão azul",
    });
  });
});

describe("pedido criado pelo admin (convenção do app Cliente)", () => {
  test("juntar notas à descrição", () => {
    assert.equal(
      composeServiceDescription("Torneira a pingar", "Tocar duas vezes"),
      "Torneira a pingar — Notas: Tocar duas vezes"
    );
  });

  test("sem notas, fica só a descrição (aparada)", () => {
    assert.equal(composeServiceDescription("  Torneira a pingar  ", ""), "Torneira a pingar");
    assert.equal(composeServiceDescription("Torneira a pingar", "   "), "Torneira a pingar");
  });

  test("a morada é obrigatória", () => {
    assert.match(validateServiceAddress(""), /morada/i);
    assert.match(validateServiceAddress("   "), /morada/i);
    assert.equal(validateServiceAddress("Talatona, Luanda"), null);
  });
});

describe("isDirectRequest (pedido escolhido pelo cliente, sem passar pela análise)", () => {
  const direct = (over = {}) => ({
    status: "searching_provider",
    candidateCount: 1,
    history: [],
    ...over,
  });

  test("em procura, com um convite e sem análise do admin, é direto", () => {
    assert.equal(isDirectRequest(direct()), true);
  });

  test("o registo de criação em searching_provider não conta como análise", () => {
    assert.equal(
      isDirectRequest(direct({ history: [{ from_status: null, to_status: "searching_provider" }] })),
      true
    );
  });

  test("pedido que passou por under_review NÃO é direto, mesmo com um só convite", () => {
    assert.equal(
      isDirectRequest(
        direct({
          history: [
            { from_status: "open", to_status: "under_review" },
            { from_status: "under_review", to_status: "searching_provider" },
          ],
        })
      ),
      false
    );
  });

  test("se o admin convidar mais prestadores, continua a ser direto na origem", () => {
    assert.equal(isDirectRequest(direct({ candidateCount: 4 })), true);
  });

  test("sem convites não há escolha do cliente", () => {
    assert.equal(isDirectRequest(direct({ candidateCount: 0 })), false);
  });

  test("fora de searching_provider o aviso não se aplica", () => {
    for (const status of ["open", "under_review", "assigned", "in_progress", "finished", "cancelled"]) {
      assert.equal(isDirectRequest(direct({ status })), false, status);
    }
  });
});
