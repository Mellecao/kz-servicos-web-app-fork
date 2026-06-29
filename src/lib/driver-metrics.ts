import type { DriverMetricPeriod, DriverMetrics } from "@/types/database";

type Range = { start: Date; end: Date };

type MetricTrip = {
  id: string;
  status: string;
  driver_profile_id: string | null;
  finished_at?: string | null;
  cancelled_at?: string | null;
  updated_at?: string | null;
  scheduled_datetime?: string | null;
};

type MetricCandidate = {
  id: string;
  trip_id: string;
  driver_profile_id: string;
  status: string;
  responded_at?: string | null;
  created_at: string;
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

export function getDriverMetricPeriodRange(
  period: DriverMetricPeriod,
  anchor = new Date(),
): Range {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const date = anchor.getUTCDate();

  if (period === "today") {
    return {
      start: new Date(Date.UTC(year, month, date)),
      end: new Date(Date.UTC(year, month, date + 1)),
    };
  }

  if (period === "week") {
    const day = anchor.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return {
      start: new Date(Date.UTC(year, month, date + mondayOffset)),
      end: new Date(Date.UTC(year, month, date + mondayOffset + 7)),
    };
  }

  if (period === "month") {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  }

  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function buildDriverMetrics(input: {
  driverProfileId: string;
  driverUserId: string;
  range: Range;
  trips: MetricTrip[];
  candidates: MetricCandidate[];
  ratings: MetricRating[];
}): DriverMetrics {
  const tripsInRange = input.trips.filter(
    (trip) =>
      trip.driver_profile_id === input.driverProfileId &&
      inRange(tripEffectiveDate(trip), input.range),
  );
  const ratingsInRange = input.ratings.filter(
    (rating) =>
      rating.rated_id === input.driverUserId &&
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
    finishedTrips: tripsInRange.filter((trip) => trip.status === "finished")
      .length,
    cancelledTrips: tripsInRange.filter((trip) => trip.status === "cancelled")
      .length,
    refusedTrips: input.candidates.filter(
      (candidate) =>
        candidate.driver_profile_id === input.driverProfileId &&
        candidate.status === "rejected" &&
        inRange(candidate.responded_at ?? candidate.created_at, input.range),
    ).length,
    averageRating,
  };
}
