import type { ClientMetrics, DriverMetricPeriod } from "@/types/database";
import { getDriverMetricPeriodRange } from "@/lib/driver-metrics";

type Range = { start: Date; end: Date };

type MetricTrip = {
  id: string;
  status: string;
  client_id: string;
  final_price: number | string | null;
  estimated_price: number | string | null;
  finished_at?: string | null;
  cancelled_at?: string | null;
  updated_at?: string | null;
  scheduled_datetime?: string | null;
};

type MetricRating = {
  id: string;
  rated_id: string;
  rating: number;
  created_at: string;
};

function inRange(iso: string | null | undefined, range: Range): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

function tripEffectiveDate(trip: MetricTrip): string | null | undefined {
  if (trip.status === "finished") return trip.finished_at ?? trip.updated_at;
  if (trip.status === "cancelled") return trip.cancelled_at ?? trip.updated_at;
  return trip.scheduled_datetime ?? trip.updated_at;
}

export function getClientMetricPeriodRange(
  period: DriverMetricPeriod,
  anchor = new Date(),
): Range {
  return getDriverMetricPeriodRange(period, anchor);
}

export function buildClientMetrics(input: {
  clientId: string;
  range: Range;
  trips: MetricTrip[];
  ratings: MetricRating[];
}): ClientMetrics {
  const tripsInRange = input.trips.filter(
    (trip) =>
      trip.client_id === input.clientId &&
      inRange(tripEffectiveDate(trip), input.range),
  );

  const finished = tripsInRange.filter((trip) => trip.status === "finished");
  const cancelled = tripsInRange.filter((trip) => trip.status === "cancelled");

  const totalSpent = finished.reduce((sum, trip) => {
    const raw = trip.final_price ?? trip.estimated_price ?? 0;
    const value = typeof raw === "string" ? Number(raw) : raw;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const ratingsInRange = input.ratings.filter(
    (rating) =>
      rating.rated_id === input.clientId &&
      inRange(rating.created_at, input.range),
  );
  const averageRating =
    ratingsInRange.length > 0
      ? Number(
          (
            ratingsInRange.reduce(
              (sum, rating) => sum + Number(rating.rating),
              0,
            ) / ratingsInRange.length
          ).toFixed(1),
        )
      : 0;

  return {
    finishedTrips: finished.length,
    cancelledTrips: cancelled.length,
    totalSpent,
    averageRating,
  };
}
