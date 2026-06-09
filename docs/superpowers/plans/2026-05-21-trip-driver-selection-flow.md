# Trip Driver Selection Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full trip driver selection flow: admin approves candidates, client sees and selects approved candidates in real-time, driver gets banner instead of direct navigation, "Cheguei no local" is fixed.

**Architecture:** New `admin_approved` boolean on `trip_driver_candidates` gates which candidates clients see. Client app subscribes to real-time changes on that table. Driver app no longer navigates directly to active trip on accept — instead shows a banner and navigates from the schedule detail page after client selects.

**Tech Stack:** Supabase (PostgreSQL + Realtime), Next.js + TypeScript (admin panel), Flutter + Supabase Flutter SDK v2 (client + driver apps)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260521120000_add_admin_approved_to_candidates.sql` | Create | DB migration |
| `src/types/database.ts` | Modify | Add `admin_approved` to `TripDriverCandidate` |
| `src/lib/api.ts` | Modify | Add `approveDriverCandidate` function |
| `src/components/TripDetailModal.tsx` | Modify | Replace "Selecionar" with "Aprovar/Desaprovar" toggle |
| `kz-servicos-app-cliente/.../driver_candidate.dart` | Modify | Add `offeredPrice` field |
| `kz-servicos-app-cliente/.../driver_candidate_model.dart` | Modify | Parse `offered_price` from JSON |
| `test/.../driver_candidate_model_test.dart` | Create | Unit tests for model |
| `kz-servicos-app-cliente/.../trip_repository.dart` | Modify | Add `offeredPrice` to `acceptDriverCandidate` |
| `kz-servicos-app-cliente/.../trip_repository_impl.dart` | Modify | Filter by `admin_approved`, pass `final_price` |
| `kz-servicos-app-cliente/.../pending_confirmations_cubit.dart` | Modify | Thread `offeredPrice` through `acceptCandidate` |
| `kz-servicos-app-cliente/.../driver_selection_panel.dart` | Rewrite | Use real `DriverCandidate` instead of `MockDriver` |
| `kz-servicos-app-cliente/.../trip_home_page.dart` | Modify | Real-time subscription, updated callbacks |
| `kz-servicos-app-prestador/.../home_page.dart` | Modify | Remove direct navigation on accept |
| `kz-servicos-app-prestador/.../schedule_detail_page.dart` | Modify | Navigate to active-trip on startTrip success |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260521120000_add_admin_approved_to_candidates.sql`

- [ ] **Step 1: Write the migration**

```sql
-- +goose Up
ALTER TABLE trip_driver_candidates
  ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_admin_approved
  ON trip_driver_candidates(trip_id, admin_approved);

-- +goose Down
DROP INDEX IF EXISTS idx_trip_driver_candidates_admin_approved;
ALTER TABLE trip_driver_candidates DROP COLUMN IF EXISTS admin_approved;
```

- [ ] **Step 2: Apply on Supabase**

In Supabase SQL editor, run the Up migration. Verify with:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'trip_driver_candidates' AND column_name = 'admin_approved';
```
Expected: one row with `boolean`, default `false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260521120000_add_admin_approved_to_candidates.sql
git commit -m "feat(db): add admin_approved to trip_driver_candidates"
```

---

## Task 2: Web App Types & API

**Files:**
- Modify: `src/types/database.ts` (line ~217 in `TripDriverCandidate`)
- Modify: `src/lib/api.ts` (after `selectTripDriver`, ~line 259)

- [ ] **Step 1: Add `admin_approved` to TypeScript type**

In `src/types/database.ts`, add the field to `TripDriverCandidate`:

```typescript
export interface TripDriverCandidate {
  id: string;
  trip_id: string;
  driver_profile_id: string;
  status: TripDriverCandidateStatus;
  offered_price: number | null;
  admin_approved: boolean;
  invited_at: string;
  responded_at: string | null;
  observations: string | null;
  created_at: string;
  // Relations
  driver_profiles?: DriverProfile & {
    provider_profiles?: ProviderProfile & {
      users?: User;
    };
  };
}
```

- [ ] **Step 2: Add `approveDriverCandidate` to API**

In `src/lib/api.ts`, after the `selectTripDriver` function (around line 259), add:

```typescript
export async function approveDriverCandidate(
  tripId: string,
  driverProfileId: string,
  approved: boolean
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({ admin_approved: approved })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select("*, driver_profiles(*, provider_profiles(*, users(*)))")
    .single();
  if (error) throw error;
  return data as TripDriverCandidate;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Projetos\kz-servicos-web-app
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/lib/api.ts
git commit -m "feat(webapp): add admin_approved type and approveDriverCandidate api"
```

---

## Task 3: Web App TripDetailModal — Approve Button

**Files:**
- Modify: `src/components/TripDetailModal.tsx`

The current code shows a "Selecionar" button for `candStatus === 'pending'` candidates (old flow). Replace with "Aprovar/Desaprovar" toggle for `status === 'accepted'` candidates.

- [ ] **Step 1: Import `approveDriverCandidate` in TripDetailModal**

In `TripDetailModal.tsx`, update the import from `@/lib/api` to include `approveDriverCandidate`.

- [ ] **Step 2: Add `handleApproveCandidate` function**

After the `handleSelectDriver` function (around line 380), add:

```typescript
const handleApproveCandidate = async (
  driverProfileId: string,
  approved: boolean
) => {
  try {
    const updated = await approveDriverCandidate(t.id, driverProfileId, approved);
    setCandidates((prev) =>
      prev.map((c) => (c.driver_profile_id === driverProfileId ? updated : c))
    );
    toast("success", approved ? "Candidato aprovado para o cliente" : "Aprovacao removida");
  } catch {
    toast("danger", "Erro ao atualizar aprovacao");
  }
};
```

- [ ] **Step 3: Replace "Selecionar" button with "Aprovar" toggle**

Find the candidate card section (around line 580). Replace:

```tsx
{t.status === "searching_drivers" && candStatus === "pending" && (
  <button
    onClick={() => handleSelectDriver(c)}
    disabled={c.offered_price == null}
    className="mt-1.5 px-2 py-0.5 rounded text-[10px] font-heading font-bold bg-accent text-background hover:bg-accent-dark transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  >
    Selecionar
  </button>
)}
```

With:

```tsx
{t.status === "searching_drivers" && candStatus === "accepted" && (
  <button
    onClick={() => handleApproveCandidate(c.driver_profile_id, !c.admin_approved)}
    className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-heading font-bold transition-colors cursor-pointer ${
      c.admin_approved
        ? "bg-green-500/20 text-green-600 hover:bg-red-500/20 hover:text-red-600"
        : "bg-surface-hover text-contrast hover:bg-accent/20 hover:text-accent"
    }`}
  >
    {c.admin_approved ? "Aprovado ✓" : "Aprovar para cliente"}
  </button>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:\Projetos\kz-servicos-web-app
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual test in browser**
  1. Start dev server: `npm run dev`
  2. Open a trip in `searching_drivers` status with a driver that has `status = 'accepted'`
  3. Button shows "Aprovar para cliente"
  4. Click → button changes to "Aprovado ✓", Supabase shows `admin_approved = true`
  5. Click again → reverts to "Aprovar para cliente"

- [ ] **Step 6: Commit**

```bash
git add src/components/TripDetailModal.tsx
git commit -m "feat(webapp): add admin approval toggle for driver candidates"
```

---

## Task 4: Flutter Client — DriverCandidate Entity & Model with Tests

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\domain\entities\driver_candidate.dart`
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\data\models\driver_candidate_model.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\test\features\trip\data\models\driver_candidate_model_test.dart`

- [ ] **Step 1: Write the failing test**

Create `test/features/trip/data/models/driver_candidate_model_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app/features/trip/data/models/driver_candidate_model.dart';

void main() {
  group('DriverCandidateModel', () {
    final baseJson = {
      'id': 'cand-1',
      'trip_id': 'trip-1',
      'driver_profile_id': 'driver-1',
      'driver_profiles': {
        'id': 'driver-1',
        'provider_profiles': {
          'users': {'full_name': 'Joao Silva', 'avatar_url': null},
        },
        'vehicles': [],
      },
    };

    test('parses offered_price when present', () {
      final json = {...baseJson, 'offered_price': 150.50};
      final model = DriverCandidateModel.fromJson(json);
      expect(model.offeredPrice, 150.50);
    });

    test('handles null offered_price', () {
      final json = {...baseJson, 'offered_price': null};
      final model = DriverCandidateModel.fromJson(json);
      expect(model.offeredPrice, isNull);
    });

    test('maps offeredPrice to entity', () {
      final json = {...baseJson, 'offered_price': 200.0};
      final entity = DriverCandidateModel.fromJson(json).toEntity();
      expect(entity.offeredPrice, 200.0);
    });

    test('entity with null offeredPrice maps correctly', () {
      final model = DriverCandidateModel.fromJson(baseJson);
      final entity = model.toEntity();
      expect(entity.offeredPrice, isNull);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter test test/features/trip/data/models/driver_candidate_model_test.dart
```
Expected: FAIL — `offeredPrice` not found.

- [ ] **Step 3: Add `offeredPrice` to entity**

In `lib/features/trip/domain/entities/driver_candidate.dart`, add `this.offeredPrice` to constructor and `final double? offeredPrice;` field. Keep `props` unchanged.

- [ ] **Step 4: Add `offeredPrice` to model**

In `lib/features/trip/data/models/driver_candidate_model.dart`:
- Add `this.offeredPrice` to constructor and `final double? offeredPrice;` field
- In `fromJson`: add `offeredPrice: (json['offered_price'] as num?)?.toDouble(),`
- In `toEntity()`: add `offeredPrice: offeredPrice,`

- [ ] **Step 5: Run tests to verify they pass**

```bash
flutter test test/features/trip/data/models/driver_candidate_model_test.dart
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd C:\Projetos\kz-servicos-app-cliente
git add lib/features/trip/domain/entities/driver_candidate.dart \
        lib/features/trip/data/models/driver_candidate_model.dart \
        test/features/trip/data/models/driver_candidate_model_test.dart
git commit -m "feat(client): add offeredPrice to DriverCandidate entity and model"
```

---

## Task 5: Flutter Client — Repository & Cubit

**Files:**
- Modify: `lib/features/trip/domain/repositories/trip_repository.dart`
- Modify: `lib/features/trip/data/repositories/trip_repository_impl.dart`
- Modify: `lib/features/trip/presentation/cubit/pending_confirmations_cubit.dart`

- [ ] **Step 1: Update repository interface**

In `trip_repository.dart`, add `double? offeredPrice` parameter to `acceptDriverCandidate`.

- [ ] **Step 2: Update `getTripsAwaitingClientConfirmation` filter**

In `trip_repository_impl.dart`, change `.eq('status', 'accepted')` to `.eq('admin_approved', true)`.

Also update the select string to include `offered_price, admin_approved`:
```dart
        .select(
          'id, trip_id, driver_profile_id, status, offered_price, admin_approved, '
          'driver_profiles(id, '
          'provider_profiles(users(full_name, avatar_url)), '
          'vehicles(id, brand, model, year, color, license_plate, is_active))',
        )
```

- [ ] **Step 3: Update `acceptDriverCandidate` implementation**

In `trip_repository_impl.dart`, add `double? offeredPrice` parameter and:
```dart
if (offeredPrice != null) updates['final_price'] = offeredPrice;
```

- [ ] **Step 4: Update cubit**

In `pending_confirmations_cubit.dart`, add `double? offeredPrice` to `acceptCandidate` and pass it through to `_repository.acceptDriverCandidate`.

- [ ] **Step 5: Run Flutter analyze**

```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter analyze lib/features/trip/
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/features/trip/domain/repositories/trip_repository.dart \
        lib/features/trip/data/repositories/trip_repository_impl.dart \
        lib/features/trip/presentation/cubit/pending_confirmations_cubit.dart
git commit -m "feat(client): filter candidates by admin_approved, pass offeredPrice to acceptDriverCandidate"
```

---

## Task 6: Flutter Client — DriverSelectionPanel (real data)

**Files:**
- Rewrite: `lib/features/trip/presentation/widgets/driver_selection_panel.dart`

Replace the entire file. The new panel receives `List<DriverCandidate>` and `ValueChanged<DriverCandidate>`.

Key changes vs current:
- Constructor: `candidates: List<DriverCandidate>` + `onDriverAccepted: ValueChanged<DriverCandidate>`
- No `MockDriver.samples` — uses `widget.candidates`
- Shows empty state when `candidates.isEmpty`: "Aguardando motoristas... O admin está analisando as propostas"
- Card shows `candidate.driverName`, `candidate.vehicleSummary`, `candidate.offeredPrice`
- Profile sheet shows price prominently
- Avatar uses `candidate.initials`
- Removes `_buildCarPhotos`, `_buildExtras`, `_buildDriverNote` (not available from DB)

- [ ] **Step 1: Rewrite the file**

Complete replacement — see Task 6 in the full plan for the full Dart code.

Key structure:
```dart
class DriverSelectionPanel extends StatefulWidget {
  final List<DriverCandidate> candidates;
  final ValueChanged<DriverCandidate> onDriverAccepted;
  // ...
}
```

- [ ] **Step 2: Run Flutter analyze**

```bash
flutter analyze lib/features/trip/presentation/widgets/driver_selection_panel.dart
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/features/trip/presentation/widgets/driver_selection_panel.dart
git commit -m "feat(client): rewrite DriverSelectionPanel with real DriverCandidate data"
```

---

## Task 7: Flutter Client — TripHomePage (real-time + updated flow)

**Files:**
- Modify: `lib/features/trip/presentation/pages/trip_home_page.dart`

- [ ] **Step 1: Add `driverSelected` to `TripFlowStep` enum**

Add after `driverSelection`:
```dart
  driverSelected,
```

- [ ] **Step 2: Add state fields**

After `RealtimeChannel? _tripChannel;`:
```dart
  List<DriverCandidate> _approvedCandidates = [];
  RealtimeChannel? _candidatesChannel;
```

- [ ] **Step 3: Remove MockDriver import, ensure DriverCandidate + DriverCandidateModel are imported**

Remove:
```dart
import 'package:kz_servicos_app/features/trip/data/models/mock_driver.dart';
```

Add (if not present):
```dart
import 'package:kz_servicos_app/features/trip/domain/entities/driver_candidate.dart';
import 'package:kz_servicos_app/features/trip/data/models/driver_candidate_model.dart';
```

- [ ] **Step 4: Add `_fetchApprovedCandidates` method**

```dart
  Future<void> _fetchApprovedCandidates(String tripId) async {
    try {
      final response = await Supabase.instance.client
          .from('trip_driver_candidates')
          .select(
            'id, trip_id, driver_profile_id, status, offered_price, admin_approved, '
            'driver_profiles(id, '
            'provider_profiles(users(full_name, avatar_url)), '
            'vehicles(id, brand, model, year, color, license_plate, is_active))',
          )
          .eq('trip_id', tripId)
          .eq('admin_approved', true);
      if (!mounted) return;
      final candidates = (response as List)
          .map((json) => DriverCandidateModel.fromJson(json).toEntity())
          .toList();
      setState(() => _approvedCandidates = candidates);
    } catch (e) {
      debugPrint('[KZ] Error fetching approved candidates: $e');
    }
  }
```

- [ ] **Step 5: Add `_subscribeToApprovedCandidates` method**

```dart
  void _subscribeToApprovedCandidates(String tripId) {
    final supabase = Supabase.instance.client;
    _candidatesChannel = supabase
        .channel('candidates-$tripId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'trip_driver_candidates',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'trip_id',
            value: tripId,
          ),
          callback: (_) => _fetchApprovedCandidates(tripId),
        )
        .subscribe();
  }
```

- [ ] **Step 6: Call both from `_subscribeToTripStart`**

At the end of `_subscribeToTripStart`, after `.subscribe()`:
```dart
    _subscribeToApprovedCandidates(tripId);
    _fetchApprovedCandidates(tripId);
```

- [ ] **Step 7: Replace `_onDriverAccepted(MockDriver driver)` with `Future<void> _onDriverAccepted(DriverCandidate candidate)`**

```dart
  Future<void> _onDriverAccepted(DriverCandidate candidate) async {
    setState(() => _step = TripFlowStep.driverSelected);
    try {
      await context.read<PendingConfirmationsCubit>().acceptCandidate(
            tripId: candidate.tripId,
            driverProfileId: candidate.driverProfileId,
            vehicleId: candidate.vehicleId,
            offeredPrice: candidate.offeredPrice,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Motorista ${candidate.driverName} confirmado!'),
          backgroundColor: Colors.green,
        ),
      );
      _loadScheduledTrips();
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _step = TripFlowStep.driverSelection);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao confirmar motorista: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
```

- [ ] **Step 8: Update `_onDetailsBack` — unsubscribe candidates channel and reset state**

In `_onDetailsBack`, add cleanup:
```dart
    _candidatesChannel?.unsubscribe();
    _candidatesChannel = null;
```
And in the `setState` block:
```dart
      _approvedCandidates = [],
```

Also add to `dispose()`:
```dart
    _candidatesChannel?.unsubscribe();
```

- [ ] **Step 9: Update `driverSelection` case and add `driverSelected` case in `_buildBottomPanel`**

For `driverSelection`:
```dart
      case TripFlowStep.driverSelection:
        return DriverSelectionPanel(
          key: const ValueKey('driverSelection'),
          candidates: _approvedCandidates,
          onDriverAccepted: _onDriverAccepted,
        );
```

Add `driverSelected` case:
```dart
      case TripFlowStep.driverSelected:
        return Container(
          key: const ValueKey('driverSelected'),
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(28),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: Color(0xFF22C55E), size: 48),
              const SizedBox(height: 12),
              const Text(
                'Motorista confirmado!',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.black87),
              ),
              const SizedBox(height: 6),
              const Text(
                'Aguardando motorista iniciar a corrida',
                style: TextStyle(fontSize: 14, color: Colors.black54),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
```

- [ ] **Step 10: Remove `_processConfirmationQueue` and its `BlocListener`**

Remove the `BlocListener` for `PendingConfirmationsLoaded` and the `_processConfirmationQueue` method. Also remove the `driver_candidate_popup.dart` import if no longer referenced.

- [ ] **Step 11: Run Flutter analyze**

```bash
cd C:\Projetos\kz-servicos-app-cliente
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
```
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "feat(client): real-time approved candidates, driverSelected step, remove processConfirmationQueue"
```

---

## Task 8: Flutter Driver App — Fix accept flow and start trip navigation

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\features\home\presentation\pages\home_page.dart`
- Modify: `C:\Projetos\kz-servicos-app-prestador\lib\features\schedules\presentation\pages\schedule_detail_page.dart`

### Part A: Remove direct navigation in `_onAccept`

- [ ] **Step 1: Update `_onAccept` in home_page.dart**

Replace the entire method body after `if (!ok)` with a snackbar + advance:

```dart
  Future<void> _onAccept(double price) async {
    final driverProfileId = AuthState.driverProfileId;
    if (driverProfileId == null) return;
    final request = _requests[_currentRequestIndex];
    final ok = await _tripService.acceptCandidate(
      request.tripId,
      driverProfileId,
      offeredPrice: price,
    );
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nao foi possivel aceitar a solicitacao.')),
      );
      return;
    }
    _stopPulseAnimation();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Solicitacao aceita! Acompanhe em Agendamentos.'),
        backgroundColor: Color(0xFF2ECC71),
      ),
    );
    _advanceToNextRequest();
  }
```

- [ ] **Step 2: Remove now-unused Supabase import from home_page.dart if applicable**

Check if `Supabase` is still used elsewhere. Remove if not:
```dart
import 'package:supabase_flutter/supabase_flutter.dart';
```

### Part B: Navigate to active trip from schedule detail

- [ ] **Step 3: Add `ActiveTripData` import to schedule_detail_page.dart**

```dart
import 'package:kz_servicos_prestador/features/trip/data/models/active_trip_data.dart';
```

- [ ] **Step 4: Update `_startTrip`**

```dart
  Future<void> _startTrip() async {
    setState(() => _isLoading = true);
    final ok = await _tripService.startTrip(_trip.tripId);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Erro ao iniciar viagem'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    final activeTripData = ActiveTripData(
      id: _trip.tripId,
      candidateId: '',
      clientName: _trip.clientName,
      pickupAddress: _trip.origin,
      destinationAddress: _trip.destination,
      pickupLat: _trip.originLat,
      pickupLng: _trip.originLng,
      destinationLat: _trip.destinationLat,
      destinationLng: _trip.destinationLng,
      passengerCount: _trip.passengerCount,
      offeredPrice: _trip.price,
    );
    if (!mounted) return;
    context.push('/active-trip', extra: activeTripData);
  }
```

- [ ] **Step 5: Run Flutter analyze on driver app**

```bash
cd C:\Projetos\kz-servicos-app-prestador
flutter analyze lib/features/home/presentation/pages/home_page.dart \
               lib/features/schedules/presentation/pages/schedule_detail_page.dart
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd C:\Projetos\kz-servicos-app-prestador
git add lib/features/home/presentation/pages/home_page.dart \
        lib/features/schedules/presentation/pages/schedule_detail_page.dart
git commit -m "feat(driver): show snackbar on accept, navigate to active-trip from schedule detail"
```

---

## Final Verification Checklist

1. Admin panel: trip in `searching_drivers` with `accepted` candidate shows "Aprovar para cliente" button. Click toggles `admin_approved`.
2. Client app: `DriverSelectionPanel` shows real candidates with name + price. Selecting one calls `acceptDriverCandidate`, trip moves to `scheduled`.
3. Real-time: When admin approves a candidate, it appears in the client app without a screen refresh.
4. Driver app: Accepting a candidacy shows snackbar, no direct navigation to active trip.
5. Driver app: From schedule detail, "Iniciar corrida" navigates to active trip page.
6. "Cheguei no local": Works because `driver_profile_id` is now set before driver enters active trip.
