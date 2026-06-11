import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AddressInput =
  | string
  | {
      formatted_address?: unknown;
      google_place_id?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      street?: unknown;
      number?: unknown;
      neighborhood?: unknown;
      city?: unknown;
      state?: unknown;
      zip_code?: unknown;
    };

export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const body = await request.json();

    const {
      client_id,
      service_category_id,
      pickup_address,
      dropoff_address,
      scheduled_datetime,
      is_round_trip,
      return_datetime,
      passenger_count,
      children_count,
      luggage_count,
      observations,
      payment_method,
    } = body;

    const pickupAddress = normalizeAddressInput(pickup_address);
    const dropoffAddress = normalizeAddressInput(dropoff_address);

    if (!client_id || !pickupAddress || !dropoffAddress || !scheduled_datetime) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes" },
        { status: 400 }
      );
    }

    const [pickupResult, dropoffResult] = await Promise.all([
      admin.from("addresses").insert(pickupAddress).select().single(),
      admin.from("addresses").insert(dropoffAddress).select().single(),
    ]);

    if (pickupResult.error) {
      return NextResponse.json({ error: pickupResult.error.message }, { status: 400 });
    }
    if (dropoffResult.error) {
      return NextResponse.json({ error: dropoffResult.error.message }, { status: 400 });
    }

    const { data, error } = await admin
      .from("trips")
      .insert({
        client_id,
        service_category_id: service_category_id || null,
        pickup_address_id: pickupResult.data.id,
        dropoff_address_id: dropoffResult.data.id,
        scheduled_datetime,
        is_round_trip: is_round_trip ?? false,
        return_datetime: return_datetime ?? null,
        passenger_count,
        children_count: children_count ?? 0,
        luggage_count: luggage_count ?? 0,
        observations: observations ?? null,
        payment_method: payment_method ?? null,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

function normalizeAddressInput(input: AddressInput | undefined) {
  if (typeof input === "string") {
    const formattedAddress = input.trim();
    return formattedAddress ? { formatted_address: formattedAddress } : null;
  }

  if (!input || typeof input !== "object") return null;

  const formattedAddress = asOptionalString(input.formatted_address);
  if (!formattedAddress) return null;

  return {
    formatted_address: formattedAddress,
    google_place_id: asOptionalString(input.google_place_id),
    latitude: asOptionalNumber(input.latitude),
    longitude: asOptionalNumber(input.longitude),
    street: asOptionalString(input.street),
    number: asOptionalString(input.number),
    neighborhood: asOptionalString(input.neighborhood),
    city: asOptionalString(input.city),
    state: asOptionalString(input.state),
    zip_code: asOptionalString(input.zip_code),
  };
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
