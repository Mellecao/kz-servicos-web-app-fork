# Subprojeto 3 — Mapa admin de motoristas em tempo real (design)

**Data:** 2026-07-29
**Codebase alvo:** `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork` (Next.js App Router)
**Backlog:** `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md` §Subprojeto 3
**Dependência de dados:** tabela `driver_locations` (já existente, publicada em `supabase_realtime` desde a migration `20260410120026`)

---

## 1. Objetivo

Nova rota no admin (`/mapa`) com mapa em tempo real mostrando todos os motoristas **ativos** (com GPS publicado nos últimos 10 minutos). Cada motorista aparece como foto circular com border colorida indicando status (livre vs em corrida). Ao clicar, popup exibe dados do motorista, veículo e — se em corrida — link para a viagem ativa via deep-link `/viagens?openTrip=<id>`.

Objetivo operacional: dar ao admin visão geográfica instantânea da frota, sem depender de contatar cada motorista.

## 2. Escopo

**Dentro:**
- Rota nova `/mapa` sob `(dashboard)/`, gated pelo mesmo guard admin existente
- Item novo "Mapa" no `Sidebar.tsx`, posicionado entre "Viagens" e "Chats", ícone `Map` do `lucide-react`
- Google Maps JS API via `@react-google-maps/api` (chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- Marker por motorista ativo: foto circular + border verde (livre) ou azul (em corrida)
- Popup ao clicar: nome + foto grandes, veículo (`modelo · placa · cor`), badge de status, "atualizado há Xs" (auto-refresh a cada 5s), botão "Abrir viagem" se `trip_id` populado
- Header da página: título "Mapa em tempo real" + contador "X motoristas ativos" + input de busca por nome
- Busca por nome: filtro em memória; ao selecionar sugestão, câmera anima até o marker e abre o popup
- Viewport inicial: bounds fixos SP → Campinas (usuário pode dar pan/zoom depois)
- Realtime channel único (`admin-driver-locations`) inscrito em `postgres_changes` de `driver_locations`
- Timer de 60s que remove markers cujo `updated_at` já saiu da janela de 10 minutos
- Migration de RLS para SELECT admin em `driver_locations` (se ausente)
- Testes automatizados só do código puro (parser, filtros, formatter, bounds) — padrão `node:test` do admin
- Checklist e2e manual — `docs/superpowers/plans/subprojeto-3-e2e-checklist.md`

**Fora:**
- Cluster de markers em zoom baixo (Google Marker Clusterer) — só vira necessário com >50 simultâneos
- Trail/histórico das últimas posições
- Filtro por status (livre/em corrida) — decidido conscientemente
- Lista lateral de motoristas — decidido conscientemente
- Heatmap de densidade
- Métricas agregadas (tempo médio de resposta, etc.)
- Iconografia por categoria de veículo
- Suporte a mais de um `vehicle` por motorista (usa `is_primary = true`)

## 3. Decisões de design

| Decisão | Valor | Razão |
|---|---|---|
| Escopo de motoristas | `updated_at > now() - 10 min` AND `provider_profiles.status = 'approved'` | Foco em quem realmente está trabalhando agora; evita polução visual com offline |
| Lib de mapa | `@react-google-maps/api` (Google Maps JS SDK) | Consistência com apps Flutter (Google Maps SDK); fatura GCP consolidada |
| Refresh strategy | Realtime channel único (`postgres_changes` `*` em `driver_locations`) | Mesmo padrão do `/viagens/page.tsx`; latency ~500ms; sem polling |
| Marker visual | Foto circular do motorista + border colorida por status | Reconhecimento imediato de quem é cada ponto |
| Popup | Nome+foto, veículo, status, última atualização, link viagem | Suficiente pra ação operacional; sem overload |
| Controles | Só busca por nome | YAGNI — sem lista lateral, sem filtro de status |
| Viewport inicial | Bounds fixos SP→Campinas | Previsível, sem casos de borda |
| Item sidebar | "Mapa" entre Viagens e Chats | Contexto operacional |

## 4. Arquitetura

### 4.1 Estrutura de arquivos

```
src/app/(dashboard)/mapa/
  page.tsx                       # Server component (auth guard herdado do layout)
  MapaClient.tsx                 # Client component principal (state + realtime + render)

src/components/mapa/
  DriverMarker.tsx               # OverlayView ancorado em lat/lng com foto + border
  DriverPopup.tsx                # InfoWindow content
  DriverSearchInput.tsx          # Combobox com autocomplete (filtra state em memória)
  ActiveDriverCounter.tsx        # Stateless "X motoristas ativos"

src/lib/
  driver-locations.ts            # fetchActiveDrivers() + parseActiveDriverRow()
  driver-locations.test.ts       # unit tests puros
  google-maps-config.ts          # bounds SP→Campinas, libraries const, API key check
  mapa-bounds.test.ts            # bounds cobrem pontos de referência
  time-ago.ts                    # "há Xs" formatter (pt-BR)
  time-ago.test.ts               # unit tests

src/types/database.ts            # +ActiveDriverLocation interface

src/components/Sidebar.tsx       # +item "Mapa"
.env.local.example               # +NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
package.json                     # +@react-google-maps/api
```

**Responsabilidades:**
- `MapaClient.tsx`: orquestra state, subscription realtime, timer de expiração; delega toda apresentação
- `DriverMarker.tsx`, `DriverPopup.tsx`, `DriverSearchInput.tsx`, `ActiveDriverCounter.tsx`: apresentação pura (props in, JSX out) — mockáveis
- `driver-locations.ts`, `time-ago.ts`, `google-maps-config.ts`: funções puras — testáveis com `node:test`

### 4.2 Modelo de dados

**Nova interface** em `src/lib/driver-locations.ts` (co-localizada com o parser):

```typescript
export interface ActiveDriverLocation {
  driverProfileId: string;
  fullName: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  updatedAt: string; // ISO
  tripId: string | null; // populado → em corrida
  vehicle: {
    brand: string;
    model: string;
    color: string;
    licensePlate: string;
  } | null;
}
```

### 4.3 Query inicial

```sql
SELECT dl.driver_profile_id,
       dl.latitude, dl.longitude, dl.heading,
       dl.trip_id, dl.updated_at,
       u.full_name, u.avatar_url,
       v.brand, v.model, v.license_plate, v.color, v.is_active, v.updated_at
  FROM driver_locations dl
  JOIN driver_profiles dp ON dp.id = dl.driver_profile_id
  JOIN provider_profiles pp ON pp.id = dp.provider_profile_id
  JOIN users u ON u.id = pp.user_id
  LEFT JOIN vehicles v ON v.driver_profile_id = dp.id
 WHERE dl.updated_at > now() - INTERVAL '10 minutes'
   AND pp.status = 'approved'
```

Executada via Supabase client no client component (após auth handshake). Retorna `ActiveDriverLocation[]`.

**Nota de implementação (confirmada durante o plan):** `vehicles` **não tem** coluna `is_primary`. Colunas reais: `brand, model, year, color, license_plate, is_active, category`. O parser (`parseActiveDriverRow`) filtra `is_active = true` e escolhe o veículo com `updated_at` mais recente.

### 4.4 Realtime

Padrão idêntico ao `src/app/(dashboard)/viagens/page.tsx:148-198`:

```typescript
const channel = supabase
  .channel('admin-driver-locations')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'driver_locations' },
      (payload) => handleDriverLocationChange(payload))
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

**Handler:**
- `INSERT` ou `UPDATE`: se `driver_profile_id` já está em state → merge posição/heading/trip_id/updated_at; se novo → fetch pontual dos joins (nome/foto/veículo) via helper `fetchDriverMeta(driverProfileId)`, então insere no state
- `DELETE`: remove por `driver_profile_id`

Metadados (nome, foto, veículo) são cacheados indefinidamente em `Map<driverProfileId, DriverMeta>` — reduz round-trips quando o mesmo motorista publica muitos updates.

### 4.5 Timer de expiração

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    setDrivers(prev => prev.filter(d => Date.now() - new Date(d.updatedAt).getTime() < 10 * 60 * 1000));
  }, 60_000);
  return () => clearInterval(interval);
}, []);
```

Sem esse timer, motorista que fica offline permanece no mapa até o próximo evento realtime (que pode nunca chegar).

### 4.6 Viewport

Constante em `google-maps-config.ts`:

```typescript
export const SP_CAMPINAS_BOUNDS = {
  south: -23.75, // abaixo de SP capital
  north: -22.83, // acima de Campinas
  west: -47.20,  // oeste de Campinas
  east: -46.30,  // leste da região metropolitana de SP
};
```

Cobre SP capital (-23.55, -46.63), Guarulhos, Osasco, Jundiaí e Campinas (-22.90, -47.06). Aplicado via `map.fitBounds()` no `onLoad` do `GoogleMap`.

### 4.7 Marker visual

`DriverMarker.tsx` usa `OverlayView` do `@react-google-maps/api` (não `Marker`, pra permitir HTML custom):

```jsx
<div className="w-10 h-10 rounded-full border-4"
     style={{ borderColor: tripId ? '#3B82F6' : '#22C55E' }}>
  {avatarUrl
    ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover" />
    : <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center">
        <UserIcon className="w-6 h-6 text-gray-600" />
      </div>
  }
</div>
```

Clique → seta `selectedDriverId` no `MapaClient` → renderiza `InfoWindow` com `DriverPopup`.

### 4.8 Popup

`DriverPopup.tsx` recebe `ActiveDriverLocation` e renderiza:
- Header: foto grande (64px) + nome
- Corpo: `{brand} {model} · {licensePlate} · {color}` (ou "Veículo não cadastrado" se `vehicle` null)
- Badge de status ("Livre" verde / "Em corrida" azul)
- Linha "Atualizado há Xs" — calculada com `time-ago.ts`, re-renderiza via `useEffect` com `setInterval(5s)` local
- Se `tripId`: `<Link href={`/viagens?openTrip=${tripId}`}>Abrir viagem →</Link>`

### 4.9 Busca por nome

`DriverSearchInput.tsx`:
- Input controlado
- Autocomplete: filtra `drivers` do state por `fullName.toLowerCase().includes(query.toLowerCase())`
- Sugestões renderizadas em dropdown
- Ao clicar: `onSelect(driverProfileId)` → parent chama `map.panTo({lat, lng})` + `map.setZoom(15)` + `setSelectedDriverId(id)`

## 5. Segurança

**Chave Google Maps** — inevitavelmente exposta ao cliente (`NEXT_PUBLIC_*`). Defesas:
- Restrição por HTTP referrer no console GCP (só domínio prod + `localhost`)
- Escopo restrito à "Maps JavaScript API" (sem Places, Directions, Geocoding)
- Documentado em `.env.local.example` com comentário sobre a restrição obrigatória

**RLS em `driver_locations`** — verificar `.github/skills/kz-database/references/rls-policies.md` durante writing-plans. Se admin não tem `SELECT`, adicionar migration:

```sql
CREATE POLICY "admins_can_read_all_driver_locations"
  ON public.driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
       WHERE users.id = auth.uid()
         AND users.role = 'admin'
    )
  );
```

O exato nome da coluna que discrimina admin (`users.role`, `users.is_admin`, tabela separada) deve ser confirmado ao escrever o plano — o padrão exato entra no plano, não neste spec.

**Realtime subscription** herda a policy — Supabase Realtime respeita RLS quando o filtro está publicado, sem vazamento.

**Route guarding** — reuso do `(dashboard)/layout.tsx`, sem código adicional.

**Advisor pós-migration** — rodar `mcp__supabase__get_advisors` após aplicar policy nova (mesma disciplina do Flash).

## 6. Testes automatizados

Padrão `node:test` do admin — só código puro.

**`src/lib/driver-locations.test.ts`:**
- `parseActiveDriverRow` normaliza row cru (snake_case + joins aninhados) para `ActiveDriverLocation` camelCase
- Nulos: `avatar_url` null → propaga null (marker usa fallback); veículo ausente → `vehicle: null`
- Row com `provider_profiles.status !== 'approved'` é filtrada (defesa em profundidade)

**`src/lib/time-ago.test.ts`:**
- 0-59s → "agora"
- 60-3599s → "há Xm"
- ≥ 3600s → "há X h"
- Retorna sempre pt-BR

**`src/lib/mapa-bounds.test.ts`:**
- Bounds SP→Campinas contêm pontos de referência (SP centro `-23.55, -46.63`, Guarulhos `-23.46, -46.53`, Osasco `-23.53, -46.79`, Campinas centro `-22.90, -47.06`)
- Bounds NÃO contêm RJ centro (`-22.90, -43.20`) nem BH (`-19.91, -43.94`)

**Fora do escopo automatizado** (vira e2e manual):
- `MapaClient` integração
- `DriverMarker`/`DriverPopup` render visual
- Realtime channel handler
- Google Maps SDK

## 7. Checklist e2e manual

Arquivo: `docs/superpowers/plans/subprojeto-3-e2e-checklist.md` (gerado no plano, task final)

**Pré-requisitos:**
- `.env.local` com `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` válida
- Migration da RLS aplicada
- Admin logado; ≥2 motoristas aprovados publicando GPS via app prestador

**Cenários mínimos:**
1. **Motorista aparece** — motorista publica GPS → marker aparece no mapa em <2s
2. **Motorista offline** — motorista para de publicar por >10min → marker some (aguardar ≥1min pra timer rodar)
3. **Motorista aceita trip** — border verde → azul; popup mostra botão "Abrir viagem"; clique navega para `/viagens?openTrip=<id>`
4. **Motorista finaliza trip** — border azul → verde; botão "Abrir viagem" some
5. **Busca por nome** — digitar nome parcial → sugestão aparece → clicar centraliza câmera + abre popup
6. **Sem motoristas ativos** — mapa carrega em bounds SP→Campinas, contador "0 motoristas ativos"
7. **Deep link `/viagens?openTrip=`** — botão do popup navega e abre o modal da trip corretamente (regressão do padrão existente)

**Regressão obrigatória:**
- Fluxo `/viagens` continua carregando e recebendo realtime
- Nenhuma outra rota admin quebra por conta de nova dependência `@react-google-maps/api`
- Sidebar renderiza sem overflow com o novo item

## 8. Rollout

1. Adicionar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` em dev local + Vercel (dev/preview/prod)
2. Merge do PR — a rota fica gated apenas por `role=admin` do layout `(dashboard)`
3. Sem feature flag: escopo isolado, não afeta cliente/prestador
4. Se algo quebrar, rollback do PR resolve integralmente

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Custo Maps JS API (~$7/1k loads) | Admin com ~10 sessões/dia → ~$2/mês. Baixo. Monitorar via GCP billing. |
| Volume realtime em pico (200+ motoristas × 5s) | `React.memo` no `DriverMarker` + `useMemo` na lista derivada. Se ainda pesado, throttle no handler (agrupar em janelas de 500ms). |
| Marker "congelado" se timer falhar | Reload da página resolve. Aceitável em V1. |
| Chave Maps vazando | Referrer restriction no GCP é a única defesa; documentar no README. |
| RLS ausente para admin em `driver_locations` | Migration nova entra no plano; advisor Supabase confirma pós-apply. |
| Vehicle join errado (`is_primary` pode não existir) | Confirmar schema no plano; fallback `vehicles[0]` por driver_profile_id. |

## 10. Fora do escopo (backlog futuro)

- Marker clusterer (>50 motoristas simultâneos)
- Trail de últimas posições
- Filtro por status (livre/em corrida)
- Lista lateral
- Heatmap de densidade
- Métricas agregadas no header
- Iconografia por categoria de veículo
- Suporte a múltiplos `vehicles` por motorista

## 11. Referências

- Backlog: `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md` §Subprojeto 3
- Sidebar: `src/components/Sidebar.tsx`
- Padrão realtime: `src/app/(dashboard)/viagens/page.tsx:148-198`
- Schema `driver_locations`: `supabase/migrations/20260410120019_create_driver_locations_table.sql`
- Realtime publication: `supabase/migrations/20260410120026_publish_driver_locations_realtime.sql`
- Tipos DB: `src/types/database.ts`
- Deep-link viagens: `/viagens?openTrip=<id>` (padrão existente)
- Subprojeto 4 (contexto adjacente): `docs/superpowers/specs/2026-07-29-subprojeto-4-driver-location-realtime-design.md`
