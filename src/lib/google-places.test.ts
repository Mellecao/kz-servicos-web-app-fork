import assert from "node:assert/strict";
import test from "node:test";
import {
  preserveStreetNumberFromLabel,
  type GooglePlaceAddress,
} from "./google-places.ts";

const detailsWithoutNumber: GooglePlaceAddress = {
  formatted_address: "R. Augusta - Piedade, Capelinha - MG, 39680-000, Brazil",
  google_place_id: "place-1",
  street: "Rua Augusta",
  number: null,
  neighborhood: "Piedade",
  city: "Capelinha",
  state: "MG",
  zip_code: "39680-000",
};

test("preserva o número da casa quando o details volta sem street_number", () => {
  const label = "Rua Augusta, 1500 - Piedade, Capelinha - MG, Brasil";
  const result = preserveStreetNumberFromLabel(detailsWithoutNumber, label);

  assert.equal(result.number, "1500");
  assert.equal(result.formatted_address, label);
  assert.equal(result.zip_code, "39680-000");
});

test("mantém o details intacto quando ele já tem street_number", () => {
  const details: GooglePlaceAddress = {
    ...detailsWithoutNumber,
    number: "1500",
    formatted_address: "R. Augusta, 1500 - Consolação, São Paulo - SP, Brazil",
  };
  const label = "Rua Augusta, 1500 - Consolação, São Paulo - SP, Brasil";
  const result = preserveStreetNumberFromLabel(details, label);

  assert.deepEqual(result, details);
});

test("não altera nada quando o label não tem número (cidade/estabelecimento)", () => {
  const label = "Capelinha - MG, Brasil";
  const result = preserveStreetNumberFromLabel(detailsWithoutNumber, label);

  assert.deepEqual(result, detailsWithoutNumber);
});

test("extrai o número mesmo quando o nome da rua contém dígitos", () => {
  const label = "Avenida 15 de Novembro, 200 - Centro, Curitiba - PR, Brasil";
  const result = preserveStreetNumberFromLabel(detailsWithoutNumber, label);

  assert.equal(result.number, "200");
  assert.equal(result.formatted_address, label);
});

test("aceita número com complemento de letra", () => {
  const label = "Rua Augusta, 123B - Piedade, Capelinha - MG, Brasil";
  const result = preserveStreetNumberFromLabel(detailsWithoutNumber, label);

  assert.equal(result.number, "123B");
});
