import assert from "node:assert/strict";
import test from "node:test";
import { parseActiveDriverRow } from "./driver-locations.ts";

test("parseActiveDriverRow normaliza row completo", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: -23.55,
    longitude: -46.63,
    heading: 90,
    trip_id: "trip-abc",
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "João Silva", avatar_url: "https://x.io/a.jpg" },
      },
      vehicles: [
        {
          brand: "Fiat",
          model: "Uno",
          color: "Prata",
          license_plate: "ABC1D23",
          is_active: true,
          updated_at: "2026-07-01T00:00:00Z",
        },
      ],
    },
  };
  assert.deepEqual(parseActiveDriverRow(row), {
    driverProfileId: "d1",
    fullName: "João Silva",
    avatarUrl: "https://x.io/a.jpg",
    latitude: -23.55,
    longitude: -46.63,
    heading: 90,
    updatedAt: "2026-07-29T12:00:00Z",
    tripId: "trip-abc",
    vehicle: { brand: "Fiat", model: "Uno", color: "Prata", licensePlate: "ABC1D23" },
  });
});

test("parseActiveDriverRow tolera avatar_url null", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: -23.55,
    longitude: -46.63,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "Maria", avatar_url: null },
      },
      vehicles: [
        { brand: "VW", model: "Gol", color: "Branco", license_plate: "XYZ2E34", is_active: true, updated_at: "2026-01-01T00:00:00Z" },
      ],
    },
  };
  const out = parseActiveDriverRow(row);
  assert.equal(out?.avatarUrl, null);
  assert.equal(out?.tripId, null);
  assert.equal(out?.heading, null);
});

test("parseActiveDriverRow retorna vehicle=null quando não há vehicles ativos", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: -23.55,
    longitude: -46.63,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "Ana", avatar_url: null },
      },
      vehicles: [],
    },
  };
  assert.equal(parseActiveDriverRow(row)?.vehicle, null);
});

test("parseActiveDriverRow escolhe o vehicle is_active=true mais recente", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "approved",
        users: { full_name: "N", avatar_url: null },
      },
      vehicles: [
        { brand: "A", model: "1", color: "-", license_plate: "AAA1A11", is_active: false, updated_at: "2026-06-01T00:00:00Z" },
        { brand: "B", model: "2", color: "-", license_plate: "BBB2B22", is_active: true, updated_at: "2026-03-01T00:00:00Z" },
        { brand: "C", model: "3", color: "-", license_plate: "CCC3C33", is_active: true, updated_at: "2026-05-01T00:00:00Z" },
      ],
    },
  };
  assert.equal(parseActiveDriverRow(row)?.vehicle?.brand, "C");
});

test("parseActiveDriverRow retorna null se provider_profiles.status != 'approved' (defesa em profundidade)", () => {
  const row = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: {
      provider_profiles: {
        status: "pending",
        users: { full_name: "X", avatar_url: null },
      },
      vehicles: [],
    },
  };
  assert.equal(parseActiveDriverRow(row), null);
});

test("parseActiveDriverRow retorna null se dados essenciais faltarem", () => {
  const rowSemUser = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: { provider_profiles: { status: "approved", users: null }, vehicles: [] },
  };
  assert.equal(parseActiveDriverRow(rowSemUser), null);

  const rowSemProvider = {
    driver_profile_id: "d1",
    latitude: 0,
    longitude: 0,
    heading: null,
    trip_id: null,
    updated_at: "2026-07-29T12:00:00Z",
    driver_profiles: { provider_profiles: null, vehicles: [] },
  };
  assert.equal(parseActiveDriverRow(rowSemProvider), null);
});
