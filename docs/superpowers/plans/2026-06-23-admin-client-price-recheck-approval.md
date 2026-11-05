# Admin Client Price Re-check Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Cliente: aprovar` action that lets an admin select an already admin-approved driver proposal on behalf of the client.

**Architecture:** Keep the existing `selectTripDriver` data flow and expose it from `TripDetailModal`. Extract only the visibility rule into a pure helper so it can be covered with the repository's dependency-free Node test runner.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase client, Node test runner.

---

### Task 1: Test the visibility rule

**Files:**
- Create: `src/lib/trip-candidate-actions.ts`
- Create: `src/lib/trip-candidate-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create tests that call `canAdminApproveForClient` and assert that it returns `true` only for `searching_drivers`, `accepted`, `admin_approved = true`, and a non-null offered price.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/trip-candidate-actions.test.ts`

Expected: FAIL because `canAdminApproveForClient` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Export a typed pure function:

```ts
export function canAdminApproveForClient(
  tripStatus: TripStatus,
  candidate: Pick<
    TripDriverCandidate,
    "status" | "admin_approved" | "offered_price"
  >
): boolean {
  return (
    tripStatus === "searching_drivers" &&
    candidate.status === "accepted" &&
    candidate.admin_approved &&
    candidate.offered_price != null
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/lib/trip-candidate-actions.test.ts`

Expected: all visibility tests PASS.

### Task 2: Add the admin action

**Files:**
- Modify: `src/components/TripDetailModal.tsx`

- [ ] **Step 1: Add processing state**

Track the selected candidate ID in `selectingCandidateId`. Reset it when modal data is reset.

- [ ] **Step 2: Protect the selection handler**

Before calling `selectTripDriver`, confirm with:

```ts
window.confirm(
  `Aprovar a proposta de ${driverName} em nome do cliente por R$ ${price}?`
)
```

Set `selectingCandidateId` before the request and clear it in `finally`. On success, reload trip and candidates, call `onUpdate`, and display the existing success toast. On failure, display the existing error toast.

- [ ] **Step 3: Render the button**

Next to the existing approval toggle, render `Cliente: aprovar` when `canAdminApproveForClient(t.status, c)` is true. Disable it while any candidate selection is in progress and change its label to `Aprovando...` for the active candidate.

### Task 3: Verify the feature

**Files:**
- Verify: `src/lib/trip-candidate-actions.test.ts`
- Verify: `src/components/TripDetailModal.tsx`

- [ ] **Step 1: Run focused tests**

Run: `node --test src/lib/trip-candidate-actions.test.ts`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: build and TypeScript checks PASS.

- [ ] **Step 3: Run lint on changed source files**

Run: `npx eslint src/lib/trip-candidate-actions.ts src/lib/trip-candidate-actions.test.ts src/components/TripDetailModal.tsx`

Expected: no errors introduced by this feature.
