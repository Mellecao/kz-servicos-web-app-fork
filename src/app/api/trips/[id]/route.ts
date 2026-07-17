import { NextRequest, NextResponse } from "next/server";
import { canEditTripRoute, validateTripPatch, type TripPatch } from "@/lib/trip-edit";
import type { GooglePlaceAddress } from "@/lib/google-places";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { TripStatus } from "@/types/database";

type AddressRow = {
  formatted_address: string;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

function isAddress(value: unknown): value is GooglePlaceAddress {
  return typeof value === "object" && value !== null &&
    typeof (value as { formatted_address?: unknown }).formatted_address === "string" &&
    (value as { formatted_address: string }).formatted_address.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function parsePatch(value: unknown): TripPatch | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Payload inválido";
  }
  const body = value as Record<string, unknown>;
  const patch: TripPatch = {};

  if ("pickup" in body) {
    if (!isAddress(body.pickup)) return "Endereço de embarque inválido";
    patch.pickup = body.pickup;
  }
  if ("dropoff" in body) {
    if (!isAddress(body.dropoff)) return "Endereço de destino inválido";
    patch.dropoff = body.dropoff;
  }
  if ("scheduled_datetime" in body) {
    if (typeof body.scheduled_datetime !== "string" || !isIsoDate(body.scheduled_datetime)) {
      return "Data e hora inválida";
    }
    patch.scheduled_datetime = body.scheduled_datetime;
  }
  if ("stops" in body) {
    if (!Array.isArray(body.stops) || !body.stops.every(isAddress)) return "Paradas inválidas";
    patch.stops = body.stops;
  }
  if ("is_round_trip" in body) {
    if (typeof body.is_round_trip !== "boolean") return "Valor de ida e volta inválido";
    patch.is_round_trip = body.is_round_trip;
  }
  if ("return_datetime" in body) {
    if (body.return_datetime !== null && (typeof body.return_datetime !== "string" || !isIsoDate(body.return_datetime))) {
      return "Data/hora de retorno inválida";
    }
    patch.return_datetime = body.return_datetime as string | null;
  }
  return patch;
}

function toAddressRow(address: GooglePlaceAddress): AddressRow {
  return {
    formatted_address: address.formatted_address.trim(),
    google_place_id: address.google_place_id ?? null,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    street: address.street ?? null,
    number: address.number ?? null,
    neighborhood: address.neighborhood ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    zip_code: address.zip_code ?? null,
  };
}

async function insertAddress(
  admin: ReturnType<typeof getSupabaseAdmin>,
  address: GooglePlaceAddress,
): Promise<string> {
  const { data, error } = await admin.from("addresses").insert(toAddressRow(address)).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao inserir endereço");
  return data.id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = getSupabaseAdmin();
    const { id: tripId } = await params;
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: user, error: userError } = await admin.from("users").select("role").eq("id", authData.user.id).single();
    if (userError || user?.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { data: trip, error: tripError } = await admin
      .from("trips")
      .select("id, status, is_round_trip, return_datetime, trip_stops(id, stop_order, address_id)")
      .eq("id", tripId)
      .single();
    if (tripError || !trip) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

    const parsed = parsePatch(await request.json().catch(() => null));
    if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
    if (Object.keys(parsed).length === 0) return NextResponse.json({ ok: true });

    const touchesRoute = "stops" in parsed || "is_round_trip" in parsed || "return_datetime" in parsed;
    if (touchesRoute && !canEditTripRoute(trip.status as TripStatus)) {
      return NextResponse.json({ error: "Paradas e ida e volta não podem ser alteradas após o início da viagem" }, { status: 409 });
    }

    const validationError = validateTripPatch(parsed, trip);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const tripPayload: Record<string, unknown> = {};
    if (parsed.pickup) tripPayload.pickup_address_id = await insertAddress(admin, parsed.pickup);
    if (parsed.dropoff) tripPayload.dropoff_address_id = await insertAddress(admin, parsed.dropoff);
    if (parsed.scheduled_datetime) tripPayload.scheduled_datetime = parsed.scheduled_datetime;
    if (parsed.is_round_trip !== undefined) {
      tripPayload.is_round_trip = parsed.is_round_trip;
      tripPayload.return_datetime = parsed.is_round_trip ? parsed.return_datetime ?? trip.return_datetime : null;
    } else if ("return_datetime" in parsed) {
      tripPayload.return_datetime = parsed.return_datetime;
    }

    if (Object.keys(tripPayload).length > 0) {
      const { error } = await admin.from("trips").update(tripPayload).eq("id", tripId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (parsed.stops !== undefined) {
      const previousStops = (trip.trip_stops ?? []) as { address_id: string; stop_order: number }[];
      const { error: deleteError } = await admin.from("trip_stops").delete().eq("trip_id", tripId);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

      const rows = [];
      for (const [index, stop] of parsed.stops.entries()) {
        rows.push({ trip_id: tripId, address_id: await insertAddress(admin, stop), stop_order: index + 1 });
      }
      if (rows.length > 0) {
        const { error: insertError } = await admin.from("trip_stops").insert(rows);
        if (insertError) {
          if (previousStops.length > 0) await admin.from("trip_stops").insert(previousStops.map((stop) => ({ ...stop, trip_id: tripId })));
          return NextResponse.json({ error: insertError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}
