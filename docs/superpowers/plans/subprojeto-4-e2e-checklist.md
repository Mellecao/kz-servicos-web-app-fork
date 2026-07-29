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
   - **to_stop:** badge "A caminho da parada", polyline destacada carro → próxima stop, demais stops visíveis em roxo (violet).
   - **waiting_at_stop:** badge "Parado na parada", sem polyline destacada.
   - **to_destination:** badge "A caminho do destino", polyline carro → destino, stops apagados ou em cinza/violet.
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

---

## Débitos técnicos remanescentes (do plan Task 8/10/12)

- Refresh de `_updateDriverMarker` a 60fps durante interpolação pode ser CPU-intensivo em Android low-end. Cache de `BitmapDescriptor` por bearing bucket mitiga (só primeira chamada por bucket é pesada). Monitorar em teste manual; se necessário, throttle do animator para 30fps.
- `_applyStopsLayer` chama `setState` duas vezes por update (parent + helper). Batching do Flutter cobre, mas refactor para uma única `setState` seria mais limpo.
- `trip_home_page.dart` chegou a ~4200 linhas — refatoração fora de escopo deste subprojeto.
