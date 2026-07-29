# Subprojeto 4 — Cliente vê localização do motorista em corrida em andamento

**Data:** 2026-07-29
**Origem:** backlog dos 6 subprojetos (`docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md`, linhas 78–93).
**Codebase alvo:** `C:\Projetos\kz-servicos-app-cliente` (Flutter, BLoC/Cubit + `google_maps_flutter`).
**Contexto do backlog:** cliente deve conseguir acompanhar em tempo real onde o motorista está durante a corrida — em cada etapa (indo buscar, na parada, indo pro destino). Marker do motorista passa a ser o modelo 3D `car.glb` (fornecido pelo usuário).

---

## 1. Escopo

**Muda:**

1. Marker do motorista (hoje: dot amarelo 2D) → **carro isométrico** renderizado a partir de sprites pré-renderizados em `public/assets/sprite/car/` (12 imagens PNG cobrindo 360° a cada 30°).
2. Durante `tripStarted` (cliente já embarcou), o dot azul do cliente é **substituído** pelo mesmo carro isométrico. Fonte de posição: `driver_locations` do motorista.
3. Cliente passa a consumir `trips.execution_stage` (enum `to_pickup / to_stop / waiting_at_stop / to_destination / waiting_for_return / returning / finished`) e reflete visualmente em mapa + badge textual.
4. Paradas intermediárias (`trip_stops`) aparecem no mapa com pin próprio; polyline **segmentada** com destaque no segmento ativo.
5. Movimento do carro é **interpolado linearmente** (posição + heading) durante os ~5s entre updates de `driver_locations`.
6. Nova UI: **bottom sheet fixo** persistente com foto+nome do motorista, ETA, distância, badge de estágio, ações (ligar / chat / cancelar quando aplicável).

**Não muda:**

- SDK do mapa (`google_maps_flutter` permanece).
- Subscrição realtime `driver-loc-$driverProfileId` (só a interpretação/rendering muda).
- Enum `TripFlowStep` do cliente.
- App prestador (Subprojeto 4 é escopo cliente).

**YAGNI:**

- Sem tela nova — tudo em `trip_home_page.dart`.
- Sem package Flutter 3D — sprites 2D pré-renderizados (padrão Uber/99).
- Sem feature flag — fallback para dot amarelo se sprite não carregar.
- Sem SQL — todos os campos consumidos já existem no schema.

---

## 2. Decisões estratégicas (fechadas com o usuário)

| # | Decisão | Escolha | Alternativas descartadas |
|---|---|---|---|
| D1 | Renderização do `car.glb` | Sprite 2D pré-renderizado + rotação por bearing | Overlay 3D (`o3d`/`flutter_gl`) — frágil e caro; trocar SDK para Mapbox — rewrite gigante fora de escopo |
| D2 | Ângulo de câmera do sprite | Isométrico (~30–45°) | Top-down puro; perspectiva realista lateral |
| D3 | Número de direções | 12 (30°/step; sprites já existentes) | 8 (visualmente pulado); 16 (não disponível) |
| D4 | Fonte de posição em `tripStarted` | `driver_locations` do motorista (com interpolação) | Geolocator do cliente; fallback combinado |
| D5 | Visualização de stops | Pin de cada stop + polyline segmentada com etapa ativa destacada | Só polyline direta; pin sem segmentação |
| D6 | UI persistente | Bottom sheet fixo (~30% da tela) | Balão sobre marker; banner topo |
| D7 | Interpolação entre updates | Linear com wrap-around de bearing, ~5s por interpolação, tick a 60fps | Snap direto; fade transitório |

---

## 3. Arquitetura

### 3.1 Novos arquivos

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `lib/features/trip/presentation/widgets/driver_car_marker.dart` | Utilitário puro | Função `assetForBearing(double bearing) → String` mapeando bearing (0–360°) para asset path do sprite correto. Sem estado. |
| `lib/features/trip/data/services/marker_animator.dart` | Serviço | Anima posição+bearing entre valores. `animateTo({target, bearing, onTick})` cancelável. Wrap-around de bearing pelo caminho curto. Dispose limpo. |
| `lib/features/trip/domain/entities/trip_execution_stage.dart` | Enum Dart + parse | Mirror do enum SQL. `fromString(String?)` nullable, `label` (pt-BR) para o badge do bottom sheet. |
| `lib/features/trip/presentation/widgets/live_trip_bottom_sheet.dart` | Widget stateless | Props: `driverName, driverPhotoUrl, vehicleLabel, etaMinutes?, distanceMeters?, stage, onCall, onChat, onCancel?`. |
| `lib/features/trip/presentation/widgets/trip_stops_layer.dart` | Utilitário puro | Dado `List<TripStop>` + `currentStopOrder?`, retorna `Set<Marker>` + `List<Polyline>` (segmentos com destaque no ativo). |

### 3.2 Edits em `trip_home_page.dart` (mínimos)

- Novo campo `MarkerAnimator? _carAnimator` — instanciado em `_startTripTracking`, disposed em `_stopTripTracking`.
- Novo campo `TripExecutionStage? _currentExecutionStage` — populado no `_onTripUpdate` a partir de `record['execution_stage']`.
- Novo campo `List<TripStop> _tripStops = []` — carregado uma vez via `_fetchTripStops(tripId)` em `_startTripTracking`.
- `_updateDriverMarker` passa a receber `double bearing` como argumento e chama `DriverCarMarker.assetForBearing(bearing)` para obter o `BitmapDescriptor`. Cache de descriptors por bearing (map interno).
- `_onDriverLocationUpdate` calcula bearing via `Geolocator.bearingBetween(prev, target)` (com fallback pra bearing anterior se `NaN`) e chama `_carAnimator.animateTo(target: newPos, bearing: newBearing, onTick: (pos, brg) => setState(...))`.
- `_enterInTripMapView` (tripStarted): NÃO adiciona mais o dot azul do cliente ao markers set; deixa o `live_driver` marker (via `driver_locations`) ser o único indicador da posição.
- `build()` monta `LiveTripBottomSheet` condicionalmente para estágios `to_pickup / to_stop / waiting_at_stop / to_destination / returning`.
- `_fetchTripStops`: SELECT `trip_stops` com join em `addresses` (para `latitude/longitude/formatted_address`), ordenado por `stop_order`.

### 3.3 Fluxo de dados

```
Postgres UPDATE em driver_locations
     ↓ (canal driver-loc-$driverProfileId — já existe)
_onDriverLocationUpdate(payload)
     ↓ (calcula bearing vs. última posição salva)
_carAnimator.animateTo(target=novaPos, bearing=novoBearing)
     ↓ (60fps ticks por ~5s; interpolação linear + wrap-around)
onTick(posInterpolada, bearingInterpolado)
     ↓
setState → _updateDriverMarker(bearingInterpolado)
     ↓ (cache BitmapDescriptor por bearing bucket)
_markers set atualizado
     ↓
GoogleMap re-renderiza
```

Trilha paralela para `execution_stage`:

```
Postgres UPDATE em trips
     ↓ (canal trip-$tripId — já existe)
_onTripUpdate → parse execution_stage
     ↓
setState → _currentExecutionStage atualizado
     ↓
build() decide markers/polylines conforme tabela do §4
build() decide props do LiveTripBottomSheet.stage.label
```

---

## 4. Comportamento por `execution_stage`

| stage | Fonte posição carro | Markers no mapa | Polyline | Badge bottom sheet | Cancelar |
|---|---|---|---|---|---|
| `to_pickup` (`driver_arrived_at IS NULL`) | `driver_locations` | 🚗 carro + 🔵 dot cliente + 📍 pickup | driver → pickup (highlight) | "Motorista a caminho" | Sim |
| `to_pickup` (`driver_arrived_at IS NOT NULL`) | `driver_locations` | 🚗 carro (sobre pickup) + 🔵 dot cliente | — | "Motorista chegou" | Sim |
| `to_stop` | `driver_locations` | 🚗 carro + ⚪ próxima stop (destaque) + ⚪ demais stops cinzas + 🏁 destino | driver → próxima stop (highlight); resto apagado | "A caminho da parada" | Não |
| `waiting_at_stop` | `driver_locations` (parado) | 🚗 carro sobre stop + 🏁 destino + demais stops | — | "Parado em [endereço da stop]" | Não |
| `to_destination` | `driver_locations` | 🚗 carro + 🏁 destino | driver → destino (highlight) | "A caminho do destino" | Não |
| `waiting_for_return` (round trip) | `driver_locations` | 🚗 carro sobre destino + 📍 pickup original | — | "Aguardando você" | Não |
| `returning` | `driver_locations` | 🚗 carro + 📍 pickup original | driver → pickup original (highlight) | "Voltando pro ponto de partida" | Não |
| `finished` | — | mapa fecha; fluxo de rating | — | — | — |

**Regras derivadas:**

1. Substituição do dot cliente pelo carro **só a partir de `to_stop` (ou `to_destination` se sem stops)**. Em `to_pickup` — mesmo com `driver_arrived_at` — cliente e motorista continuam separados até a viagem começar.
2. `execution_stage IS NULL` (retrocompatibilidade com trips antigas) → tratado como `to_pickup`.
3. `execution_stage` desconhecido futuro no enum → fallback: se `started_at IS NULL` trata como `to_pickup`, senão `to_destination`.
4. Trip com stops mas `execution_stage='to_destination'` (motorista pulou waypoint) → stops cinzas continuam visíveis como referência histórica; polyline direta pro destino.
5. Botão "Cancelar" no bottom sheet só aparece em estágios pré-embarque (`to_pickup`). Reusa lógica de cancelamento cliente já existente.
6. `_fetchTripStops` roda **uma vez** por trip. Se stops mudarem em runtime (fora de escopo agora), adicionar subscription futura.

---

## 5. Erros e degradação

| Cenário | Comportamento |
|---|---|
| Sprite não carrega (asset ausente ou corrompido) | Fallback silencioso para o dot amarelo 2D (`_cachedYellowDriverDotIcon`). Log `[KZ-C] car sprite missing for bearing=X` uma vez por bearing bucket. |
| `driver_locations` sem update > 30s | Marker permanece na última posição. Badge extra "Sinal do motorista instável" (cinza) no bottom sheet. Sem bloqueio de UI. |
| `Geolocator.bearingBetween` retorna `NaN` (mesma posição) | Reusa bearing anterior. Se não houver anterior, usa `0.0` (frente = norte). |
| `_fetchTripStops` falha (rede/RLS) | Trata como zero stops. Log warning. Polyline direta driver → destino. |
| `execution_stage` desconhecido | `TripExecutionStage.fromString` retorna `null` → fallback conforme regra §4.3. |
| Subscription realtime cai | `_startTripTracking` já resubscreve no `onStatus` (comportamento existente, sem regressão). |
| App aberto com trip ativa mas `driver_locations` vazio | `_fetchInitialDriverLocation` (já existe) trata; se vazio, marker aparece no primeiro update; bottom sheet mostra "Carregando localização..." temporariamente. |
| Novo update chega durante animação em curso | `MarkerAnimator.animateTo` cancela animação corrente e recomeça a partir da posição/bearing interpolados atuais — sem "jump back". |
| Trip cancelada durante rendering | `_handleRemoteTripCancelled` (já existe) para tracking; MarkerAnimator disposed; markers removidos. Sem regressão. |

**Edge cases visuais:**

- Landscape: bottom sheet collapse pra barra fina (ETA + botões); volta ao expandido em portrait.
- Zoom out extremo: sprite mantém tamanho mínimo (comportamento default do GoogleMap).
- Carro fora da viewport: botão flutuante "Ver motorista" (recentra camera). **Fora desta iteração — anotado como débito.**

---

## 6. Testes

Estratégia: TDD em unidades puras, widget tests para componentes visuais isolados, sem testar `trip_home_page.dart` (arquivo monolítico — testar via mocks tem custo negativo hoje). ~25 testes novos totais; suite passa de 48 → 73 verdes.

| Arquivo de teste | Casos |
|---|---|
| `driver_car_marker_test.dart` | 6 casos: bearings 0/90/180/270/45(intermediário)/-90(negativo normalizado) |
| `marker_animator_test.dart` | 4 casos: interpolação linear, wrap-around bearing, cancelamento sem salto, dispose |
| `trip_execution_stage_test.dart` | 4 casos: parse válido, `null`, unknown string, `label` pt-BR |
| `trip_stops_layer_test.dart` | 3 casos: zero stops, N stops com `currentStopOrder`, `currentStopOrder=null` |
| `live_trip_bottom_sheet_test.dart` | 8 casos: renderiza nome/ETA/distância, 5 badges de stage representativos, botão Cancelar condicional, callbacks, fallback iniciais quando `driverPhotoUrl=null` |

**Verificação manual (documentada em plan):**
- Criar trip standard → `scheduled` → checar `to_pickup` visual (carro + dot + rota polyline).
- Simular UPDATE `driver_arrived_at` → badge muda para "Motorista chegou".
- Simular UPDATE `execution_stage='to_destination'` → dot cliente some, só carro visível.
- Trip com 2 stops → polyline segmentada com etapa ativa destacada.
- Round trip → checar `waiting_for_return` e `returning`.

---

## 7. Rollout e ordem de implementação

Sem SQL, sem feature flag. Rollout direto no branch — sprites com fallback pra dot 2D contém o risco.

Ordem (bite-sized, 13 tasks):

| # | Task | Testes |
|---|---|---|
| 1 | Declarar `public/assets/sprite/car/` em `pubspec.yaml`. Abrir cada imagem e definir tabela `bearing→filename` no `driver_car_marker.dart` (constantes). Decidir se renomear os assets (débito: espaços nos nomes) — recomendação: renomear para `car_00.png..car_11.png` mapeados. | — |
| 2 | `driver_car_marker.dart` (`assetForBearing`). | RED→GREEN |
| 3 | `trip_execution_stage.dart` (enum + `fromString` + `label`). | RED→GREEN |
| 4 | `marker_animator.dart` (interpolação com `TestVSync`). | RED→GREEN |
| 5 | `trip_stops_layer.dart` (markers + segmentos). | RED→GREEN |
| 6 | `live_trip_bottom_sheet.dart` (widget). | RED→GREEN |
| 7 | Wire em `trip_home_page.dart`: `_updateDriverMarker` usa `DriverCarMarker` (visual novo, comportamento igual). | Manual |
| 8 | Wire: `_carAnimator` reage ao `_onDriverLocationUpdate` (interpolação suave). | Manual |
| 9 | Wire: `_fetchTripStops` + parse de `execution_stage` no `_onTripUpdate`. | Debug prints |
| 10 | Wire: `TripStopsLayer` no build (pins + polyline segmentada). | Manual |
| 11 | Wire: `LiveTripBottomSheet` no build condicional. Actions ligadas a handlers existentes. | Manual |
| 12 | Wire: substituição do dot cliente pelo carro em `_enterInTripMapView`. | Manual |
| 13 | Documentar checklist e2e em `docs/superpowers/plans/subprojeto-4-e2e-checklist.md` e executar 5 cenários. | Manual |

Tasks 2–6 são puras — podem rodar em paralelo (subagents) para reduzir wall time.
Tasks 7–12 tocam o mesmo arquivo grande — sequenciais.

---

## 8. Riscos identificados

1. **`trip_home_page.dart` sai de ~3800 para ~4200 linhas.** Débito de refatoração em subprojeto futuro. Não bloqueia este.
2. **Espaços nos nomes dos assets** (`virado pra direita.png`). Path com espaço funciona em Flutter, mas fragiliza scripts/CI. **Mitigação:** Task 1 renomeia para `car_NN.png`.
3. **12 direções vs 16 ideais.** Curvas fechadas terão pulos visuais de 30° em vez de 22.5°. Aceitável na maioria dos casos; se ruim em teste, gerar 4 sprites adicionais (fora de escopo agora).
4. **Interpolação a 60fps em Android low-end** pode causar frame drops se GoogleMap estiver com muitos markers. **Mitigação:** throttle do animator para 30fps se necessário — validar em manual.
5. **UX embutida em `_enterInTripMapView`:** hoje ativa `Geolocator` stream do próprio cliente para bearing/tilt do mapa em modo navegação. A mudança planejada preserva o `Geolocator` **só** para camera bearing/tilt; posição do carro passa a vir de `driver_locations`. Mapa continua girando com heading do celular — comportamento consistente.
6. **Bottom sheet ~30% da tela** reduz área do mapa. Testar em Android 5" antes de finalizar altura fixa (pode ser adaptativo).

---

## 9. Fora de escopo (débitos deste subprojeto)

- Botão "Ver motorista" (recentraliza câmera quando carro sai da viewport).
- Subscription realtime em `trip_stops` (se stops mudarem depois de iniciada a corrida).
- Refatoração de `trip_home_page.dart` para arquivos menores.
- Feature flag / rollout gradual.
- Renderização 3D real (Mapbox switch, overlays `o3d`).

---

## 10. Referências

- Backlog: `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md` (linhas 78–93).
- Enum SQL: `supabase/migrations/20260715140000_trip_dispatch_execution.sql` (linhas 9–15, 191–207).
- Subscription existente: `lib/features/trip/presentation/pages/trip_home_page.dart` (linhas 1481–1497, `_onDriverLocationUpdate` em 1591–1609).
- Sprites: `C:\Projetos\kz-servicos-app-cliente\public\assets\sprite\car\` (12 PNGs).
- GLB fonte: `C:\Projetos\kz-servicos-app-cliente\public\assets\glb\car.glb`.
