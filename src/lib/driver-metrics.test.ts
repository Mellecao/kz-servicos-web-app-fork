import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDriverMetrics,
  getDriverMetricPeriodRange,
} from "./driver-metrics.ts";

test("builds driver metrics for trips candidates and ratings", () => {
  const metrics = buildDriverMetrics({
    driverProfileId: "driver-1",
    driverUserId: "user-driver",
    range: {
      start: new Date("2026-06-01T00:00:00.000Z"),
      end: new Date("2026-07-01T00:00:00.000Z"),
    },
    trips: [
      {
        id: "t1",
        status: "finished",
        driver_profile_id: "driver-1",
        finished_at: "2026-06-10T10:00:00.000Z",
        cancelled_at: null,
        updated_at: "2026-06-10T10:00:00.000Z",
      },
      {
        id: "t2",
        status: "cancelled",
        driver_profile_id: "driver-1",
        finished_at: null,
        cancelled_at: "2026-06-11T10:00:00.000Z",
        updated_at: "2026-06-11T10:00:00.000Z",
      },
      {
        id: "t3",
        status: "finished",
        driver_profile_id: "driver-1",
        finished_at: "2026-05-10T10:00:00.000Z",
        cancelled_at: null,
        updated_at: "2026-05-10T10:00:00.000Z",
      },
    ],
    candidates: [
      {
        id: "c1",
        trip_id: "t4",
        driver_profile_id: "driver-1",
        status: "rejected",
        responded_at: "2026-06-12T10:00:00.000Z",
        created_at: "2026-06-12T09:00:00.000Z",
      },
      {
        id: "c2",
        trip_id: "t5",
        driver_profile_id: "driver-1",
        status: "accepted",
        responded_at: "2026-06-12T10:00:00.000Z",
        created_at: "2026-06-12T09:00:00.000Z",
      },
    ],
    ratings: [
      {
        id: "r1",
        rated_id: "user-driver",
        rating: 5,
        created_at: "2026-06-13T10:00:00.000Z",
      },
      {
        id: "r2",
        rated_id: "user-driver",
        rating: 3,
        created_at: "2026-06-14T10:00:00.000Z",
      },
      {
        id: "r3",
        rated_id: "other-user",
        rating: 1,
        created_at: "2026-06-14T10:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(metrics, {
    finishedTrips: 1,
    cancelledTrips: 1,
    refusedTrips: 1,
    averageRating: 4,
  });
});

test("builds a month period range from an anchor date", () => {
  const range = getDriverMetricPeriodRange(
    "month",
    new Date("2026-06-29T15:30:00.000Z"),
  );
  assert.equal(range.start.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-01T00:00:00.000Z");
});
