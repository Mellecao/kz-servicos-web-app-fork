import assert from "node:assert/strict";
import test from "node:test";
import { filterTripsBySearch } from "./trip-search.ts";

const trip = {
  id: "trip-1",
  status: "searching_drivers" as const,
  scheduled_datetime: "2026-07-01T12:00:00.000Z",
  pickup_address: { formatted_address: "Rua Origem, 123" },
  dropoff_address: { formatted_address: "Avenida Paulista, 1000" },
  users: { full_name: "Cliente Maria", email: "maria@example.com" },
  driver_profiles: null,
};

test("filters trips by destination text", () => {
  assert.deepEqual(filterTripsBySearch([trip], "paulista").map((t) => t.id), [
    "trip-1",
  ]);
});

test("filters trips by candidate driver name", () => {
  const result = filterTripsBySearch([trip], "joao motorista", {
    "trip-1": [
      {
        id: "candidate-1",
        trip_id: "trip-1",
        driver_profile_id: "driver-1",
        status: "pending",
        offered_price: null,
        admin_approved: false,
        invited_at: "2026-07-01T10:00:00.000Z",
        responded_at: null,
        observations: null,
        created_at: "2026-07-01T10:00:00.000Z",
        driver_profiles: {
          id: "driver-1",
          provider_profile_id: "provider-1",
          cnh_category: null,
          cnh_expiration_date: null,
          cnh_number: null,
          is_available: true,
          created_at: "2026-07-01T10:00:00.000Z",
          updated_at: "2026-07-01T10:00:00.000Z",
          provider_profiles: {
            id: "provider-1",
            user_id: "user-driver",
            service_category_id: "category-1",
            status: "approved",
            rg_document_url: null,
            cnh_document_url: null,
            proof_of_address_url: null,
            has_card_machine: false,
            has_tap_payment: false,
            issues_invoice: false,
            issues_receipt: false,
            bank_name: null,
            bank_agency: null,
            bank_account: null,
            bank_account_type: null,
            bank_pix_key: null,
            average_rating: 0,
            total_ratings: 0,
            bio: null,
            created_at: "2026-07-01T10:00:00.000Z",
            updated_at: "2026-07-01T10:00:00.000Z",
            users: {
              id: "user-driver",
              role: "provider",
              full_name: "Joao Motorista",
              email: "joao@example.com",
              phone: null,
              cpf: null,
              avatar_url: null,
              date_of_birth: null,
              is_active: true,
              auth_provider: null,
              created_at: "2026-07-01T10:00:00.000Z",
              updated_at: "2026-07-01T10:00:00.000Z",
              deleted_at: null,
            },
          },
        },
      },
    ],
  });

  assert.deepEqual(result.map((t) => t.id), ["trip-1"]);
});

test("returns all trips when query is empty", () => {
  assert.deepEqual(filterTripsBySearch([trip], "   ").map((t) => t.id), [
    "trip-1",
  ]);
});
