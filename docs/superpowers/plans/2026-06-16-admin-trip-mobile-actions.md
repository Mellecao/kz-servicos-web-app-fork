# Admin Trip Mobile Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit mobile trip status actions, admin candidate price editing, candidate removal while searching, simpler confirmations, cancelled-trip deletion, and repair Google Places autocomplete behavior.

**Architecture:** Keep the existing client-side Supabase API pattern and concentrate trip workflow rules in small helpers used by both desktop and mobile. UI changes stay in `KanbanListView`, `ViagensPage`, and `TripDetailModal`; persistence changes stay in `src/lib/api.ts`.

**Tech Stack:** Next.js App Router 16.2.3, React 19, Supabase JS, TypeScript, Tailwind CSS.

---

### Task 1: Shared Trip Status Rules

**Files:**
- Create: `src/lib/trip-status.ts`
- Modify: `src/app/(dashboard)/viagens/page.tsx`
- Modify: `src/components/KanbanBoard.tsx`
- Modify: `src/components/KanbanListView.tsx`

- [ ] Create `TRIP_STATUS_ACTIONS` with forward actions and the two requested back actions.
- [ ] Use the helper in mobile list buttons instead of hard-coded `listActionConfig`.
- [ ] Use the helper in desktop board validation so drag remains constrained to allowed forward moves.
- [ ] Add mobile buttons that do not hijack the "Ver detalhes" click.

### Task 2: Trip Detail Admin Actions

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/components/TripDetailModal.tsx`

- [ ] Add `deleteTrip(id)` to delete only when called from the cancelled status UI.
- [ ] Add `updateTripDriverCandidatePrice(tripId, driverProfileId, offeredPrice)` for editing `trip_driver_candidates.offered_price`.
- [ ] Replace typed cancel confirmation with a yes/no re-check panel.
- [ ] Show delete action when `t.status === "cancelled"`.
- [ ] Show remove candidate action while `t.status === "searching_drivers"`.
- [ ] Add an inline price editor for candidate offered price.
- [ ] Add status rollback buttons for `searching_drivers -> under_review` and `under_review -> open`.

### Task 3: Google Places Autocomplete

**Files:**
- Modify: `src/components/SearchableSelect.tsx`
- Modify: `src/lib/google-places.ts`

- [ ] Keep async search text stable while options update.
- [ ] Prevent stale requests from leaving loading on forever.
- [ ] Preserve manual typed address as the selected value when the user does not pick a Google result.

### Task 4: Verification

**Files:**
- Existing files only.

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] If build fails because external env/network services are unavailable, report the exact failure and still validate TypeScript/lint where possible.
