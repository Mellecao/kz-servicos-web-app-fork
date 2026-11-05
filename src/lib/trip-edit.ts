import type { GooglePlaceAddress } from "@/lib/google-places";
import type { TripStatus } from "@/types/database";

export interface TripPatchCurrent {
  is_round_trip: boolean;
  return_datetime: string | null;
}

export interface TripPatch {
  pickup?: GooglePlaceAddress;
  dropoff?: GooglePlaceAddress;
  scheduled_datetime?: string;
  stops?: GooglePlaceAddress[];
  is_round_trip?: boolean;
  return_datetime?: string | null;
}

const BLOCKED_ROUTE_EDIT_STATUSES: TripStatus[] = [
  "started",
  "finished",
  "cancelled",
];

export function canEditTripRoute(status: TripStatus): boolean {
  return !BLOCKED_ROUTE_EDIT_STATUSES.includes(status);
}

export function validateTripPatch(
  patch: TripPatch,
  current: TripPatchCurrent,
): string | null {
  const isRoundTrip = patch.is_round_trip !== undefined
    ? patch.is_round_trip
    : current.is_round_trip;
  if (!isRoundTrip) return null;

  const returnDatetime = patch.return_datetime !== undefined
    ? patch.return_datetime
    : current.return_datetime;
  if (!returnDatetime) {
    return "Data/hora de retorno é obrigatória para viagens de ida e volta.";
  }
  return null;
}

export function buildTripPatchPayload(
  original: TripPatchRequired,
  edited: TripPatchRequired,
): TripPatch | null {
  const patch: TripPatch = {};

  if (!isSameAddress(original.pickup, edited.pickup)) patch.pickup = edited.pickup;
  if (!isSameAddress(original.dropoff, edited.dropoff)) patch.dropoff = edited.dropoff;
  if (original.scheduled_datetime !== edited.scheduled_datetime) {
    patch.scheduled_datetime = edited.scheduled_datetime;
  }
  if (stopsChanged(original.stops, edited.stops)) patch.stops = edited.stops;
  if (original.is_round_trip !== edited.is_round_trip) {
    patch.is_round_trip = edited.is_round_trip;
    patch.return_datetime = edited.is_round_trip ? edited.return_datetime : null;
  } else if (original.return_datetime !== edited.return_datetime) {
    patch.return_datetime = edited.return_datetime;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

interface TripPatchRequired {
  pickup: GooglePlaceAddress;
  dropoff: GooglePlaceAddress;
  scheduled_datetime: string;
  stops: GooglePlaceAddress[];
  is_round_trip: boolean;
  return_datetime: string | null;
}

function isSameAddress(a: GooglePlaceAddress, b: GooglePlaceAddress): boolean {
  if (a.google_place_id && b.google_place_id) {
    return a.google_place_id === b.google_place_id;
  }
  return a.formatted_address === b.formatted_address;
}

function stopsChanged(
  original: GooglePlaceAddress[],
  edited: GooglePlaceAddress[],
): boolean {
  return original.length !== edited.length || original.some(
    (stop, index) => !isSameAddress(stop, edited[index]),
  );
}
