export interface ActiveDriverLocation {
  driverProfileId: string;
  fullName: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  updatedAt: string;
  tripId: string | null;
  vehicle: {
    brand: string;
    model: string;
    color: string;
    licensePlate: string;
  } | null;
}

interface RawVehicle {
  brand: string;
  model: string;
  color: string;
  license_plate: string;
  is_active: boolean;
  updated_at: string;
}

interface RawUser {
  full_name: string;
  avatar_url: string | null;
}

interface RawProviderProfile {
  status: string;
  users: RawUser | null;
}

interface RawDriverProfile {
  provider_profiles: RawProviderProfile | null;
  vehicles: RawVehicle[];
}

interface RawDriverLocationRow {
  driver_profile_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  trip_id: string | null;
  updated_at: string;
  driver_profiles: RawDriverProfile;
}

export function parseActiveDriverRow(row: RawDriverLocationRow): ActiveDriverLocation | null {
  const provider = row.driver_profiles?.provider_profiles;
  if (!provider) return null;
  if (provider.status !== "approved") return null;
  const user = provider.users;
  if (!user) return null;

  const activeVehicles = (row.driver_profiles.vehicles ?? []).filter((v) => v.is_active === true);
  activeVehicles.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const mostRecent = activeVehicles[0];

  return {
    driverProfileId: row.driver_profile_id,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    latitude: row.latitude,
    longitude: row.longitude,
    heading: row.heading,
    updatedAt: row.updated_at,
    tripId: row.trip_id,
    vehicle: mostRecent
      ? {
          brand: mostRecent.brand,
          model: mostRecent.model,
          color: mostRecent.color,
          licensePlate: mostRecent.license_plate,
        }
      : null,
  };
}

// Motoristas com GPS mais antigo que isso viram "cinza" (stale) no mapa
// mas continuam visíveis na última posição conhecida.
export const STALE_THRESHOLD_MINUTES = 30;

export function isDriverLocationStale(updatedAtIso: string, nowMs: number = Date.now()): boolean {
  const age = nowMs - new Date(updatedAtIso).getTime();
  return age >= STALE_THRESHOLD_MINUTES * 60_000;
}

const SELECT_COLUMNS = `
  driver_profile_id,
  latitude,
  longitude,
  heading,
  trip_id,
  updated_at,
  driver_profiles!inner (
    provider_profiles!inner (
      status,
      users!inner ( full_name, avatar_url )
    ),
    vehicles ( brand, model, color, license_plate, is_active, updated_at )
  )
`;

/// Retorna a última localização de TODOS os motoristas aprovados.
/// O consumidor decide o que fazer com stale (ver `isDriverLocationStale`).
export async function fetchActiveDrivers(): Promise<ActiveDriverLocation[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("driver_locations")
    .select(SELECT_COLUMNS)
    .eq("driver_profiles.provider_profiles.status", "approved");

  if (error) throw error;
  if (!data) return [];
  return (data as unknown as RawDriverLocationRow[])
    .map(parseActiveDriverRow)
    .filter((d): d is ActiveDriverLocation => d !== null);
}

export async function fetchDriverMeta(driverProfileId: string): Promise<ActiveDriverLocation | null> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("driver_locations")
    .select(SELECT_COLUMNS)
    .eq("driver_profile_id", driverProfileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseActiveDriverRow(data as unknown as RawDriverLocationRow);
}
