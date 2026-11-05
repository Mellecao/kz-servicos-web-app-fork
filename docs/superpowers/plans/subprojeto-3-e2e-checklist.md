# Subprojeto 3 — Mapa admin de motoristas em tempo real — Checklist manual e2e

**Pré-requisitos:**
- `.env.local` do admin com `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` válida (HTTP referrer restriction configurado no GCP para `localhost:3000` em dev).
- App admin (`kz-servicos-web-app-fork`) rodando (`npm run dev`).
- App prestador (`kz-servicos-app-prestador`) buildado em ≥2 dispositivos/emuladores, ambos logados como motoristas aprovados publicando GPS.
- Supabase local ou staging.

---

## Cenário 1 — Motorista aparece no mapa

1. Admin autenticado abre `/mapa` no menu lateral.
2. Verificar:
   - Sidebar destaca "Mapa" como ativo.
   - Header mostra "Mapa em tempo real" + contador "X motoristas ativos".
   - Mapa renderiza cobrindo SP → Campinas por default.
3. Motorista 1 publica GPS pela primeira vez (app prestador).
4. **Assertiva:** marker aparece no mapa em <5s (fetch inicial + realtime combinado).
5. Border do marker é verde (motorista livre, sem trip).

### Assertiva SQL

```sql
SELECT driver_profile_id, latitude, longitude, updated_at, trip_id
  FROM driver_locations
 WHERE updated_at > now() - INTERVAL '10 minutes'
   AND driver_profile_id = '<uuid-motorista-1>';
```

Esperado: 1 linha, `trip_id IS NULL`.

---

## Cenário 2 — Motorista fica offline

1. A partir do estado do Cenário 1, parar app prestador do Motorista 1 (kill process).
2. Aguardar >10min sem publicações.
3. Ao próximo tick do timer de expiração (60s), marker some do mapa.
4. Contador do header decrementa.

---

## Cenário 3 — Motorista aceita corrida (verde → azul)

1. Motorista 1 aceita uma trip (`trip_driver_candidates.status='accepted'` → prestador começa a publicar `driver_locations.trip_id`).
2. **Assertiva:** border do marker muda de verde → azul em <5s.
3. Clicar no marker → popup abre.
4. Popup mostra botão "Abrir viagem →".
5. Clicar no botão → navega para `/viagens?openTrip=<trip_id>` e abre o `TripDetailModal` da trip correta.

### Assertiva SQL

```sql
SELECT trip_id FROM driver_locations WHERE driver_profile_id = '<uuid-motorista-1>';
```

Esperado: `trip_id` populado com o UUID da corrida aceita.

---

## Cenário 4 — Motorista finaliza corrida (azul → verde)

1. Continuando do Cenário 3, motorista chega ao destino e clica "Finalizar" no app prestador.
2. `trips.status='finished'`, `driver_locations.trip_id` volta a NULL (a lógica de nullify já existe no prestador — se não voltar automaticamente, é bug separado).
3. **Assertiva:** border volta a verde em <5s.
4. Reabrir popup: botão "Abrir viagem" desaparece.

---

## Cenário 5 — Busca por nome

1. Admin digita parte do nome de Motorista 1 no input de busca (mínimo 2 caracteres).
2. Dropdown mostra sugestões filtradas.
3. Clicar em uma sugestão:
   - Câmera anima até o marker (`panTo` + `setZoom(15)`).
   - Popup abre automaticamente com dados do motorista.

---

## Cenário 6 — Popup: dados completos

Abrindo popup de qualquer motorista, verificar presença de:
- Foto grande (64px) ou inicial do nome se `avatar_url` ausente.
- Nome completo.
- Badge de status verde ("Livre") ou azul ("Em corrida").
- Veículo: `{brand} {model} · {license_plate} · {color}` OU "Veículo não cadastrado".
- Linha "Atualizado há Xs" que atualiza a cada 5s enquanto o popup está aberto.
- Se em corrida: botão "Abrir viagem →" com link correto.

---

## Cenário 7 — Zero motoristas ativos

1. Nenhum motorista publicando GPS na janela de 10min.
2. Página carrega em bounds SP→Campinas.
3. Contador mostra "0 motoristas ativos".
4. Busca não retorna sugestões.
5. Sem erros no console.

---

## Regressão obrigatória

Após Cenários 1-7, rodar smoke test dos fluxos que compartilham infraestrutura:

- [ ] `/viagens` continua carregando e recebendo realtime na tabela `trips` (não conflita com o novo canal `admin-driver-locations`).
- [ ] `/motoristas` lista carrega normal.
- [ ] Sidebar não quebrou visualmente com o novo item (verificar largura do sidebar em viewport md+).
- [ ] Deep-link `/viagens?openTrip=<id>` continua abrindo o modal (padrão existente).
- [ ] Nenhum outro build/lint quebrado por conta do novo dep `@react-google-maps/api`.

---

## Débitos identificados (podem ficar para pós-GA)

- [ ] Cluster de markers (Google Marker Clusterer) para >50 motoristas simultâneos.
- [ ] Trail/histórico das últimas N posições do motorista.
- [ ] Filtro por status (livre/em corrida) — decidido conscientemente ficar fora.
- [ ] Lista lateral de motoristas ativos — decidido conscientemente ficar fora.
- [ ] Heatmap de densidade.
- [ ] Métrica "tempo médio de resposta" agregada no header.
- [ ] Handler de realtime sob throttle (agrupar updates em janela de 500ms) — só implementar se profiling mostrar problema com muitos motoristas.

---

## Follow-ups identificados no final review

Itens surfados pelo holistic review pós-Task 13. Não bloqueantes; ficam como próximas iterações:

- [ ] **DELETE-vs-upsert race em `MapaClient`** (`src/app/(dashboard)/mapa/MapaClient.tsx:62-88`). Se um `DELETE` chega enquanto um `fetchDriverMeta` de UPDATE anterior está pendente, o driver reaparece como "ghost marker" até o próximo tick de expiração (60s). Mitigação: manter um `Set<string>` de IDs recém-deletados e ignorar upserts dentro de uma janela curta, OU re-verificar existência antes do `setDrivers`. Impacto atual: baixo — o timer de 10min limpa naturalmente.
- [ ] **`pixelOffset` construído no render de `DriverPopup`** (`src/components/mapa/DriverPopup.tsx:31`). Hoje é seguro porque `DriverPopup` só monta quando `isLoaded=true`, mas o acoplamento é implícito. Mover para `useMemo` guardado por `typeof google !== 'undefined'` deixa a segurança explícita.
- [ ] **Script npm para rodar testes** — `tsx` foi adicionado como devDep mas não há script em `package.json` explicitando o padrão. Adicionar `"test:lib": "node --import tsx --test src/lib/*.test.ts"` reduz atrito pra próximos devs.

---

## Execução

- [ ] Cenário 1 — Motorista aparece
- [ ] Cenário 2 — Motorista offline
- [ ] Cenário 3 — Aceita corrida (verde → azul)
- [ ] Cenário 4 — Finaliza corrida (azul → verde)
- [ ] Cenário 5 — Busca por nome
- [ ] Cenário 6 — Popup completo
- [ ] Cenário 7 — Zero motoristas
- [ ] Regressão obrigatória
- [ ] Registrar bugs em `docs/superpowers/plans/subprojeto-3-e2e-bugs.md` (criar sob demanda)
