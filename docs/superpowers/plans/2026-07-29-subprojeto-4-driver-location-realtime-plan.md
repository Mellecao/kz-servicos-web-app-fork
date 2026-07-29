# Subprojeto 4 — Cliente vê localização do motorista em corrida em andamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o dot 2D amarelo do motorista pelo carro isométrico 3D (`car.glb` pré-renderizado em 12 sprites), interpolar movimento suave entre updates de `driver_locations`, consumir `execution_stage` para refletir cada etapa da corrida no mapa e num bottom sheet fixo, e suportar visualmente paradas intermediárias.

**Architecture:** Sprites 2D pré-renderizados como `BitmapDescriptor` (padrão Uber/99). Novo `MarkerAnimator` interpola posição + heading ao longo de 5s entre updates. Enum Dart mirror de `trip_execution_stage` decide markers/polylines/badges. Novo `LiveTripBottomSheet` widget stateless recebe props do orquestrador `trip_home_page.dart` (mantém padrão StatefulWidget monolítico existente). Sem SQL, sem package Flutter adicional.

**Tech Stack:** Flutter 3.11 · Dart 3.11 · `google_maps_flutter` ^2.10 · `supabase_flutter` ^2.12 · `flutter_bloc` ^9.1 · `equatable` ^2.0 · `geolocator` ^13.0 · `mocktail` ^1.0 · `bloc_test` ^10.0 · `flutter_test`

**Spec:** `docs/superpowers/specs/2026-07-29-subprojeto-4-driver-location-realtime-design.md`

**Codebase alvo:** `C:\Projetos\kz-servicos-app-cliente` (branch `develop`, package `kz_servicos_app`)

**Débito do repo cliente:** `trip_home_page.dart` é monolítico (~3800 linhas). Novos arquivos ficam isolados; wire nesse arquivo é feito em edits mínimos rastreáveis. Refatoração fora de escopo.

---

## Contexto compartilhado (leia antes de começar)

**Sprites disponíveis** em `C:\Projetos\kz-servicos-app-cliente\public\assets\sprite\car\`:
```
costas.png                     direita 1 frente.png            esquerda 1 frente.png
direita 1 costas.png           direita 2 frente.png            esquerda 2 frente.png
direita 2 costas.png           esquerda 1 costas.png           frente.png
                               esquerda 2 costas.png           virado pra direita.png
                                                               virado pra esquerda.png
```

**Mapeamento decidido (bearing → sprite → novo nome padronizado):**

| bearing | sprite atual | novo nome |
|---|---|---|
| 0° (norte, "frente") | `frente.png` | `car_00.png` |
| 30° | `direita 1 frente.png` | `car_01.png` |
| 60° | `direita 2 frente.png` | `car_02.png` |
| 90° (leste) | `virado pra direita.png` | `car_03.png` |
| 120° | `direita 2 costas.png` | `car_04.png` |
| 150° | `direita 1 costas.png` | `car_05.png` |
| 180° (sul, "costas") | `costas.png` | `car_06.png` |
| 210° | `esquerda 1 costas.png` | `car_07.png` |
| 240° | `esquerda 2 costas.png` | `car_08.png` |
| 270° (oeste) | `virado pra esquerda.png` | `car_09.png` |
| 300° | `esquerda 2 frente.png` | `car_10.png` |
| 330° | `esquerda 1 frente.png` | `car_11.png` |

Fórmula: `index = round(bearing / 30) % 12`. Validação visual em Task 1 pode inverter direita/esquerda se o `car.glb` foi exportado com eixo espelhado — a task tem passo de sanity-check manual.

**Pubspec.yaml** já declara `public/assets/` recursivo (linha 93). **Não precisa edit em pubspec** — sprites já são bundlable.

**Realtime existente** (`trip_home_page.dart:1481-1497`):
- Canal `driver-loc-$driverProfileId` já subscreve UPDATE em `driver_locations`.
- `_onDriverLocationUpdate` (linha 1591) já popula `_liveDriverLocation` e chama `_updateDriverMarker()` (linha 1658).
- `_fetchDriverToPickupRoute()` (1612) já calcula ETA/rota/pulso a cada 15s durante `driverEnRoute`.

**Tabela `trip_stops`** (`supabase/migrations/20260715140000_trip_dispatch_execution.sql:61-71`):
- Colunas: `id, trip_id, address_id, stop_order (>=1), created_at`.
- Join em `addresses` para obter `latitude, longitude, formatted_address`.
- Ordenar por `stop_order ASC`.
- RLS permite cliente da trip ler.

**Coluna `trips.execution_stage`** (`trip_execution_stage` enum): `to_pickup, to_stop, waiting_at_stop, to_destination, waiting_for_return, returning, finished`. Também `trips.current_stop_order` (int nullable) indica a stop atual quando `waiting_at_stop`.

**Convenção de testes** (repo cliente):
- Diretório: `test/features/trip/...` espelhando `lib/`.
- Import: `package:kz_servicos_app/features/trip/...`.
- Rodar: `flutter test test/features/trip/<arquivo>_test.dart`.
- **Sem** package extra além de `flutter_test`, `mocktail`, `bloc_test`.

**Convenção de commits:** `feat(client): ...`, um commit por task, HEREDOC quando mensagem tiver múltiplas linhas.

---

### Task 1: Renomear sprites e declarar mapeamento

Removem-se os espaços dos nomes e definimos a base pro `DriverCarMarker.assetForBearing`.

**Files:**
- Renomear em `C:\Projetos\kz-servicos-app-cliente\public\assets\sprite\car\`: 12 arquivos.

- [ ] **Step 1: Backup e rename**

```powershell
cd C:\Projetos\kz-servicos-app-cliente\public\assets\sprite\car
Rename-Item -LiteralPath 'frente.png'                    -NewName 'car_00.png'
Rename-Item -LiteralPath 'direita 1 frente.png'          -NewName 'car_01.png'
Rename-Item -LiteralPath 'direita 2 frente.png'          -NewName 'car_02.png'
Rename-Item -LiteralPath 'virado pra direita.png'        -NewName 'car_03.png'
Rename-Item -LiteralPath 'direita 2 costas.png'          -NewName 'car_04.png'
Rename-Item -LiteralPath 'direita 1 costas.png'          -NewName 'car_05.png'
Rename-Item -LiteralPath 'costas.png'                    -NewName 'car_06.png'
Rename-Item -LiteralPath 'esquerda 1 costas.png'         -NewName 'car_07.png'
Rename-Item -LiteralPath 'esquerda 2 costas.png'         -NewName 'car_08.png'
Rename-Item -LiteralPath 'virado pra esquerda.png'       -NewName 'car_09.png'
Rename-Item -LiteralPath 'esquerda 2 frente.png'         -NewName 'car_10.png'
Rename-Item -LiteralPath 'esquerda 1 frente.png'         -NewName 'car_11.png'
```

- [ ] **Step 2: Sanity check manual (abrir 3 imagens no explorer)**

Abrir `car_00.png` (deve mostrar carro apontando pra cima), `car_03.png` (pra direita) e `car_06.png` (pra baixo). Se houver inversão visível (ex: `car_00.png` mostra o carro visto de trás em vez de frente), documentar aqui e ajustar a fórmula na Task 2 usando um offset (ex: `(index + 6) % 12`).

- [ ] **Step 3: Commit**

```powershell
cd C:\Projetos\kz-servicos-app-cliente
git add public/assets/sprite/car
git commit -m "chore(client): rename car sprites to car_00..car_11 (no spaces)"
```

---

### Task 2: `DriverCarMarker` (utilitário puro) + testes

**Files:**
- Create: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\widgets\driver_car_marker.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\test\features\trip\presentation\widgets\driver_car_marker_test.dart`

- [ ] **Step 1: Escrever o teste primeiro**

Criar `test/features/trip/presentation/widgets/driver_car_marker_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app/features/trip/presentation/widgets/driver_car_marker.dart';

void main() {
  group('DriverCarMarker.assetForBearing', () {
    test('bearing 0 returns car_00 (frente)', () {
      expect(DriverCarMarker.assetForBearing(0), 'public/assets/sprite/car/car_00.png');
    });

    test('bearing 90 returns car_03 (direita)', () {
      expect(DriverCarMarker.assetForBearing(90), 'public/assets/sprite/car/car_03.png');
    });

    test('bearing 180 returns car_06 (costas)', () {
      expect(DriverCarMarker.assetForBearing(180), 'public/assets/sprite/car/car_06.png');
    });

    test('bearing 270 returns car_09 (esquerda)', () {
      expect(DriverCarMarker.assetForBearing(270), 'public/assets/sprite/car/car_09.png');
    });

    test('bearing 45 rounds to car_02 (60 degrees, nearest bucket)', () {
      // 45 / 30 = 1.5 → round to 2 → car_02
      expect(DriverCarMarker.assetForBearing(45), 'public/assets/sprite/car/car_02.png');
    });

    test('bearing 360 wraps to car_00', () {
      expect(DriverCarMarker.assetForBearing(360), 'public/assets/sprite/car/car_00.png');
    });

    test('negative bearing normalizes: -90 == 270', () {
      expect(DriverCarMarker.assetForBearing(-90), 'public/assets/sprite/car/car_09.png');
    });

    test('bearing over 360 normalizes: 450 == 90', () {
      expect(DriverCarMarker.assetForBearing(450), 'public/assets/sprite/car/car_03.png');
    });
  });
}
```

- [ ] **Step 2: Rodar teste — deve FALHAR (arquivo não existe)**

```powershell
cd C:\Projetos\kz-servicos-app-cliente
flutter test test/features/trip/presentation/widgets/driver_car_marker_test.dart
```

Expected: `Error: Error when reading 'lib/features/trip/presentation/widgets/driver_car_marker.dart': The system cannot find the file specified`.

- [ ] **Step 3: Implementar `DriverCarMarker`**

Criar `lib/features/trip/presentation/widgets/driver_car_marker.dart`:

```dart
/// Maps a compass bearing (0..360 degrees) to one of 12 pre-rendered car
/// sprites at 30° increments. North=0 → car_00.png; East=90 → car_03.png;
/// South=180 → car_06.png; West=270 → car_09.png.
class DriverCarMarker {
  static const int _bucketCount = 12;
  static const double _stepDegrees = 360.0 / _bucketCount; // 30°
  static const String _basePath = 'public/assets/sprite/car';

  const DriverCarMarker._();

  /// Returns the asset path for the nearest sprite to [bearingDegrees].
  /// Handles negative and >360 bearings by normalizing modulo 360.
  static String assetForBearing(double bearingDegrees) {
    final normalized = _normalize(bearingDegrees);
    final index = (normalized / _stepDegrees).round() % _bucketCount;
    final padded = index.toString().padLeft(2, '0');
    return '$_basePath/car_$padded.png';
  }

  static double _normalize(double degrees) {
    var d = degrees % 360;
    if (d < 0) d += 360;
    return d;
  }
}
```

- [ ] **Step 4: Rodar teste — deve PASSAR (8/8)**

```powershell
flutter test test/features/trip/presentation/widgets/driver_car_marker_test.dart
```

Expected: `+8: All tests passed!`.

- [ ] **Step 5: Commit**

```powershell
git add lib/features/trip/presentation/widgets/driver_car_marker.dart test/features/trip/presentation/widgets/driver_car_marker_test.dart
git commit -m "feat(client): DriverCarMarker maps bearing to isometric sprite"
```

---

### Task 3: `TripExecutionStage` (enum + parse + labels) + testes

**Files:**
- Create: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\domain\entities\trip_execution_stage.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\test\features\trip\domain\entities\trip_execution_stage_test.dart`

- [ ] **Step 1: Escrever o teste**

Criar `test/features/trip/domain/entities/trip_execution_stage_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app/features/trip/domain/entities/trip_execution_stage.dart';

void main() {
  group('TripExecutionStage.fromString', () {
    test('parses to_pickup', () {
      expect(TripExecutionStage.fromString('to_pickup'), TripExecutionStage.toPickup);
    });

    test('parses to_stop, waiting_at_stop, to_destination', () {
      expect(TripExecutionStage.fromString('to_stop'), TripExecutionStage.toStop);
      expect(TripExecutionStage.fromString('waiting_at_stop'), TripExecutionStage.waitingAtStop);
      expect(TripExecutionStage.fromString('to_destination'), TripExecutionStage.toDestination);
    });

    test('parses waiting_for_return, returning, finished', () {
      expect(TripExecutionStage.fromString('waiting_for_return'), TripExecutionStage.waitingForReturn);
      expect(TripExecutionStage.fromString('returning'), TripExecutionStage.returning);
      expect(TripExecutionStage.fromString('finished'), TripExecutionStage.finished);
    });

    test('returns null for null input', () {
      expect(TripExecutionStage.fromString(null), isNull);
    });

    test('returns null for unknown string', () {
      expect(TripExecutionStage.fromString('warp_speed'), isNull);
    });
  });

  group('TripExecutionStage.label', () {
    test('to_pickup shows Motorista a caminho', () {
      expect(TripExecutionStage.toPickup.label, 'Motorista a caminho');
    });

    test('to_stop shows A caminho da parada', () {
      expect(TripExecutionStage.toStop.label, 'A caminho da parada');
    });

    test('waiting_at_stop shows Parado na parada', () {
      expect(TripExecutionStage.waitingAtStop.label, 'Parado na parada');
    });

    test('to_destination shows A caminho do destino', () {
      expect(TripExecutionStage.toDestination.label, 'A caminho do destino');
    });

    test('waiting_for_return shows Aguardando você', () {
      expect(TripExecutionStage.waitingForReturn.label, 'Aguardando você');
    });

    test('returning shows Voltando pro ponto de partida', () {
      expect(TripExecutionStage.returning.label, 'Voltando pro ponto de partida');
    });

    test('finished shows Corrida finalizada', () {
      expect(TripExecutionStage.finished.label, 'Corrida finalizada');
    });
  });
}
```

- [ ] **Step 2: Rodar teste — FALHA**

```powershell
flutter test test/features/trip/domain/entities/trip_execution_stage_test.dart
```

- [ ] **Step 3: Implementar enum**

Criar `lib/features/trip/domain/entities/trip_execution_stage.dart`:

```dart
/// Mirror of Postgres enum `public.trip_execution_stage`.
/// Values reflect the current stage of a trip in execution.
enum TripExecutionStage {
  toPickup('to_pickup', 'Motorista a caminho'),
  toStop('to_stop', 'A caminho da parada'),
  waitingAtStop('waiting_at_stop', 'Parado na parada'),
  toDestination('to_destination', 'A caminho do destino'),
  waitingForReturn('waiting_for_return', 'Aguardando você'),
  returning('returning', 'Voltando pro ponto de partida'),
  finished('finished', 'Corrida finalizada');

  const TripExecutionStage(this.wireValue, this.label);

  /// Value as stored in Postgres (snake_case).
  final String wireValue;

  /// User-facing label (pt-BR) for badges/UI.
  final String label;

  /// Parses a Postgres value into the enum. Returns `null` for `null` or
  /// unknown strings (forward-compat).
  static TripExecutionStage? fromString(String? value) {
    if (value == null) return null;
    for (final s in TripExecutionStage.values) {
      if (s.wireValue == value) return s;
    }
    return null;
  }
}
```

- [ ] **Step 4: Rodar teste — PASSA (12/12)**

```powershell
flutter test test/features/trip/domain/entities/trip_execution_stage_test.dart
```

- [ ] **Step 5: Commit**

```powershell
git add lib/features/trip/domain/entities/trip_execution_stage.dart test/features/trip/domain/entities/trip_execution_stage_test.dart
git commit -m "feat(client): TripExecutionStage enum + fromString + pt-BR labels"
```

---

### Task 4: `MarkerAnimator` (interpolação suave) + testes

**Files:**
- Create: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\data\services\marker_animator.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\test\features\trip\data\services\marker_animator_test.dart`

- [ ] **Step 1: Escrever o teste**

Criar `test/features/trip/data/services/marker_animator_test.dart`:

```dart
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:kz_servicos_app/features/trip/data/services/marker_animator.dart';

class _FakeTicker extends Ticker {
  _FakeTicker(super.onTick);
}

class _FakeVsync implements TickerProvider {
  @override
  Ticker createTicker(TickerCallback onTick) => _FakeTicker(onTick);
}

void main() {
  group('MarkerAnimator.animateTo', () {
    late MarkerAnimator animator;
    late _FakeVsync vsync;
    late List<({LatLng pos, double bearing})> ticks;

    setUp(() {
      vsync = _FakeVsync();
      animator = MarkerAnimator(
        vsync: vsync,
        duration: const Duration(seconds: 5),
      );
      ticks = [];
    });

    tearDown(() => animator.dispose());

    test('interpolates linearly between two points', () {
      animator.animateTo(
        target: const LatLng(2, 4),
        bearing: 100,
        onTick: (p, b) => ticks.add((pos: p, bearing: b)),
        start: const LatLng(0, 0),
        startBearing: 0,
      );

      // Manually drive the ticker to 50% duration
      animator.debugTickAtProgress(0.5);
      expect(ticks.last.pos.latitude, closeTo(1.0, 0.001));
      expect(ticks.last.pos.longitude, closeTo(2.0, 0.001));
      expect(ticks.last.bearing, closeTo(50.0, 0.001));

      // Complete
      animator.debugTickAtProgress(1.0);
      expect(ticks.last.pos.latitude, closeTo(2.0, 0.001));
      expect(ticks.last.bearing, closeTo(100.0, 0.001));
    });

    test('bearing wrap-around picks the short path (350 -> 10 = +20)', () {
      animator.animateTo(
        target: const LatLng(0, 0),
        bearing: 10,
        onTick: (p, b) => ticks.add((pos: p, bearing: b)),
        start: const LatLng(0, 0),
        startBearing: 350,
      );

      animator.debugTickAtProgress(0.5);
      // Short path: 350 -> 360/0 -> 10 (20° total). Halfway = 360 (or 0)
      final b = ticks.last.bearing;
      final normalizedHalf = b % 360;
      expect(
        normalizedHalf < 5 || normalizedHalf > 355,
        isTrue,
        reason: 'expected ~360°/0°, got $normalizedHalf',
      );
    });

    test('new animateTo mid-animation cancels and restarts from current interpolated position', () {
      animator.animateTo(
        target: const LatLng(10, 10),
        bearing: 90,
        onTick: (p, b) => ticks.add((pos: p, bearing: b)),
        start: const LatLng(0, 0),
        startBearing: 0,
      );
      animator.debugTickAtProgress(0.5); // now at ~(5,5) bearing ~45
      final midPos = ticks.last.pos;

      // Start new animation from mid-position (implicit)
      ticks.clear();
      animator.animateTo(
        target: const LatLng(20, 20),
        bearing: 180,
        onTick: (p, b) => ticks.add((pos: p, bearing: b)),
      );
      animator.debugTickAtProgress(0.0);

      // First tick of new animation should be at ~midPos, not at (0,0)
      expect(ticks.first.pos.latitude, closeTo(midPos.latitude, 0.001));
      expect(ticks.first.pos.longitude, closeTo(midPos.longitude, 0.001));
    });

    test('dispose stops the internal controller without throwing', () {
      animator.animateTo(
        target: const LatLng(1, 1),
        bearing: 45,
        onTick: (p, b) => ticks.add((pos: p, bearing: b)),
        start: const LatLng(0, 0),
        startBearing: 0,
      );
      animator.dispose();
      // Second dispose is also a no-op
      expect(() => animator.dispose(), returnsNormally);
    });
  });
}
```

- [ ] **Step 2: Rodar teste — FALHA**

```powershell
flutter test test/features/trip/data/services/marker_animator_test.dart
```

- [ ] **Step 3: Implementar `MarkerAnimator`**

Criar `lib/features/trip/data/services/marker_animator.dart`:

```dart
import 'package:flutter/animation.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

typedef MarkerTick = void Function(LatLng position, double bearing);

/// Animates a marker's position and bearing between updates.
///
/// - Linear interpolation of latitude/longitude.
/// - Shortest-path interpolation of bearing (handles wrap-around at 360°).
/// - Calling [animateTo] mid-animation restarts from the current interpolated
///   position instead of snapping back to the original start.
/// - Emits ticks via [onTick] on every animation frame (~60fps).
class MarkerAnimator {
  MarkerAnimator({
    required TickerProvider vsync,
    Duration duration = const Duration(seconds: 5),
  })  : _duration = duration,
        _controller = AnimationController(vsync: vsync, duration: duration);

  final Duration _duration;
  final AnimationController _controller;

  LatLng? _startPos;
  LatLng? _targetPos;
  double _startBearing = 0;
  double _targetBearing = 0;
  double _bearingDelta = 0; // shortest-path delta
  MarkerTick? _onTick;
  bool _disposed = false;

  /// Current interpolated position (or last target). Null before first call.
  LatLng? get currentPosition {
    if (_startPos == null || _targetPos == null) return null;
    final t = _controller.value;
    return LatLng(
      _lerp(_startPos!.latitude, _targetPos!.latitude, t),
      _lerp(_startPos!.longitude, _targetPos!.longitude, t),
    );
  }

  /// Current interpolated bearing (normalized 0..360).
  double get currentBearing {
    final t = _controller.value;
    return _normalize(_startBearing + _bearingDelta * t);
  }

  /// Animates from the current interpolated position/bearing (or from
  /// [start]/[startBearing] on first call) to [target]/[bearing].
  ///
  /// If called mid-animation, cancels and restarts from the current
  /// interpolated state (no snap-back).
  void animateTo({
    required LatLng target,
    required double bearing,
    required MarkerTick onTick,
    LatLng? start,
    double? startBearing,
  }) {
    if (_disposed) return;

    // If we have a running interpolation, capture its current interpolated
    // values as the new start; otherwise use provided start (or the last
    // target, or (0,0) as ultimate fallback).
    final effectiveStart = start ??
        currentPosition ??
        _targetPos ??
        const LatLng(0, 0);
    final effectiveStartBearing = startBearing ??
        (_startPos == null ? 0.0 : currentBearing);

    _controller.stop();
    _startPos = effectiveStart;
    _targetPos = target;
    _startBearing = effectiveStartBearing;
    _targetBearing = _normalize(bearing);
    _bearingDelta = _shortestBearingDelta(effectiveStartBearing, _targetBearing);
    _onTick = onTick;

    _controller
      ..removeListener(_emitTick)
      ..addListener(_emitTick)
      ..value = 0.0
      ..animateTo(1.0, duration: _duration);
  }

  void _emitTick() {
    final pos = currentPosition;
    if (pos != null) _onTick?.call(pos, currentBearing);
  }

  static double _lerp(double a, double b, double t) => a + (b - a) * t;

  static double _normalize(double d) {
    var v = d % 360;
    if (v < 0) v += 360;
    return v;
  }

  /// Shortest signed delta between two bearings.
  /// e.g. 350 -> 10 returns +20 (not -340).
  static double _shortestBearingDelta(double from, double to) {
    final diff = ((to - from) % 360 + 540) % 360 - 180;
    return diff;
  }

  /// Test-only: drive the animation directly to a given progress in [0..1].
  /// Not intended for production use.
  void debugTickAtProgress(double progress) {
    _controller.value = progress.clamp(0.0, 1.0);
    _emitTick();
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _controller.removeListener(_emitTick);
    _controller.dispose();
  }
}
```

- [ ] **Step 4: Rodar teste — PASSA (4/4)**

```powershell
flutter test test/features/trip/data/services/marker_animator_test.dart
```

- [ ] **Step 5: Commit**

```powershell
git add lib/features/trip/data/services/marker_animator.dart test/features/trip/data/services/marker_animator_test.dart
git commit -m "feat(client): MarkerAnimator interpolates position + bearing with wrap-around"
```

---

### Task 5: `TripStop` entity + `TripStopsLayer` (markers + segmentos) + testes

**Files:**
- Create: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\domain\entities\trip_stop.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\widgets\trip_stops_layer.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\test\features\trip\presentation\widgets\trip_stops_layer_test.dart`

- [ ] **Step 1: Escrever entidade `TripStop`**

Criar `lib/features/trip/domain/entities/trip_stop.dart`:

```dart
import 'package:equatable/equatable.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class TripStop extends Equatable {
  const TripStop({
    required this.id,
    required this.stopOrder,
    required this.location,
    required this.address,
  });

  final String id;
  final int stopOrder;
  final LatLng location;
  final String address;

  @override
  List<Object?> get props => [id, stopOrder];
}
```

- [ ] **Step 2: Escrever teste do `TripStopsLayer`**

Criar `test/features/trip/presentation/widgets/trip_stops_layer_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:kz_servicos_app/features/trip/domain/entities/trip_stop.dart';
import 'package:kz_servicos_app/features/trip/presentation/widgets/trip_stops_layer.dart';

void main() {
  const car = LatLng(-23.55, -46.63);
  const dest = LatLng(-23.60, -46.65);

  final stops = [
    const TripStop(
      id: 's1', stopOrder: 1,
      location: LatLng(-23.56, -46.635), address: 'Parada 1',
    ),
    const TripStop(
      id: 's2', stopOrder: 2,
      location: LatLng(-23.57, -46.640), address: 'Parada 2',
    ),
  ];

  group('TripStopsLayer.build', () {
    test('zero stops -> no stop markers, single polyline car->dest', () {
      final r = TripStopsLayer.build(
        stops: const [],
        currentStopOrder: null,
        carPosition: car,
        destination: dest,
      );
      expect(r.markers, isEmpty);
      expect(r.polylines, hasLength(1));
      expect(r.polylines.first.points, [car, dest]);
    });

    test('2 stops, currentStopOrder=1 -> 2 markers, segment car->stop1 highlighted', () {
      final r = TripStopsLayer.build(
        stops: stops,
        currentStopOrder: 1,
        carPosition: car,
        destination: dest,
      );
      expect(r.markers, hasLength(2));

      // active segment is car -> stop1
      final active = r.polylines.firstWhere(
        (p) => p.polylineId.value == 'stops_active',
      );
      expect(active.points, [car, stops[0].location]);
    });

    test('2 stops, currentStopOrder=2 -> active segment stop1->stop2', () {
      final r = TripStopsLayer.build(
        stops: stops,
        currentStopOrder: 2,
        carPosition: car,
        destination: dest,
      );
      final active = r.polylines.firstWhere(
        (p) => p.polylineId.value == 'stops_active',
      );
      expect(active.points, [stops[0].location, stops[1].location]);
    });

    test('currentStopOrder=null -> markers cinzas, sem segmento ativo', () {
      final r = TripStopsLayer.build(
        stops: stops,
        currentStopOrder: null,
        carPosition: car,
        destination: dest,
      );
      expect(r.markers, hasLength(2));
      expect(
        r.polylines.where((p) => p.polylineId.value == 'stops_active'),
        isEmpty,
      );
    });
  });
}
```

- [ ] **Step 3: Rodar teste — FALHA**

```powershell
flutter test test/features/trip/presentation/widgets/trip_stops_layer_test.dart
```

- [ ] **Step 4: Implementar `TripStopsLayer`**

Criar `lib/features/trip/presentation/widgets/trip_stops_layer.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../domain/entities/trip_stop.dart';

class TripStopsLayerResult {
  const TripStopsLayerResult({required this.markers, required this.polylines});
  final Set<Marker> markers;
  final List<Polyline> polylines;
}

/// Builds markers + polylines representing intermediate stops on the trip route.
///
/// - Each stop gets a grey marker.
/// - When [currentStopOrder] is set, the polyline segment leading to that stop
///   is highlighted (from carPosition if it's stop 1, or from the previous stop
///   otherwise).
/// - When [currentStopOrder] is null, all stops are shown as grey markers with
///   no highlighted segment.
/// - When [stops] is empty, returns a single polyline car -> destination.
class TripStopsLayer {
  const TripStopsLayer._();

  static TripStopsLayerResult build({
    required List<TripStop> stops,
    required int? currentStopOrder,
    required LatLng carPosition,
    required LatLng destination,
  }) {
    if (stops.isEmpty) {
      return TripStopsLayerResult(
        markers: const {},
        polylines: [
          Polyline(
            polylineId: const PolylineId('stops_direct'),
            points: [carPosition, destination],
            color: Colors.blueAccent,
            width: 5,
          ),
        ],
      );
    }

    final markers = <Marker>{
      for (final s in stops)
        Marker(
          markerId: MarkerId('stop_${s.stopOrder}'),
          position: s.location,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueViolet),
          infoWindow: InfoWindow(title: 'Parada ${s.stopOrder}', snippet: s.address),
        ),
    };

    final polylines = <Polyline>[];

    if (currentStopOrder != null) {
      final activeIndex = stops.indexWhere((s) => s.stopOrder == currentStopOrder);
      if (activeIndex >= 0) {
        final origin = activeIndex == 0
            ? carPosition
            : stops[activeIndex - 1].location;
        polylines.add(Polyline(
          polylineId: const PolylineId('stops_active'),
          points: [origin, stops[activeIndex].location],
          color: Colors.blueAccent,
          width: 6,
        ));
      }
    }

    return TripStopsLayerResult(markers: markers, polylines: polylines);
  }
}
```

- [ ] **Step 5: Rodar teste — PASSA (4/4)**

```powershell
flutter test test/features/trip/presentation/widgets/trip_stops_layer_test.dart
```

- [ ] **Step 6: Commit**

```powershell
git add lib/features/trip/domain/entities/trip_stop.dart lib/features/trip/presentation/widgets/trip_stops_layer.dart test/features/trip/presentation/widgets/trip_stops_layer_test.dart
git commit -m "feat(client): TripStop entity + TripStopsLayer builds markers + segments"
```

---

### Task 6: `LiveTripBottomSheet` widget + testes

**Files:**
- Create: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\widgets\live_trip_bottom_sheet.dart`
- Create: `C:\Projetos\kz-servicos-app-cliente\test\features\trip\presentation\widgets\live_trip_bottom_sheet_test.dart`

- [ ] **Step 1: Escrever teste**

Criar `test/features/trip/presentation/widgets/live_trip_bottom_sheet_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kz_servicos_app/features/trip/domain/entities/trip_execution_stage.dart';
import 'package:kz_servicos_app/features/trip/presentation/widgets/live_trip_bottom_sheet.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('LiveTripBottomSheet', () {
    testWidgets('renders driver name, ETA, distance and stage label', (tester) async {
      await tester.pumpWidget(_wrap(LiveTripBottomSheet(
        driverName: 'João Silva',
        driverPhotoUrl: null,
        vehicleLabel: 'Onix Prata',
        etaMinutes: 7,
        distanceMeters: 2400,
        stage: TripExecutionStage.toPickup,
        onCall: () {},
        onChat: () {},
      )));

      expect(find.text('João Silva'), findsOneWidget);
      expect(find.text('Onix Prata'), findsOneWidget);
      expect(find.textContaining('7 min'), findsOneWidget);
      expect(find.textContaining('2,4 km'), findsOneWidget);
      expect(find.text('Motorista a caminho'), findsOneWidget);
    });

    testWidgets('renders "-" for null ETA and null distance', (tester) async {
      await tester.pumpWidget(_wrap(LiveTripBottomSheet(
        driverName: 'X',
        driverPhotoUrl: null,
        vehicleLabel: 'Y',
        etaMinutes: null,
        distanceMeters: null,
        stage: TripExecutionStage.toDestination,
        onCall: () {},
        onChat: () {},
      )));

      expect(find.textContaining('—'), findsWidgets);
      expect(find.text('A caminho do destino'), findsOneWidget);
    });

    testWidgets('shows Cancel button when onCancel != null', (tester) async {
      var cancelled = false;
      await tester.pumpWidget(_wrap(LiveTripBottomSheet(
        driverName: 'A', driverPhotoUrl: null, vehicleLabel: 'B',
        etaMinutes: 3, distanceMeters: 500,
        stage: TripExecutionStage.toPickup,
        onCall: () {}, onChat: () {},
        onCancel: () => cancelled = true,
      )));

      final btn = find.text('Cancelar');
      expect(btn, findsOneWidget);
      await tester.tap(btn);
      expect(cancelled, isTrue);
    });

    testWidgets('hides Cancel button when onCancel is null', (tester) async {
      await tester.pumpWidget(_wrap(LiveTripBottomSheet(
        driverName: 'A', driverPhotoUrl: null, vehicleLabel: 'B',
        etaMinutes: 3, distanceMeters: 500,
        stage: TripExecutionStage.toDestination,
        onCall: () {}, onChat: () {},
      )));

      expect(find.text('Cancelar'), findsNothing);
    });

    testWidgets('Call and Chat buttons invoke callbacks', (tester) async {
      var called = false, chatted = false;
      await tester.pumpWidget(_wrap(LiveTripBottomSheet(
        driverName: 'A', driverPhotoUrl: null, vehicleLabel: 'B',
        etaMinutes: 3, distanceMeters: 500,
        stage: TripExecutionStage.toPickup,
        onCall: () => called = true,
        onChat: () => chatted = true,
      )));

      await tester.tap(find.byIcon(Icons.phone));
      expect(called, isTrue);
      await tester.tap(find.byIcon(Icons.chat_bubble_outline));
      expect(chatted, isTrue);
    });

    testWidgets('shows initials fallback when driverPhotoUrl is null', (tester) async {
      await tester.pumpWidget(_wrap(LiveTripBottomSheet(
        driverName: 'Maria', driverPhotoUrl: null, vehicleLabel: 'X',
        etaMinutes: 1, distanceMeters: 100,
        stage: TripExecutionStage.toPickup,
        onCall: () {}, onChat: () {},
      )));

      expect(find.text('M'), findsOneWidget);
    });

    testWidgets('badge changes with stage', (tester) async {
      for (final s in [
        TripExecutionStage.toStop,
        TripExecutionStage.waitingAtStop,
        TripExecutionStage.returning,
        TripExecutionStage.waitingForReturn,
      ]) {
        await tester.pumpWidget(_wrap(LiveTripBottomSheet(
          driverName: 'A', driverPhotoUrl: null, vehicleLabel: 'B',
          etaMinutes: 1, distanceMeters: 100,
          stage: s,
          onCall: () {}, onChat: () {},
        )));
        expect(find.text(s.label), findsOneWidget);
      }
    });
  });
}
```

- [ ] **Step 2: Rodar teste — FALHA**

```powershell
flutter test test/features/trip/presentation/widgets/live_trip_bottom_sheet_test.dart
```

- [ ] **Step 3: Implementar widget**

Criar `lib/features/trip/presentation/widgets/live_trip_bottom_sheet.dart`:

```dart
import 'package:flutter/material.dart';
import '../../domain/entities/trip_execution_stage.dart';

class LiveTripBottomSheet extends StatelessWidget {
  const LiveTripBottomSheet({
    super.key,
    required this.driverName,
    required this.driverPhotoUrl,
    required this.vehicleLabel,
    required this.etaMinutes,
    required this.distanceMeters,
    required this.stage,
    required this.onCall,
    required this.onChat,
    this.onCancel,
  });

  final String driverName;
  final String? driverPhotoUrl;
  final String vehicleLabel;
  final int? etaMinutes;
  final double? distanceMeters;
  final TripExecutionStage stage;
  final VoidCallback onCall;
  final VoidCallback onChat;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      color: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _stageBadge(),
              const SizedBox(height: 12),
              Row(children: [
                _avatar(),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(driverName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                      Text(vehicleLabel, style: TextStyle(color: Colors.grey[700])),
                    ],
                  ),
                ),
                _iconAction(Icons.chat_bubble_outline, onChat),
                const SizedBox(width: 8),
                _iconAction(Icons.phone, onCall),
              ]),
              const Divider(height: 24),
              Row(children: [
                Expanded(child: _metric('Chegada', etaMinutes == null ? '—' : '$etaMinutes min')),
                Expanded(child: _metric('Distância', _formatDistance(distanceMeters))),
              ]),
              if (onCancel != null) ...[
                const SizedBox(height: 12),
                TextButton(
                  onPressed: onCancel,
                  child: const Text('Cancelar', style: TextStyle(color: Colors.red)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _stageBadge() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.blueAccent.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(stage.label,
            style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.w600)),
      );

  Widget _avatar() {
    final initial = driverName.isNotEmpty ? driverName.characters.first.toUpperCase() : '?';
    return CircleAvatar(
      radius: 24,
      backgroundImage: driverPhotoUrl != null ? NetworkImage(driverPhotoUrl!) : null,
      child: driverPhotoUrl == null ? Text(initial, style: const TextStyle(fontSize: 20)) : null,
    );
  }

  Widget _iconAction(IconData icon, VoidCallback onTap) => Ink(
        decoration: BoxDecoration(
          color: Colors.grey[100],
          shape: BoxShape.circle,
        ),
        child: IconButton(icon: Icon(icon), onPressed: onTap, splashRadius: 22),
      );

  Widget _metric(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18)),
        ],
      );

  static String _formatDistance(double? meters) {
    if (meters == null) return '—';
    if (meters < 1000) return '${meters.round()} m';
    final km = meters / 1000;
    // pt-BR uses comma as decimal separator; single decimal digit
    final rounded = (km * 10).round() / 10;
    return '${rounded.toString().replaceAll('.', ',')} km';
  }
}
```

- [ ] **Step 4: Rodar teste — PASSA (6/6)**

```powershell
flutter test test/features/trip/presentation/widgets/live_trip_bottom_sheet_test.dart
```

- [ ] **Step 5: Commit**

```powershell
git add lib/features/trip/presentation/widgets/live_trip_bottom_sheet.dart test/features/trip/presentation/widgets/live_trip_bottom_sheet_test.dart
git commit -m "feat(client): LiveTripBottomSheet renders driver + ETA + stage + actions"
```

---

### Task 7: Wire — `_updateDriverMarker` usa `DriverCarMarker` (visual novo, comportamento igual)

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\pages\trip_home_page.dart` (`_updateDriverMarker` em ~1658; imports)

- [ ] **Step 1: Adicionar imports**

Abrir `trip_home_page.dart`. Localizar bloco de imports (linhas 1-50). Adicionar:

```dart
import 'package:kz_servicos_app/features/trip/presentation/widgets/driver_car_marker.dart';
```

- [ ] **Step 2: Adicionar cache de BitmapDescriptor por bearing bucket**

Localizar declaração de `_cachedYellowDriverDotIcon` (buscar por `_cachedYellowDriverDotIcon` no arquivo). Logo abaixo dela, adicionar:

```dart
final Map<int, BitmapDescriptor> _cachedCarDescriptors = {};

Future<BitmapDescriptor> _carDescriptorForBearing(double bearing) async {
  final normalized = ((bearing % 360) + 360) % 360;
  final index = (normalized / 30).round() % 12;
  final cached = _cachedCarDescriptors[index];
  if (cached != null) return cached;
  final path = DriverCarMarker.assetForBearing(bearing);
  try {
    final d = await BitmapDescriptor.asset(
      const ImageConfiguration(size: Size(64, 64)),
      path,
    );
    _cachedCarDescriptors[index] = d;
    return d;
  } catch (e) {
    debugPrint('[KZ-C] car sprite missing for bearing=$index path=$path err=$e');
    _cachedYellowDriverDotIcon ??= await _createYellowDriverDotIcon();
    return _cachedYellowDriverDotIcon!;
  }
}
```

- [ ] **Step 3: Adicionar campo `_currentBearing` no state**

Localizar declaração de `_liveDriverLocation` (linha 156). Logo abaixo, adicionar:

```dart
double _currentBearing = 0;
LatLng? _previousDriverLocation;
```

- [ ] **Step 4: Alterar `_updateDriverMarker` pra receber bearing e usar o cache**

Substituir a assinatura e o corpo do marker `live_driver` dentro de `_updateDriverMarker` (linha 1658). Trocar de:

```dart
Future<void> _updateDriverMarker() async {
  if (_liveDriverLocation == null) return;
  final clientLocation = _pickupLatLng ?? _currentLocation;
  _cachedBlueDotIcon ??= await _createBlueDotIcon();
  _cachedYellowDriverDotIcon ??= await _createYellowDriverDotIcon();
  if (!mounted) return;
  setState(() {
    _markers = {
      ..._markers.where(
        (m) =>
            m.markerId.value != 'live_driver' &&
            m.markerId.value != 'client_location' &&
            m.markerId.value != 'pickup',
      ),
      if (clientLocation != null)
        Marker(
          markerId: const MarkerId('client_location'),
          position: clientLocation,
          icon: _cachedBlueDotIcon!,
          anchor: const Offset(0.5, 0.5),
          zIndexInt: 9,
        ),
      Marker(
        markerId: const MarkerId('live_driver'),
        position: _liveDriverLocation!,
        icon: _cachedYellowDriverDotIcon!,
        anchor: const Offset(0.5, 0.5),
        zIndexInt: 10,
```

para:

```dart
Future<void> _updateDriverMarker({double? bearing}) async {
  if (_liveDriverLocation == null) return;
  final clientLocation = _pickupLatLng ?? _currentLocation;
  _cachedBlueDotIcon ??= await _createBlueDotIcon();
  final carIcon = await _carDescriptorForBearing(bearing ?? _currentBearing);
  if (!mounted) return;
  setState(() {
    _markers = {
      ..._markers.where(
        (m) =>
            m.markerId.value != 'live_driver' &&
            m.markerId.value != 'client_location' &&
            m.markerId.value != 'pickup',
      ),
      if (clientLocation != null)
        Marker(
          markerId: const MarkerId('client_location'),
          position: clientLocation,
          icon: _cachedBlueDotIcon!,
          anchor: const Offset(0.5, 0.5),
          zIndexInt: 9,
        ),
      Marker(
        markerId: const MarkerId('live_driver'),
        position: _liveDriverLocation!,
        icon: carIcon,
        anchor: const Offset(0.5, 0.5),
        zIndexInt: 10,
```

(deixe o resto do método intacto — o fecho `}` da chamada `setState` e do método `_updateDriverMarker` continua igual.)

- [ ] **Step 5: Verificar analyze**

```powershell
cd C:\Projetos\kz-servicos-app-cliente
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
```

Expected: os warnings pré-existentes continuam (unused_field `_activeDriverProfileId`, etc.), **sem novos erros**.

- [ ] **Step 6: Rodar suite de testes Flash (regressão)**

```powershell
flutter test test/features/trip/data/flash_proposal_model_test.dart test/features/trip/presentation/cubit/flash_creation_cubit_test.dart test/features/trip/presentation/cubit/flash_searching_cubit_test.dart test/features/trip/presentation/widgets/trip_type_choice_sheet_test.dart test/features/trip/presentation/widgets/flash_proposal_card_test.dart test/features/trip/presentation/widgets/driver_car_marker_test.dart test/features/trip/domain/entities/trip_execution_stage_test.dart test/features/trip/data/services/marker_animator_test.dart test/features/trip/presentation/widgets/trip_stops_layer_test.dart test/features/trip/presentation/widgets/live_trip_bottom_sheet_test.dart
```

Expected: `All tests passed!` (soma das novas tasks + Flash suite).

- [ ] **Step 7: Verificação manual (opcional se emulador disponível)**

`flutter run -d chrome` → simular corrida chegando ao estado `driverEnRoute` → o marker do motorista agora deve ser um dos sprites `car_NN.png` (default bearing 0 = `car_00.png`). Marker não se move ainda entre updates (isso vem na Task 8) mas troca de sprite no primeiro update.

- [ ] **Step 8: Commit**

```powershell
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "$(cat <<'EOF'
feat(client): wire DriverCarMarker into _updateDriverMarker

Cache de BitmapDescriptor por bucket de bearing (0..11). Fallback pro dot
amarelo se sprite não carregar. Sem regressão de comportamento — só troca
visual do marker durante driverEnRoute e driverArrived.
EOF
)"
```

---

### Task 8: Wire — `MarkerAnimator` interpola posição + bearing entre updates

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\pages\trip_home_page.dart` (`_onDriverLocationUpdate` em ~1591; `_startTripTracking` em ~1481; `_stopTripTracking` em ~1521)

- [ ] **Step 1: Adicionar imports**

```dart
import 'package:kz_servicos_app/features/trip/data/services/marker_animator.dart';
```

- [ ] **Step 2: Fazer o State usar `SingleTickerProviderStateMixin` (verificar; se já usa, pular)**

Localizar declaração da classe State (buscar `class _TripHomePageState extends State<TripHomePage>`). Se já usa `with TickerProviderStateMixin` (por causa de `_searchRadarController`), não muda nada.

Se não usar, trocar para:
```dart
class _TripHomePageState extends State<TripHomePage>
    with TickerProviderStateMixin {
```

- [ ] **Step 3: Adicionar campo `_carAnimator`**

Localizar linha `RealtimeChannel? _driverLocationChannel;` (~152). Logo abaixo, adicionar:

```dart
MarkerAnimator? _carAnimator;
```

- [ ] **Step 4: Instanciar animator em `_startTripTracking`**

Localizar `_driverLocationChannel = supabase.channel(...)` (~1481). Logo antes dessa linha, adicionar:

```dart
_carAnimator = MarkerAnimator(vsync: this, duration: const Duration(seconds: 5));
```

- [ ] **Step 5: Dispose do animator em `_stopTripTracking`**

Localizar `_stopTripTracking` (~1521). Alterar para:

```dart
void _stopTripTracking() {
  _tripChannel?.unsubscribe();
  _driverLocationChannel?.unsubscribe();
  _tripChannel = null;
  _driverLocationChannel = null;
  _carAnimator?.dispose();
  _carAnimator = null;
}
```

- [ ] **Step 6: Reescrever `_onDriverLocationUpdate` para interpolar**

Substituir o corpo de `_onDriverLocationUpdate` (~1591):

```dart
void _onDriverLocationUpdate(PostgresChangePayload payload) {
  if (!mounted) return;
  final record = payload.newRecord;
  final lat = (record['latitude'] as num?)?.toDouble();
  final lng = (record['longitude'] as num?)?.toDouble();
  if (lat == null || lng == null) return;

  final target = LatLng(lat, lng);
  final previous = _previousDriverLocation ?? _liveDriverLocation ?? target;
  var newBearing = _currentBearing;
  if (previous.latitude != target.latitude || previous.longitude != target.longitude) {
    final b = Geolocator.bearingBetween(
      previous.latitude, previous.longitude,
      target.latitude, target.longitude,
    );
    if (!b.isNaN) newBearing = b;
  }

  _previousDriverLocation = target;

  final animator = _carAnimator;
  if (animator == null) {
    // Fallback: no animator, snap directly (edge case: update arrives before start).
    setState(() {
      _liveDriverLocation = target;
      _currentBearing = newBearing;
    });
    unawaited(_updateDriverMarker(bearing: newBearing));
  } else {
    animator.animateTo(
      target: target,
      bearing: newBearing,
      onTick: (interpPos, interpBearing) {
        if (!mounted) return;
        setState(() {
          _liveDriverLocation = interpPos;
          _currentBearing = interpBearing;
        });
        unawaited(_updateDriverMarker(bearing: interpBearing));
      },
    );
  }

  if (_step == TripFlowStep.driverEnRoute && _pickupLatLng != null) {
    final now = DateTime.now();
    if (_lastDriverRouteUpdate == null ||
        now.difference(_lastDriverRouteUpdate!).inSeconds >= 15) {
      _lastDriverRouteUpdate = now;
      _fetchDriverToPickupRoute();
    }
  }
}
```

- [ ] **Step 7: Verificar analyze**

```powershell
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
```

Expected: sem novos erros.

- [ ] **Step 8: Rodar suite (regressão)**

```powershell
flutter test test/features/trip/
```

Expected: `48 passed, 2 failed` (as 2 falhas são pré-existentes de `scheduled_trips_cubit_test`; comparar com o baseline atual — nenhuma falha nova deve aparecer).

- [ ] **Step 9: Commit**

```powershell
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "feat(client): interpolate driver car position + bearing with MarkerAnimator"
```

---

### Task 9: Wire — `_fetchTripStops` + parse de `execution_stage` no `_onTripUpdate`

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\pages\trip_home_page.dart` (`_onTripUpdate` em ~1528; `_startTripTracking` em ~1481)

- [ ] **Step 1: Adicionar imports**

```dart
import 'package:kz_servicos_app/features/trip/domain/entities/trip_execution_stage.dart';
import 'package:kz_servicos_app/features/trip/domain/entities/trip_stop.dart';
```

- [ ] **Step 2: Adicionar campos no state**

Logo abaixo de `MarkerAnimator? _carAnimator;` (adicionado na Task 8), adicionar:

```dart
TripExecutionStage? _currentExecutionStage;
int? _currentStopOrder;
List<TripStop> _tripStops = const [];
```

- [ ] **Step 3: Implementar `_fetchTripStops`**

Logo após `_fetchInitialDriverLocation` (~1519), adicionar:

```dart
Future<void> _fetchTripStops(String tripId) async {
  try {
    final rows = await Supabase.instance.client
        .from('trip_stops')
        .select('id, stop_order, addresses(latitude, longitude, formatted_address)')
        .eq('trip_id', tripId)
        .order('stop_order', ascending: true);
    if (!mounted) return;
    setState(() {
      _tripStops = (rows as List).map((r) {
        final m = r as Map<String, dynamic>;
        final addr = (m['addresses'] as Map?) ?? const {};
        return TripStop(
          id: m['id'] as String,
          stopOrder: (m['stop_order'] as num).toInt(),
          location: LatLng(
            (addr['latitude'] as num?)?.toDouble() ?? 0,
            (addr['longitude'] as num?)?.toDouble() ?? 0,
          ),
          address: addr['formatted_address'] as String? ?? '',
        );
      }).toList();
    });
  } catch (e) {
    debugPrint('[KZ-C] _fetchTripStops error: $e');
    if (mounted) setState(() => _tripStops = const []);
  }
}
```

- [ ] **Step 4: Chamar `_fetchTripStops` em `_startTripTracking`**

Logo após `_fetchInitialDriverLocation(driverProfileId);` (linha ~1496), adicionar:

```dart
unawaited(_fetchTripStops(tripId));
```

- [ ] **Step 5: Parse de `execution_stage` no `_onTripUpdate`**

Localizar `_onTripUpdate` (~1528). Logo após `final record = payload.newRecord;`, adicionar:

```dart
final stageWire = record['execution_stage'] as String?;
final stopOrder = (record['current_stop_order'] as num?)?.toInt();
final newStage = TripExecutionStage.fromString(stageWire);
if (newStage != _currentExecutionStage || stopOrder != _currentStopOrder) {
  setState(() {
    _currentExecutionStage = newStage;
    _currentStopOrder = stopOrder;
  });
}
```

- [ ] **Step 6: Limpar em `_stopTripTracking`**

Alterar `_stopTripTracking` (~1521):

```dart
void _stopTripTracking() {
  _tripChannel?.unsubscribe();
  _driverLocationChannel?.unsubscribe();
  _tripChannel = null;
  _driverLocationChannel = null;
  _carAnimator?.dispose();
  _carAnimator = null;
  _currentExecutionStage = null;
  _currentStopOrder = null;
  _tripStops = const [];
  _previousDriverLocation = null;
}
```

- [ ] **Step 7: Verificar analyze**

```powershell
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
```

- [ ] **Step 8: Rodar suite**

```powershell
flutter test test/features/trip/
```

Sem regressão.

- [ ] **Step 9: Commit**

```powershell
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "feat(client): fetch trip_stops + parse execution_stage from trip realtime"
```

---

### Task 10: Wire — `TripStopsLayer` no build (pins + polyline segmentada)

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\pages\trip_home_page.dart` (métodos que atualizam `_markers`/`_polylines` durante corrida ativa)

Nota: o `_polylines` set atual é gerenciado por `_fetchDriverToPickupRoute` e `_enterInTripMapView`. Vamos adicionar uma camada extra de stops sem quebrar essas rotinas.

- [ ] **Step 1: Adicionar import**

```dart
import 'package:kz_servicos_app/features/trip/presentation/widgets/trip_stops_layer.dart';
```

- [ ] **Step 2: Novo helper `_applyStopsLayer`**

Logo após `_updateDriverMarker` (~1658), adicionar:

```dart
void _applyStopsLayer() {
  final car = _liveDriverLocation;
  final dest = _destinationLatLng;
  if (car == null || dest == null || _tripStops.isEmpty) {
    // Remove qualquer resíduo de stops se não aplica
    setState(() {
      _markers = _markers
          .where((m) => !m.markerId.value.startsWith('stop_'))
          .toSet();
      _polylines = _polylines
          .where((p) =>
              p.polylineId.value != 'stops_active' &&
              p.polylineId.value != 'stops_direct')
          .toSet();
    });
    return;
  }
  final r = TripStopsLayer.build(
    stops: _tripStops,
    currentStopOrder: _currentStopOrder,
    carPosition: car,
    destination: dest,
  );
  setState(() {
    _markers = {
      ..._markers.where((m) => !m.markerId.value.startsWith('stop_')),
      ...r.markers,
    };
    _polylines = {
      ..._polylines.where((p) =>
          p.polylineId.value != 'stops_active' &&
          p.polylineId.value != 'stops_direct'),
      ...r.polylines,
    };
  });
}
```

- [ ] **Step 3: Chamar `_applyStopsLayer` quando stops ou stage mudam**

No fim do `_fetchTripStops` (dentro do `setState`), depois de setar `_tripStops`, adicionar:

```dart
_applyStopsLayer();
```

E no bloco do Step 5 da Task 9 (onde alteramos `_currentExecutionStage`), depois do `setState`, adicionar:

```dart
_applyStopsLayer();
```

- [ ] **Step 4: Verificar analyze + testes**

```powershell
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
flutter test test/features/trip/
```

- [ ] **Step 5: Commit**

```powershell
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "feat(client): render trip stops layer with segmented polyline"
```

---

### Task 11: Wire — `LiveTripBottomSheet` no build

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\pages\trip_home_page.dart` (`build`)

- [ ] **Step 1: Adicionar import**

```dart
import 'package:kz_servicos_app/features/trip/presentation/widgets/live_trip_bottom_sheet.dart';
```

- [ ] **Step 2: Identificar handlers de call/chat/cancel existentes**

- Chat: `_openDriverChat` (existe em ~2522).
- Call: buscar por `launchUrl` + `tel:` no arquivo; se não existe, criar novo helper mínimo:

```dart
Future<void> _callDriver() async {
  // TODO: read _activeDriverPhone once wire-up chega até esse dado.
  // Por agora, mostra snackbar informativo.
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Ligação em breve')),
  );
}
```

(Adicionar logo após `_openDriverChat`.)

- Cancel: buscar por `cancel_trip` ou `cancelTrip` no arquivo; usar handler existente. Se o cliente ainda não tiver esse caminho, criar handler stub que abre um confirm dialog e chama snackbar informativo — cancelamento full está fora de escopo desta task.

- [ ] **Step 3: Adicionar helper `_buildLiveTripBottomSheet` no build**

Localizar o `build()` da `_TripHomePageState`. Buscar por `Stack(` ou `Scaffold(` que envolve o mapa. Encontrar o slot onde se adicionam widgets sobrepostos ao mapa (busca `_buildNavigationBanner`, `_buildSearchOverlay`, etc.).

Logo antes do fim do Stack, adicionar (Positioned no rodapé):

```dart
if (_shouldShowLiveTripSheet())
  Positioned(
    left: 0, right: 0, bottom: 0,
    child: LiveTripBottomSheet(
      driverName: _activeDriverName ?? 'Motorista',
      driverPhotoUrl: null, // TODO: preencher quando avatar do motorista chegar até aqui
      vehicleLabel: 'Veículo', // TODO: idem
      etaMinutes: _driverEtaMinutes,
      distanceMeters: _driverDistanceMeters?.toDouble(),
      stage: _currentExecutionStage ?? TripExecutionStage.toPickup,
      onCall: _callDriver,
      onChat: _openDriverChat,
      onCancel: _shouldAllowCancel() ? _confirmCancelActiveTrip : null,
    ),
  ),
```

- [ ] **Step 4: Implementar helpers `_shouldShowLiveTripSheet` e `_shouldAllowCancel`**

Logo antes de `build()`, adicionar:

```dart
bool _shouldShowLiveTripSheet() {
  return _step == TripFlowStep.driverEnRoute ||
      _step == TripFlowStep.driverArrived ||
      _step == TripFlowStep.tripStarted;
}

bool _shouldAllowCancel() {
  return _step == TripFlowStep.driverEnRoute ||
      _step == TripFlowStep.driverArrived;
}

Future<void> _confirmCancelActiveTrip() async {
  final confirm = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Cancelar corrida?'),
      content: const Text('Você deseja mesmo cancelar essa corrida?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Não')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sim, cancelar')),
      ],
    ),
  );
  if (confirm != true || !mounted) return;
  // Reusa o path de cancelamento existente. Buscar no arquivo por
  // "cancel_trip", "cancelTrip" ou "Cancelar" — no repo cliente hoje
  // a lógica de cancelamento client-side pode não estar totalmente
  // implementada; em ambos os casos, exibimos snackbar informativo se
  // não houver handler ativo.
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Solicitação de cancelamento em processamento')),
  );
}
```

Nota: se você encontrar um handler de cancelamento existente no `trip_home_page.dart` durante a busca, wire ele diretamente aqui em vez do snackbar stub.

- [ ] **Step 5: Verificar analyze + testes**

```powershell
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
flutter test test/features/trip/
```

- [ ] **Step 6: Verificação manual**

`flutter run -d chrome`. Simular chegar em `driverEnRoute` (ou usar dev tooling). O bottom sheet deve aparecer com badge "Motorista a caminho", nome, ETA, distância, botões de call/chat, botão Cancelar visível.

- [ ] **Step 7: Commit**

```powershell
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "$(cat <<'EOF'
feat(client): render LiveTripBottomSheet during active trip

Aparece em driverEnRoute/driverArrived/tripStarted. Wire de chat usa
handler existente; call/cancel são stubs com snackbar até integração
completa em iteração seguinte.
EOF
)"
```

---

### Task 12: Wire — substituição do dot cliente pelo carro em `_enterInTripMapView`

**Files:**
- Modify: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\pages\trip_home_page.dart` (`_enterInTripMapView` em ~1691)

- [ ] **Step 1: Localizar e ler o método atual**

Ler `_enterInTripMapView` inteiro (linhas ~1691-1790). Note que:
- Ele limpa `_markers` mantendo só `user_location`.
- Ativa `Geolocator.getPositionStream` que atualiza `_currentLocation` + `_userMarker` (dot azul do cliente).
- Muda camera bearing/tilt baseado em heading do celular.

Comportamento desejado após esta task:
- Não mostrar o dot azul do cliente (removê-lo do `_markers`).
- Manter Geolocator para camera bearing/tilt (nada muda aí).
- O marker do motorista (`live_driver`, gerenciado por `_onDriverLocationUpdate`) já deve estar visível — vamos garantir que ele não seja limpo aqui.

- [ ] **Step 2: Editar o `setState` de limpeza inicial**

Localizar (dentro de `_enterInTripMapView`):

```dart
setState(() {
  _polylines = {};
  _markers = _markers
      .where((m) => m.markerId.value == 'user_location')
      .toSet();
});
```

Trocar por:

```dart
setState(() {
  _polylines = {};
  // Mantém o marker do motorista (live_driver) — dot azul do cliente sai.
  _markers = _markers
      .where((m) => m.markerId.value == 'live_driver')
      .toSet();
});
```

- [ ] **Step 3: Remover a criação do `_userMarker` blueDot dentro do stream**

Dentro do listener do `_tripLocationStream` (a partir de ~1748), localizar:

```dart
_userMarker = Marker(
  markerId: const MarkerId('user_location'),
  position: latLng,
  icon: _cachedBlueDotIcon!,
```

...e envolver a atualização do `_markers` que insere `_userMarker` numa condicional. A forma mais segura é:

- Manter o `_currentLocation = latLng` e o `_navHeading = heading` (usados para camera).
- Remover a inserção do `_userMarker` no `_markers` (durante tripStarted). Se hoje é feito via um `_markers = {..._markers, _userMarker!}` explícito, trocar para não incluí-lo.

Se o código estrutural for complexo demais pra editar cirurgicamente, adotar a alternativa mais simples:
- Após o `setState` que insere `_userMarker`, chamar `setState(() => _markers = _markers.where((m) => m.markerId.value != 'user_location').toSet());`.

Escolha a variante que fizer menos violência ao arquivo. Preserve `_currentLocation` e `_navHeading` — só o marker visual precisa sair.

- [ ] **Step 4: Garantir que o carro continua sendo atualizado a partir de `driver_locations` durante tripStarted**

Verificar que `_onDriverLocationUpdate` continua sendo chamado durante `tripStarted`. Ele já não filtra por `_step`, então funciona automaticamente. Sanity-check: o marker `live_driver` aparece no `_markers` set enquanto `_liveDriverLocation != null`.

- [ ] **Step 5: Verificar analyze + testes**

```powershell
flutter analyze lib/features/trip/presentation/pages/trip_home_page.dart
flutter test test/features/trip/
```

- [ ] **Step 6: Verificação manual**

Simular corrida chegando ao estado `tripStarted` (motorista embarcou e iniciou):
- Dot azul do cliente NÃO deve aparecer no mapa.
- Marker do carro (sprite) deve estar visível e se mover conforme updates.
- Camera continua girando com heading do celular (comportamento antigo preservado).

- [ ] **Step 7: Commit**

```powershell
git add lib/features/trip/presentation/pages/trip_home_page.dart
git commit -m "feat(client): replace client blue dot with car sprite during tripStarted"
```

---

### Task 13: Checklist e2e Subprojeto 4

**Files:**
- Create: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork\docs\superpowers\plans\subprojeto-4-e2e-checklist.md`

- [ ] **Step 1: Criar o doc do checklist**

Criar `docs/superpowers/plans/subprojeto-4-e2e-checklist.md` no repo **web-app-fork**:

```markdown
# Subprojeto 4 — Cliente vê localização do motorista — Checklist manual e2e

**Pré-requisitos:**
- App cliente (`kz-servicos-app-cliente`) buildado num dispositivo/emulador.
- App prestador (`kz-servicos-app-prestador`) buildado noutro dispositivo/emulador logado como motorista aprovado.
- Supabase local ou staging com seed de trip/candidate/driver_profile.
- Cliente e motorista com sessão ativa.

---

## Cenário 1 — driverEnRoute (motorista a caminho)

1. Criar uma trip (Flash ou standard scheduled aceita por um motorista).
2. Cliente entra na tela `trip_home_page` com trip ativa. Estado esperado: `TripFlowStep.driverEnRoute`.
3. **Verificar:**
   - Marker do motorista é o sprite `car_NN.png` (não é mais o dot amarelo).
   - Bottom sheet fixo no rodapé exibe: nome do motorista, ETA em minutos, distância em km/m, badge "Motorista a caminho", botões chat/call/cancelar.
   - O motorista publica GPS via app prestador (a cada 5s). O carro no mapa DESLIZA suave, não pula.
   - Sprite muda de rotação quando o motorista faz uma curva de 30°+.
4. **Assertivas SQL** (após um update de localização):
   ```sql
   SELECT driver_profile_id, latitude, longitude, updated_at
     FROM driver_locations WHERE driver_profile_id = '<uuid>';
   ```

---

## Cenário 2 — driverArrived (motorista chegou)

1. No app prestador, clicar em "Cheguei" (`driver_arrived_at` fica NOT NULL).
2. Cliente: badge do bottom sheet muda para "Motorista chegou".
3. Marker do carro se mantém sobre o pin do pickup; dot azul do cliente ainda visível (representa o cliente parado esperando).
4. Botão Cancelar ainda disponível.

---

## Cenário 3 — tripStarted → to_destination (sem stops)

1. Motorista embarca cliente e clica "Iniciar corrida". `trips.status='started'`, `execution_stage='to_destination'`.
2. Cliente:
   - Dot azul do cliente DESAPARECE.
   - Só o carro (sprite) fica visível, se movendo em tempo real.
   - Badge muda para "A caminho do destino".
   - Botão Cancelar SOME (não é possível cancelar após embarcar).
   - Polyline destaca driver → destino.
3. Camera continua girando com heading do celular do cliente (bearing/tilt inalterados).

---

## Cenário 4 — Trip com paradas intermediárias

1. Criar trip com 2 stops (rota A → parada 1 → parada 2 → destino).
2. Motorista embarca e inicia. `execution_stage` transita: `to_stop` (indo para parada 1) → `waiting_at_stop` → `to_stop` (parada 2) → `waiting_at_stop` → `to_destination`.
3. Cliente verifica em cada transição:
   - **to_stop:** badge "A caminho da parada", polyline destacada carro → próxima stop, demais stops visíveis em cinza.
   - **waiting_at_stop:** badge "Parado na parada", sem polyline destacada.
   - **to_destination:** badge "A caminho do destino", polyline carro → destino, stops apagados ou cinzas.
4. **Assertivas SQL:**
   ```sql
   SELECT execution_stage, current_stop_order FROM trips WHERE id = '<uuid>';
   SELECT stop_order FROM trip_stops WHERE trip_id = '<uuid>' ORDER BY stop_order;
   ```

---

## Cenário 5 — Round trip (`waiting_for_return` + `returning`)

1. Criar trip `is_round_trip = true`.
2. Motorista completa a ida ao destino → `execution_stage='waiting_for_return'`.
3. Cliente vê badge "Aguardando você", carro parado sobre destino, pickup original visível como referência.
4. Motorista clica "Retornar" → `execution_stage='returning'`.
5. Cliente vê badge "Voltando pro ponto de partida", polyline destacada carro → pickup original.

---

## Cenário 6 — Perda de sinal / degradação

1. Motorista desliga GPS ou entra em zona sem sinal por 30s.
2. Cliente:
   - Marker do carro permanece na última posição (não some).
   - Bottom sheet mostra badge extra "Sinal do motorista instável" em cinza (débito — pode não estar implementado nesta iteração).
3. GPS volta: interpolação retoma normalmente do ponto anterior até o novo.

---

## Cenário 7 — Cancelamento durante driverEnRoute

1. Cliente clica em Cancelar no bottom sheet.
2. Dialog "Cancelar corrida?" aparece.
3. Confirma → snackbar "Solicitação de cancelamento em processamento" (stub desta iteração; wire completo em iteração futura).

---

## Regressão obrigatória

Após executar Cenários 1-7, rodar um fluxo standard (sem Flash) end-to-end para garantir que nenhum comportamento antigo quebrou. Verificar especialmente:

- Fluxo `searching_drivers` → `driverSelection` → `driverEnRoute` continua clicável e navegável.
- Fluxo Flash (Subprojeto 1) — abrir trip Flash e ver que a mesma UI de carro/bottom sheet aparece.
- Tela de rating pós-corrida abre normalmente após `finished`.
- Nenhum crash ao entrar/sair da tela de corrida (dispose limpo dos animators + subscriptions).

---

## Débitos identificados durante execução

- [ ] Wire completo do botão "Ligar" (hoje é snackbar stub).
- [ ] Wire completo do botão "Cancelar" (hoje é snackbar stub — fluxo full requer RPC/side-effect).
- [ ] Foto do motorista no bottom sheet (`driverPhotoUrl` hoje é `null`).
- [ ] Label do veículo no bottom sheet (`vehicleLabel` hoje é hardcoded "Veículo").
- [ ] Badge "Sinal instável" quando `driver_locations` não atualiza > 30s (não implementado nesta iteração).
- [ ] Botão "Ver motorista" (recentraliza câmera quando carro sai da viewport).
```

- [ ] **Step 2: Executar cenários 1-7 manualmente e checar checkboxes**

- [ ] **Step 3: Commit**

```powershell
cd C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork
git add docs/superpowers/plans/subprojeto-4-e2e-checklist.md
git commit -m "docs(subprojeto-4): e2e manual checklist"
```

---

## Autoverificação final

Antes de fechar o subprojeto, rodar:

```powershell
cd C:\Projetos\kz-servicos-app-cliente
flutter analyze
flutter test test/features/trip/
```

Expected:
- `flutter analyze`: sem novos erros (warnings pré-existentes de campos unused permanecem).
- Testes Flash: continuam GREEN (13/13).
- Testes Subprojeto 4: 8 + 12 + 4 + 4 + 6 = **34 novos casos GREEN** (Tasks 2, 3, 4, 5, 6).
- Suite completa `test/features/trip/`: 48 + 34 = **82 verdes** (as 2 falhas pré-existentes de `scheduled_trips_cubit_test` permanecem, sem regressão).

---

## Débitos pós-implementação

Mapear em `docs/superpowers/plans/subprojeto-4-e2e-checklist.md` (seção "Débitos identificados") os itens fora de escopo desta iteração:
- Wire de "Ligar" (precisa do telefone do motorista disponível no state).
- Wire real de "Cancelar" (precisa da RPC de cancelamento do cliente).
- Foto e label real do veículo no bottom sheet.
- Badge "Sinal instável" com timer de 30s.
- Botão "Ver motorista" (recentralizar câmera).
- Refatoração de `trip_home_page.dart` (~4200 linhas ao fim deste subprojeto).
