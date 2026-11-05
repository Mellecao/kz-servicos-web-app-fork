// Testes dos helpers de localização de Angola (Kz, datas em Africa/Luanda, telefone, BI/NIF).
// Corre com: npm test  (node --test, TypeScript executado nativamente pelo Node 24).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  APP_TIME_ZONE,
  formatKz,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatDateLong,
  formatMonthShort,
  formatPhoneAO,
  maskPhoneAO,
  isValidPhoneAO,
  normalizeDocumentAO,
  isValidDocumentAO,
  PHONE_ERROR,
  DOCUMENT_ERROR,
  phoneError,
  phoneToSave,
  toE164AO,
  phoneMatches,
  documentError,
  documentToSave,
} from "./format.ts";

describe("formatKz", () => {
  test("formato 1.500,00 Kz (milhar ponto, decimal vírgula, sufixo Kz)", () => {
    assert.equal(formatKz(1500), "1.500,00 Kz");
    assert.equal(formatKz(1234567.5), "1.234.567,50 Kz");
    assert.equal(formatKz(100), "100,00 Kz");
    assert.equal(formatKz(1000), "1.000,00 Kz");
    assert.equal(formatKz(0), "0,00 Kz");
  });

  test("sem casas decimais quando pedido", () => {
    assert.equal(formatKz(2500, { decimals: 0 }), "2.500 Kz");
    assert.equal(formatKz(1000, { decimals: 0 }), "1.000 Kz");
  });

  test("negativos mantêm o sinal e -0,001 não vira -0,00", () => {
    assert.equal(formatKz(-1500), "-1.500,00 Kz");
    assert.equal(formatKz(-0.001), "0,00 Kz");
  });

  test("arredondamento que transborda para a classe seguinte", () => {
    assert.equal(formatKz(999.999), "1.000,00 Kz");
  });

  test("nulo, indefinido, NaN e infinito mostram traço (nunca 'NaN Kz')", () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      assert.equal(formatKz(v), "—");
    }
  });

  test("nunca contém R$", () => {
    assert.ok(!formatKz(10).includes("R$"));
  });
});

describe("datas em Africa/Luanda (UTC+1, 24 h, dd/MM/yyyy)", () => {
  test("fuso por omissão é Africa/Luanda", () => {
    assert.equal(APP_TIME_ZONE, "Africa/Luanda");
  });

  test("formatDate", () => {
    assert.equal(formatDate("2026-11-05T12:00:00Z"), "05/11/2026");
  });

  test("formatDate vira o dia ao passar de UTC para Luanda", () => {
    assert.equal(formatDate("2026-11-05T23:30:00Z"), "06/11/2026");
  });

  test("formatDate aceita data sem hora (YYYY-MM-DD) e objeto Date", () => {
    assert.equal(formatDate("2026-11-05"), "05/11/2026");
    assert.equal(formatDate(new Date(Date.UTC(2026, 10, 5, 12))), "05/11/2026");
  });

  test("formatDateTime em 24 h", () => {
    assert.equal(formatDateTime("2026-11-05T12:00:00Z"), "05/11/2026 13:00");
    assert.equal(formatDateTime("2026-11-05T23:30:00Z"), "06/11/2026 00:30");
  });

  test("formatDateTime com segundos (logs)", () => {
    assert.equal(
      formatDateTime("2026-11-05T12:00:09Z", { seconds: true }),
      "05/11/2026 13:00:09"
    );
  });

  test("formatDayMonth", () => {
    assert.equal(formatDayMonth("2026-11-05T12:00:00Z"), "05/11");
  });

  test("valores inválidos ou nulos mostram traço", () => {
    for (const v of [null, undefined, "", "não é data"]) {
      assert.equal(formatDate(v), "—");
      assert.equal(formatDateTime(v), "—");
      assert.equal(formatDayMonth(v), "—");
    }
  });

  test("formatDateLong inclui dia da semana, mês por extenso e ano", () => {
    const s = formatDateLong("2026-11-05T12:00:00Z");
    assert.match(s, /novembro/i);
    assert.match(s, /2026/);
    assert.match(s, /quinta/i);
  });

  test("formatMonthShort devolve mês curto sem ponto", () => {
    assert.equal(formatMonthShort(new Date(2026, 10, 1)), "nov");
  });
});

describe("telefone de Angola (+244 9XX XXX XXX)", () => {
  test("formatPhoneAO normaliza móvel em várias entradas", () => {
    for (const raw of [
      "923456789",
      "+244923456789",
      "00244 923-456-789",
      "+244 923 456 789",
      "(923) 456 789",
    ]) {
      assert.equal(formatPhoneAO(raw), "+244 923 456 789", raw);
    }
  });

  test("formatPhoneAO aceita fixo de Luanda (começa por 2)", () => {
    assert.equal(formatPhoneAO("222123456"), "+244 222 123 456");
  });

  test("formatPhoneAO não deforma número legado de outro país", () => {
    assert.equal(formatPhoneAO("+5511987654321"), "+5511987654321");
    assert.equal(formatPhoneAO("(11) 98765-4321"), "(11) 98765-4321");
  });

  test("formatPhoneAO nulo ou vazio mostra traço", () => {
    assert.equal(formatPhoneAO(null), "—");
    assert.equal(formatPhoneAO(undefined), "—");
    assert.equal(formatPhoneAO("  "), "—");
  });

  test("isValidPhoneAO: 9 dígitos começados por 9 (móvel) ou 2 (fixo)", () => {
    for (const ok of ["923456789", "+244 923 456 789", "222123456", "00244923456789"]) {
      assert.equal(isValidPhoneAO(ok), true, ok);
    }
    for (const bad of ["123456789", "92345678", "9234567890", "+55 11 98765-4321", "", "abc"]) {
      assert.equal(isValidPhoneAO(bad), false, bad);
    }
  });

  test("maskPhoneAO aplica a máscara enquanto se escreve", () => {
    assert.equal(maskPhoneAO(""), "");
    assert.equal(maskPhoneAO("abc"), "");
    assert.equal(maskPhoneAO("9"), "+244 9");
    assert.equal(maskPhoneAO("92345"), "+244 923 45");
    assert.equal(maskPhoneAO("923456789"), "+244 923 456 789");
    assert.equal(maskPhoneAO("+244 9"), "+244 9");
    assert.equal(maskPhoneAO("+244 923 456 789"), "+244 923 456 789");
  });

  test("maskPhoneAO limita a 9 dígitos nacionais", () => {
    assert.equal(maskPhoneAO("9234567891234"), "+244 923 456 789");
  });
});

describe("documento BI / NIF (alfanumérico 9–14, permissivo)", () => {
  test("normalizeDocumentAO tira separadores e põe maiúsculas", () => {
    assert.equal(normalizeDocumentAO("004.567-890 la042"), "004567890LA042");
  });

  test("isValidDocumentAO aceita 9 a 14 caracteres alfanuméricos", () => {
    for (const ok of ["004567890LA042", "0054321098", "123 456 789", "123456789"]) {
      assert.equal(isValidDocumentAO(ok), true, ok);
    }
  });

  test("isValidDocumentAO rejeita curto, longo e símbolos", () => {
    for (const bad of ["12345678", "123456789012345", "12345678$", "", "   "]) {
      assert.equal(isValidDocumentAO(bad), false, bad);
    }
  });
});

describe("campos de formulário: só valida e normaliza o que foi editado", () => {
  const LEGACY_PHONE = "+55 11 98765-4321";
  const LEGACY_CPF = "123.456.789-00";

  test("phoneError: vazio e válido não dão erro", () => {
    assert.equal(phoneError("", ""), null);
    assert.equal(phoneError("  ", null), null);
    assert.equal(phoneError("+244 923 456 789", ""), null);
  });

  test("phoneError: número novo inválido dá a mensagem", () => {
    assert.equal(phoneError("123", ""), PHONE_ERROR);
    assert.equal(phoneError("+55 11 98765-4321", ""), PHONE_ERROR);
  });

  test("phoneError: valor legado NÃO editado não bloqueia a gravação de outros campos", () => {
    assert.equal(phoneError(LEGACY_PHONE, LEGACY_PHONE), null);
  });

  test("phoneToSave: novo válido guarda em E.164 sem espaços (+244923456789)", () => {
    assert.equal(phoneToSave("923456789", null), "+244923456789");
    assert.equal(phoneToSave("00244923456789", ""), "+244923456789");
    assert.equal(phoneToSave("+244 923 456 789", ""), "+244923456789");
    assert.equal(phoneToSave("222 123 456", null), "+244222123456");
  });

  test("phoneToSave: o valor mascarado de um E.164 já guardado volta ao mesmo E.164", () => {
    assert.equal(phoneToSave(formatPhoneAO("+244923456789"), "+244923456789"), "+244923456789");
  });

  test("phoneToSave: vazio dá null e legado intocado mantém-se tal como estava", () => {
    assert.equal(phoneToSave("", "+244 923 456 789"), null);
    assert.equal(phoneToSave(LEGACY_PHONE, LEGACY_PHONE), LEGACY_PHONE);
  });

  test("documentError: vazio e válido não dão erro; curto dá a mensagem", () => {
    assert.equal(documentError("", ""), null);
    assert.equal(documentError("004567890LA042", ""), null);
    assert.equal(documentError("12345678", ""), DOCUMENT_ERROR);
  });

  test("documentError: valor legado não editado não bloqueia", () => {
    assert.equal(documentError("12345678", "12345678"), null);
  });

  test("documentToSave: novo normaliza; vazio dá null; legado intocado mantém-se", () => {
    assert.equal(documentToSave("004.567-890 la042", null), "004567890LA042");
    assert.equal(documentToSave("  ", "x"), null);
    assert.equal(documentToSave(LEGACY_CPF, LEGACY_CPF), LEGACY_CPF);
  });
});

describe("toE164AO", () => {
  test("devolve +244 + 9 dígitos para número válido, em qualquer formato de entrada", () => {
    for (const raw of ["923456789", "+244 923 456 789", "00244-923-456-789", "(923) 456 789"]) {
      assert.equal(toE164AO(raw), "+244923456789", raw);
    }
  });

  test("null para número inválido ou de outro país", () => {
    for (const raw of ["", "123", "+55 11 98765-4321", "9234567890"]) {
      assert.equal(toE164AO(raw), null, raw);
    }
  });
});

describe("phoneMatches (pesquisa só por dígitos)", () => {
  test("encontra por dígitos soltos ou agrupados, ignorando espaços e +", () => {
    assert.equal(phoneMatches("+244923456789", "923456789"), true);
    assert.equal(phoneMatches("+244923456789", "923 456"), true);
    assert.equal(phoneMatches("+244923456789", "+244 92"), true);
    assert.equal(phoneMatches("+244923456789", "456789"), true);
  });

  test("não encontra dígitos que não existem", () => {
    assert.equal(phoneMatches("+244923456789", "999"), false);
  });

  test("valor legado também é pesquisável por dígitos", () => {
    assert.equal(phoneMatches("+55 11 98765-4321", "98765"), true);
  });

  test("pesquisa sem dígitos ou telefone vazio nunca corresponde (não esconde nada por engano)", () => {
    assert.equal(phoneMatches("+244923456789", "abc"), false);
    assert.equal(phoneMatches("+244923456789", ""), false);
    assert.equal(phoneMatches(null, "9"), false);
    assert.equal(phoneMatches(undefined, "9"), false);
  });
});
