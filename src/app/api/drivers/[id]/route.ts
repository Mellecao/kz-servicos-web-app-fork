import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ProviderStatus } from "@/types/database";

type DriverPatchBody = {
  user_id?: unknown;
  provider_profile_id?: unknown;
  vehicle_id?: unknown;
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  cpf?: unknown;
  provider_status?: unknown;
  cnh_number?: unknown;
  cnh_category?: unknown;
  cnh_expiration_date?: unknown;
  is_available?: unknown;
  vehicle?: {
    brand?: unknown;
    model?: unknown;
    year?: unknown;
    color?: unknown;
    license_plate?: unknown;
    passenger_capacity?: unknown;
  };
};

const providerStatuses: ProviderStatus[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driverProfileId } = await params;
    if (!driverProfileId) {
      return NextResponse.json({ error: "ID do motorista é obrigatório" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as DriverPatchBody;
    const userId = asRequiredString(body.user_id);
    const providerProfileId = asRequiredString(body.provider_profile_id);
    const fullName = asRequiredString(body.full_name);
    const email = asRequiredString(body.email);
    const providerStatus = asProviderStatus(body.provider_status);

    if (!userId || !providerProfileId || !fullName || !email || !providerStatus) {
      return NextResponse.json(
        { error: "Dados obrigatórios do motorista ausentes" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: userError } = await admin
      .from("users")
      .update({
        full_name: fullName,
        email,
        phone: asNullableString(body.phone),
        cpf: asNullableString(body.cpf),
      })
      .eq("id", userId);

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    const { error: providerError } = await admin
      .from("provider_profiles")
      .update({ status: providerStatus })
      .eq("id", providerProfileId);

    if (providerError) {
      return NextResponse.json({ error: providerError.message }, { status: 400 });
    }

    const { data: driverProfile, error: driverError } = await admin
      .from("driver_profiles")
      .update({
        cnh_number: asNullableString(body.cnh_number),
        cnh_category: asNullableString(body.cnh_category),
        cnh_expiration_date: asNullableString(body.cnh_expiration_date),
        is_available: typeof body.is_available === "boolean" ? body.is_available : false,
      })
      .eq("id", driverProfileId)
      .select("*, provider_profiles(*, users(*))")
      .single();

    if (driverError) {
      return NextResponse.json({ error: driverError.message }, { status: 400 });
    }

    const vehiclePayloadResult = normalizeVehicle(body.vehicle);
    if (vehiclePayloadResult.error) {
      return NextResponse.json({ error: vehiclePayloadResult.error }, { status: 400 });
    }
    const vehiclePayload = vehiclePayloadResult.payload;
    if (vehiclePayload) {
      const vehicleId = asNullableString(body.vehicle_id);
      if (vehicleId) {
        const { error: vehicleError } = await admin
          .from("vehicles")
          .update(vehiclePayload)
          .eq("id", vehicleId);

        if (vehicleError) {
          return NextResponse.json({ error: vehicleError.message }, { status: 400 });
        }
      } else {
        const { error: vehicleError } = await admin
          .from("vehicles")
          .insert({
            ...vehiclePayload,
            driver_profile_id: driverProfileId,
            vehicle_document_url: "",
            is_active: true,
          });

        if (vehicleError) {
          return NextResponse.json({ error: vehicleError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json(driverProfile, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function normalizeVehicle(vehicle: DriverPatchBody["vehicle"]): {
  payload: {
    brand: string;
    model: string;
    year: number;
    color: string;
    license_plate: string;
    passenger_capacity: number;
  } | null;
  error: string | null;
} {
  if (!vehicle) return { payload: null, error: null };

  const brand = asNullableString(vehicle.brand);
  const model = asNullableString(vehicle.model);
  const year = asOptionalNumber(vehicle.year);
  const color = asNullableString(vehicle.color);
  const licensePlate = asNullableString(vehicle.license_plate);
  const passengerCapacity = asOptionalNumber(vehicle.passenger_capacity) ?? 4;

  const hasAny = brand || model || year || color || licensePlate || vehicle.passenger_capacity;
  if (!hasAny) return { payload: null, error: null };
  if (!brand || !model || !year || !color || !licensePlate) {
    return { payload: null, error: "Preencha marca, modelo, ano, cor e placa do veículo." };
  }

  return {
    payload: {
      brand,
      model,
      year,
      color,
      license_plate: licensePlate,
      passenger_capacity: passengerCapacity,
    },
    error: null,
  };
}

function asProviderStatus(value: unknown): ProviderStatus | null {
  return typeof value === "string" && providerStatuses.includes(value as ProviderStatus)
    ? (value as ProviderStatus)
    : null;
}

function asRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNullableString(value: unknown): string | null {
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
