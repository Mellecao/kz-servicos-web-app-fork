import type { Address, Trip, TripDriverCandidate, User } from "@/types/database";

// As relações só precisam dos campos que a pesquisa lê: um Trip completo continua a servir.
type TripSearchInput = Pick<Trip, "id" | "status" | "scheduled_datetime"> & {
  driver_profiles?: Trip["driver_profiles"] | null;
  pickup_address?: Pick<Address, "formatted_address"> | null;
  dropoff_address?: Pick<Address, "formatted_address"> | null;
  users?: Pick<User, "full_name" | "email"> | null;
};

export function filterTripsBySearch<T extends TripSearchInput>(
  trips: T[],
  query: string,
  candidatesByTrip: Record<string, TripDriverCandidate[]> = {},
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return trips;

  return trips.filter((trip) =>
    buildTripSearchText(trip, candidatesByTrip[trip.id] ?? []).includes(
      normalizedQuery,
    ),
  );
}

export function buildTripSearchText(
  trip: TripSearchInput,
  candidates: TripDriverCandidate[] = [],
) {
  return normalizeSearchText(
    [
      trip.status,
      trip.scheduled_datetime,
      trip.pickup_address?.formatted_address,
      trip.dropoff_address?.formatted_address,
      trip.users?.full_name,
      trip.users?.email,
      trip.driver_profiles?.provider_profiles?.users?.full_name,
      ...candidates.map(
        (candidate) =>
          candidate.driver_profiles?.provider_profiles?.users?.full_name,
      ),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
