# Admin Drivers, Provider App, and Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved admin Motoristas improvements, global admin notifications, Prestadores filtering, and provider-app photo/availability/push/map fixes.

**Architecture:** Keep the admin web changes in focused helpers/components and wire them into the existing dashboard pages. Keep Flutter changes close to `DriverService`, profile models, profile UI, push notification service, and extracted camera state logic. Use Supabase tables already present and add only idempotent migrations/API helpers when permissions or server-side secrets require it.

**Tech Stack:** Next 16 App Router, React 19, Supabase JS, OneSignal web SDK, Node `node:test`, Flutter/Dart, Supabase Flutter, Firebase Messaging, Google Maps Flutter.

---

### Task 1: Admin Driver Metrics Helpers

**Files:**
- Create: `src/lib/driver-metrics.ts`
- Create: `src/lib/driver-metrics.test.ts`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/driver-metrics.test.ts`:

```ts
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
      { id: "t1", status: "finished", driver_profile_id: "driver-1", finished_at: "2026-06-10T10:00:00.000Z", cancelled_at: null, updated_at: "2026-06-10T10:00:00.000Z" },
      { id: "t2", status: "cancelled", driver_profile_id: "driver-1", finished_at: null, cancelled_at: "2026-06-11T10:00:00.000Z", updated_at: "2026-06-11T10:00:00.000Z" },
      { id: "t3", status: "finished", driver_profile_id: "driver-1", finished_at: "2026-05-10T10:00:00.000Z", cancelled_at: null, updated_at: "2026-05-10T10:00:00.000Z" },
    ],
    candidates: [
      { id: "c1", trip_id: "t4", driver_profile_id: "driver-1", status: "rejected", responded_at: "2026-06-12T10:00:00.000Z", created_at: "2026-06-12T09:00:00.000Z" },
      { id: "c2", trip_id: "t5", driver_profile_id: "driver-1", status: "accepted", responded_at: "2026-06-12T10:00:00.000Z", created_at: "2026-06-12T09:00:00.000Z" },
    ],
    ratings: [
      { id: "r1", rated_id: "user-driver", rating: 5, created_at: "2026-06-13T10:00:00.000Z" },
      { id: "r2", rated_id: "user-driver", rating: 3, created_at: "2026-06-14T10:00:00.000Z" },
      { id: "r3", rated_id: "other-user", rating: 1, created_at: "2026-06-14T10:00:00.000Z" },
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
  const range = getDriverMetricPeriodRange("month", new Date("2026-06-29T15:30:00.000Z"));
  assert.equal(range.start.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-01T00:00:00.000Z");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/driver-metrics.test.ts`

Expected: FAIL because `src/lib/driver-metrics.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/driver-metrics.ts` with:

```ts
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
            ratingsInRange.reduce((sum, rating) => sum + Number(rating.rating), 0) /
            ratingsInRange.length
          ).toFixed(1),
        )
      : 0;

  return {
    finishedTrips: tripsInRange.filter((trip) => trip.status === "finished").length,
    cancelledTrips: tripsInRange.filter((trip) => trip.status === "cancelled").length,
    refusedTrips: input.candidates.filter(
      (candidate) =>
        candidate.driver_profile_id === input.driverProfileId &&
        candidate.status === "rejected" &&
        inRange(candidate.responded_at ?? candidate.created_at, input.range),
    ).length,
    averageRating,
  };
}
```

Add these types to `src/types/database.ts`:

```ts
export type DriverMetricPeriod = "today" | "week" | "month" | "year";

export interface DriverMetrics {
  finishedTrips: number;
  cancelledTrips: number;
  refusedTrips: number;
  averageRating: number;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/driver-metrics.test.ts`

Expected: PASS.

### Task 2: Admin Provider Filtering

**Files:**
- Create: `src/lib/provider-filters.ts`
- Create: `src/lib/provider-filters.test.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/app/(dashboard)/prestadores/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/provider-filters.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { isProviderWithoutDriverProfile } from "./provider-filters.ts";

test("excludes providers with a driver profile relation", () => {
  assert.equal(isProviderWithoutDriverProfile({ driver_profiles: { id: "driver-1" } }), false);
  assert.equal(isProviderWithoutDriverProfile({ driver_profiles: [{ id: "driver-1" }] }), false);
});

test("keeps providers without a driver profile relation", () => {
  assert.equal(isProviderWithoutDriverProfile({ driver_profiles: null }), true);
  assert.equal(isProviderWithoutDriverProfile({ driver_profiles: [] }), true);
  assert.equal(isProviderWithoutDriverProfile({}), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/provider-filters.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement helper and wire query**

Create `src/lib/provider-filters.ts`:

```ts
export function isProviderWithoutDriverProfile(provider: {
  driver_profiles?: unknown;
}): boolean {
  const relation = provider.driver_profiles;
  if (Array.isArray(relation)) return relation.length === 0;
  return relation == null;
}
```

Update `fetchProviderProfiles()` to select `driver_profiles(id)` and return providers filtered through `isProviderWithoutDriverProfile`.

In `prestadores/page.tsx`, no UI changes are required if `fetchProviderProfiles()` already filters.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/provider-filters.test.ts`

Expected: PASS.

### Task 3: Admin Photo and Preview APIs

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/app/(dashboard)/motoristas/page.tsx`

- [ ] **Step 1: Add photo types**

Add:

```ts
export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  photo_url: string;
  photo_type: string;
  created_at: string;
}
```

Add `vehicle_photos?: VehiclePhoto[];` to `Vehicle`.

- [ ] **Step 2: Update fetches and delete helpers**

Update `fetchVehiclesByDriver()` to select `*, vehicle_photos(*)`.

Add:

```ts
export async function deleteDriverProfilePhoto(id: string): Promise<void> {
  const { error } = await supabase.from("driver_profile_photos").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteVehiclePhoto(id: string): Promise<void> {
  const { error } = await supabase.from("vehicle_photos").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Implement preview modal**

In `motoristas/page.tsx`, add selected preview state, render avatar image from `users.avatar_url`, add a preview button/click target, show public profile data and vehicle photos, and implement image lightbox state.

- [ ] **Step 4: Implement admin photo removal**

In the preview modal, add destructive icon buttons on each photo. On click, confirm, call `deleteDriverProfilePhoto()` or `deleteVehiclePhoto()`, reload drivers, and show toast.

- [ ] **Step 5: Verify manually**

Run: `npm run lint`

Expected: exit 0 or only pre-existing warnings not caused by these changes.

### Task 4: Admin Driver History Metrics UI

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/app/(dashboard)/motoristas/page.tsx`

- [ ] **Step 1: Add API function**

Add `fetchDriverPerformance(driverProfileId, driverUserId, period)` that:

- uses `getDriverMetricPeriodRange(period)`;
- fetches trips for the driver in the selected year upper bound;
- fetches rejected candidates for the driver;
- fetches ratings for the driver user;
- returns `{ metrics, history }`.

- [ ] **Step 2: Replace history modal loading**

Change `handleOpenTripHistory()` to store selected driver IDs and call `fetchDriverPerformance()` for the current period.

- [ ] **Step 3: Add period segmented controls**

Render buttons `Hoje`, `Semana`, `Mes`, `Ano` above metrics. Changing a filter reloads performance data.

- [ ] **Step 4: Render metric cards**

Show cards for finalizadas, canceladas, recusadas, media de avaliacoes above the trip list.

- [ ] **Step 5: Verify**

Run: `node --import tsx --test src/lib/driver-metrics.test.ts`

Expected: PASS.

### Task 5: Global Admin Notifications

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/api.ts`
- Create: `src/components/AdminNotificationsButton.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Add migration: `supabase/migrations/20260629120000_admin_action_notifications.sql`

- [ ] **Step 1: Add notification types and API helpers**

Add `Notification` interface to `database.ts`.

Add helpers in `api.ts`: `fetchAdminNotifications()`, `markNotificationRead(id)`, `subscribeToAdminNotifications(onChange)`.

- [ ] **Step 2: Add global component**

Create `AdminNotificationsButton.tsx` as a client component that loads latest admin notifications, subscribes to Realtime, shows unread badge, dropdown, and mark-read action.

- [ ] **Step 3: Wire layout**

Render `<AdminNotificationsButton />` next to `<OneSignalInitializer />` inside dashboard layout.

- [ ] **Step 4: Add migration for admin action notifications**

Create an idempotent SQL migration that creates helper function `public.notify_admins_for_trip_action(...)` and triggers on `trips` and `trip_driver_candidates` to insert notifications for all active admins when admin attention is needed.

- [ ] **Step 5: Verify**

Run: `npm run lint`

Expected: exit 0 or only pre-existing warnings not caused by these changes.

### Task 6: Provider App Photo Models and Removal

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\core\models\driver_profile_data.dart`
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\core\services\driver_service.dart`
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\features\profile\presentation\pages\profile_page.dart`
- Create: `C:\Projetos\kz-servicos-app-prestador\test\core\models\driver_profile_data_test.dart`

- [ ] **Step 1: Write failing model test**

Test that `DriverProfileData.fromMap()` preserves photo IDs and URLs for vehicle and driver photos.

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/core/models/driver_profile_data_test.dart`

Expected: FAIL because the model stores only URLs.

- [ ] **Step 3: Add photo model and service deletes**

Add `ProfilePhotoData { id, url }`; keep `driverPhotoUrls` and `vehicle.photoUrls` as derived getters for compatibility; add `driverPhotos` and `vehicle.photos`.

Add `deleteDriverProfilePhoto(id)` and `deleteVehiclePhoto(id)` in `DriverService`.

- [ ] **Step 4: Add UI remove actions**

Update `_PhotoGrid` to accept photo objects plus `onRemove`; show a small delete button over each image; confirm before deleting.

- [ ] **Step 5: Run test**

Run: `flutter test test/core/models/driver_profile_data_test.dart`

Expected: PASS.

### Task 7: Provider App Availability Toggle

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\features\profile\presentation\pages\profile_page.dart`

- [ ] **Step 1: Implement UI control**

Change `_buildOnlineStatus()` from a static badge to a switch/list tile that calls `DriverService.updateAvailability()`.

- [ ] **Step 2: Add loading and rollback**

Disable the switch while saving; optimistically update `_profile` or reload on success; show snackbar and rollback/reload on failure.

- [ ] **Step 3: Verify manually**

Run: `flutter analyze`

Expected: no new analysis errors.

### Task 8: Provider App Push and Map Tilt Logic

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\core\services\push_notification_service.dart`
- Create: `C:\Projetos\kz-servicos-app-prestador\lib\features\trip\domain\navigation_camera_state.dart`
- Create: `C:\Projetos\kz-servicos-app-prestador\test\features\trip\domain\navigation_camera_state_test.dart`
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\features\trip\presentation\pages\active_trip_page.dart`

- [ ] **Step 1: Add failing push tests**

Extend `push_notification_service_test.dart` to assert `client_accepted_trip` is persistent and routes to `/home?tripRequestId=trip-123`.

- [ ] **Step 2: Run push test**

Run: `flutter test test/core/services/push_notification_service_test.dart`

Expected before implementation: FAIL if `client_accepted_trip` does not route to `/home?tripRequestId=trip-123` or is not persistent. If the test passes immediately, add a second failing assertion for payload type `awaiting_driver_confirmation` with the same route and persistence expectations, then run again and verify that new assertion fails before changing production code.

- [ ] **Step 3: Extract camera state logic**

Create `navigation_camera_state.dart` with pure functions deciding whether to apply tilt/following after camera movement, manual interaction, and recenter.

- [ ] **Step 4: Add camera tests**

Create tests for manual camera movement disabling follow/tilt and recenter restoring 3D follow.

- [ ] **Step 5: Wire active trip page**

Use the pure logic in `_handleCameraMove`, `_handleCameraIdle`, `_recenterCamera`, and `_animateNavigationCamera` to reduce conflicting tilt updates.

- [ ] **Step 6: Verify**

Run: `flutter test test/core/services/push_notification_service_test.dart test/features/trip/domain/navigation_camera_state_test.dart`

Expected: PASS.

### Task 9: Final Verification

**Files:**
- Both repositories.

- [ ] **Step 1: Web verification**

Run in web repo:

```powershell
node --import tsx --test src/lib/driver-metrics.test.ts src/lib/provider-filters.test.ts
npm run lint
npm run build
```

- [ ] **Step 2: Flutter verification**

Run in provider app repo:

```powershell
flutter test
flutter analyze
```

- [ ] **Step 3: Review worktrees**

Run `git status --short` in both repositories and summarize only files changed for this task separately from pre-existing dirty files.
