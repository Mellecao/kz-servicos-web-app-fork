import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

    if (!client_id || !pickup_address || !dropoff_address || !scheduled_datetime) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes" },
        { status: 400 }
      );
    }

    const [pickupResult, dropoffResult] = await Promise.all([
      admin.from("addresses").insert({ formatted_address: pickup_address }).select().single(),
      admin.from("addresses").insert({ formatted_address: dropoff_address }).select().single(),
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
