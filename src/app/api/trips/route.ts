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
      stops,
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
    const normalizedStops = Array.isArray(stops)
      ? stops.reduce<NonNullable<ReturnType<typeof normalizeAddressInput>>[]>(
          (acc, stop) => {
            const normalizedStop = normalizeAddressInput(stop);
            if (normalizedStop) acc.push(normalizedStop);
            return acc;
          },
          []
        )
      : [];

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

    // Create stop addresses before the trip so a failure here leaves no orphan trip
    const stopAddressIds: string[] = [];
    for (const stopAddress of normalizedStops) {
      const { data: addressData, error: addressError } = await admin
        .from("addresses")
        .insert(stopAddress)
        .select("id")
        .single();
      if (addressError) {
        return NextResponse.json({ error: addressError.message }, { status: 400 });
      }
      stopAddressIds.push(addressData.id);
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

    if (stopAddressIds.length > 0) {
      const stopRows = stopAddressIds.map((addressId, index) => ({
        trip_id: data.id,
        address_id: addressId,
        stop_order: index + 1,
      }));

      const { error: stopsError } = await admin.from("trip_stops").insert(stopRows);
      if (stopsError) {
        // Rollback: remove the trip so the user doesn't see a half-created record
        await admin.from("trips").delete().eq("id", data.id);
        return NextResponse.json({ error: stopsError.message }, { status: 400 });
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: userData, error: userError } = await admin
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (userError || userData?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const tripId = request.nextUrl.searchParams.get("id")?.trim();
    if (!tripId) {
      return NextResponse.json({ error: "ID da viagem é obrigatório" }, { status: 400 });
    }

    const { data: trip, error: tripError } = await admin
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();
    if (tripError) {
      return NextResponse.json({ error: tripError.message }, { status: 400 });
    }
    if (trip?.status !== "cancelled") {
      return NextResponse.json(
        { error: "Somente viagens canceladas podem ser excluídas" },
        { status: 409 }
      );
    }

    const { error } = await admin.from("trips").delete().eq("id", tripId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
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
