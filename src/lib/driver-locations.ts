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
