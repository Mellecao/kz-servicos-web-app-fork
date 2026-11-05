# Subprojeto 2A — Corrida Agendada: Fundação + Cotação + Falar com Akira (design)

**Data:** 2026-07-29
**Codebases:**
- App cliente Flutter: `C:\Projetos\kz-servicos-app-cliente` (BLoC/Cubit)
- Admin Next.js: `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork`
- Migrations Supabase: `supabase/migrations/` no admin repo

**Backlog referência:** `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md` §Subprojeto 2 e §Subprojeto 5.

**Decomposição do escopo original 2+5:** este é o **primeiro de 3** sub-projetos independentes:
- **2A (este spec):** fundação — enum `trip_type` estendido, entry screen do cliente redesenhado, Cotação reusando fluxo standard, card admin de override, badge/filtro Cotação, botão "Falar com Akira" que dispara WhatsApp
- **2B (futuro):** Escolha seu Motorista (lista, chat prévio, dispatch direto, RPCs, prestador side)
- **5 (futuro):** substitui/aprimora canal Akira (opcional: `support_chat` interno em vez de WhatsApp)

---

## 1. Objetivo

Adicionar ao app cliente uma nova opção "Corrida Agendada" que, ao ser tocada, apresenta em cascata as modalidades **Cotação** (fluxo scheduled atual, disponível 07-20h SP com override admin) e — desabilitado neste sub-projeto — Escolha seu Motorista. Quando Cotação está indisponível, aparece com destaque um botão **"Falar com o Akira"** que abre WhatsApp direto. Admin ganha um card no Dashboard para forçar Cotação ON/OFF/Auto.

Objetivo estratégico: preparar o terreno (schema, entry UI, discriminator `trip_type`) para os fluxos scheduled futuros.

## 2. Escopo

**Dentro:**
- Migration adicionando `'scheduled_quote'` e `'scheduled_choose_driver'` ao enum `trip_type` (2B usa o segundo)
- Migration seed `system_settings.scheduled_quote_admin_override` = `'auto'` + policy SELECT permissiva pra essa chave
- Migration RPC `set_scheduled_quote_override(new_value)` SECURITY DEFINER admin-only
- App cliente: novo widget `ScheduledModeChoiceSheet` aberto em cascata após "Corrida Agendada"
- App cliente: função pura `computeQuotationAvailability(now, override)` + fetch cache 60s do override
- App cliente: botão "Falar com o Akira" → `launchUrl('https://wa.me/5511985889577')`
- App cliente: Cotação selecionada segue fluxo scheduled atual; só grava `trip_type='scheduled_quote'`
- Admin: `QuotationOverrideCard` no `/dashboard` com estado atual + 3 botões (Auto / Forçado ON / Forçado OFF)
- Admin: filtro "Cotação" no Kanban `/viagens` (padrão do filtro Flash)
- Admin: badge 💰 em cards `trip_type='scheduled_quote'`
- Testes automatizados: função pura duplicada Dart + TypeScript (5 casos cada)
- Checklist e2e manual

**Fora:**
- Opção "Escolha seu Motorista" no sub-sheet (chega no 2B)
- Chat interno com Akira (`support_chat`) — 2A entrega só WhatsApp launchUrl
- Push notif especial para prestador em `scheduled_quote` — mesmo fluxo scheduled atual
- Rota `/configurações` no admin — card do dashboard é suficiente por ora
- Realtime do override no cliente — cache 60s é suficiente
- Admin configurar `startHour`/`endHour` — hardcoded 07-20h (override kill switch atende "operar fora do horário")
- Rebranding de trips `standard` existentes para `scheduled_quote` — enum retrocompatível

## 3. Decisões de design

| Decisão | Valor | Razão |
|---|---|---|
| Estrutura entry | 2 níveis (`TripTypeChoiceSheet` → `ScheduledModeChoiceSheet`) | Alinha com o texto do backlog original; mantém tela principal enxuta |
| `trip_type` enum | Adicionar valores novos, não renomear `standard` | Sem migração de dados, retrocompatível |
| Janela horária | Hardcoded 07-20h `America/Sao_Paulo` + override em `system_settings` | Simples pra V1; admin tem kill switch sem deploy |
| Toggle admin | Card no `/dashboard` | Sem rota nova; escalável se surgirem mais settings |
| Cotação OFF UX | Botão cinza-desabilitado + Akira em destaque | Preserva descoberta da feature |
| Fluxo Cotação | Reusa 100% o fluxo scheduled atual | YAGNI; discriminator via `trip_type` |
| Akira canal | `launchUrl('https://wa.me/5511985889577')` | Entrega valor imediato; Subprojeto 5 substitui por chat interno depois |
| Duplicação lógica de disponibilidade | Função pura gêmea em Dart e TS | Custo aceitável; evita RPC round-trip só pra decidir UI |

## 4. Arquitetura

### 4.1 Estrutura de arquivos

**App cliente Flutter:**

```
lib/features/trip/
  domain/quotation_availability.dart          # NEW: função pura + enum
  domain/quotation_availability_test.dart     # NEW: unit tests
  data/system_settings_repository.dart        # NEW: fetch override + cache 60s
  presentation/widgets/
    trip_type_choice_sheet.dart               # MODIFY: preserva 2 opções; documentar cascata
    scheduled_mode_choice_sheet.dart          # NEW: sub-sheet
  presentation/pages/
    trip_home_page.dart                       # MODIFY: _openSearch roteia trip_type
lib/core/config/
  akira_whatsapp.dart                         # NEW: const AKIRA_WHATSAPP_E164 = '5511985889577'
pubspec.yaml                                  # +timezone, +url_launcher (se ausentes)
```

**Admin Next.js:**

```
src/app/(dashboard)/dashboard/
  page.tsx                                    # MODIFY: renderizar <QuotationOverrideCard/>
  QuotationOverrideCard.tsx                   # NEW: client component
src/lib/
  quotation-availability.ts                   # NEW: gêmea da função Dart
  quotation-availability.test.ts              # NEW: node:test
  system-settings.ts                          # NEW: helpers Supabase (fetch + RPC call)
src/app/(dashboard)/viagens/
  page.tsx                                    # MODIFY: filtro Cotação
  <existing badge/filter components>          # MODIFY: badge 💰 scheduled_quote
```

**Supabase migrations** (`supabase/migrations/`):

```
NNNNNNNNNNNN_scheduled_quote_trip_types.sql        # ALTER TYPE trip_type ADD VALUE ×2
NNNNNNNNNNNN_scheduled_quote_settings.sql          # INSERT seed + CREATE POLICY
NNNNNNNNNNNN_set_scheduled_quote_override_rpc.sql  # RPC SECURITY DEFINER
```

### 4.2 Função pura de disponibilidade

Interface idêntica em Dart e TypeScript:

**Dart (`quotation_availability.dart`):**

```dart
enum QuotationAvailability { available, unavailable }

QuotationAvailability computeQuotationAvailability({
  required DateTime nowInSp,
  required String adminOverride, // 'auto' | 'force_disabled' | 'force_enabled'
  int startHour = 7,
  int endHour = 20,
}) {
  if (adminOverride == 'force_enabled') return QuotationAvailability.available;
  if (adminOverride == 'force_disabled') return QuotationAvailability.unavailable;
  final h = nowInSp.hour;
  return (h >= startHour && h < endHour)
      ? QuotationAvailability.available
      : QuotationAvailability.unavailable;
}
```

**TypeScript (`quotation-availability.ts`):**

```typescript
export type QuotationAvailability = 'available' | 'unavailable';
export type QuotationOverride = 'auto' | 'force_disabled' | 'force_enabled';

export function computeQuotationAvailability(params: {
  nowInSp: Date;
  adminOverride: QuotationOverride;
  startHour?: number;
  endHour?: number;
}): QuotationAvailability {
  const { nowInSp, adminOverride, startHour = 7, endHour = 20 } = params;
  if (adminOverride === 'force_enabled') return 'available';
  if (adminOverride === 'force_disabled') return 'unavailable';
  const h = nowInSp.getHours(); // caller deve passar já em SP
  return h >= startHour && h < endHour ? 'available' : 'unavailable';
}
```

### 4.3 Fetch do override

**Cliente Flutter (`system_settings_repository.dart`):**

- Método `fetchScheduledQuoteOverride(): Future<String>` faz `SELECT value FROM system_settings WHERE key='scheduled_quote_admin_override'`
- Cache singleton in-memory com TTL 60s (`_cachedValue`, `_cachedAt`)
- Fallback: retorna `'auto'` se erro ou linha ausente

**Admin TS (`system-settings.ts`):**

- `getScheduledQuoteOverride(): Promise<QuotationOverride>` (mesmo fetch, sem cache — admin card re-fetcha ao carregar)
- `setScheduledQuoteOverride(newValue: QuotationOverride): Promise<void>` chama a RPC `set_scheduled_quote_override(new_value)`

### 4.4 Timezone no cliente

Cliente converte `DateTime.now().toUtc()` para SP usando o pacote `timezone` (`getLocation('America/Sao_Paulo')` + `TZDateTime.from`). Se `timezone` não estiver em `pubspec.yaml`, adicionar como parte deste subprojeto.

Fallback se pacote falhar: `DateTime.now().toUtc().add(Duration(hours: -3))` — impreciso durante DST (Brasil não tem DST desde 2019, então funciona), mas documentado como fallback.

### 4.5 UI do sub-sheet

`ScheduledModeChoiceSheet` (stateless, recebe `availability: QuotationAvailability` como prop):

- **Card Cotação** — sempre renderizado. Estado visual muda conforme `availability`:
  - `available` → cor primária, tap chama `Navigator.pop('scheduled_quote')`
  - `unavailable` → cinza, `onTap: null`, texto secundário "Disponível das 07h às 20h"
- **Card Escolha seu Motorista** — NÃO renderizado no 2A. Comentário `// TODO Subprojeto 2B`
- **Botão Akira** — sempre renderizado. Estilo muda conforme `availability`:
  - `available` → botão discreto (texto small no rodapé)
  - `unavailable` → botão em destaque logo abaixo do card Cotação (cor secundária cheia)
  - Ao tocar: `launchUrl(Uri.parse('https://wa.me/$AKIRA_WHATSAPP_E164'), mode: LaunchMode.externalApplication)`

### 4.6 Cascata dos sheets

Em `trip_home_page.dart::_openSearch`:

```dart
final firstChoice = await showModalBottomSheet<String>(
  context: context,
  builder: (_) => const TripTypeChoiceSheet(),
);
if (firstChoice == 'scheduled') {
  final override = await SystemSettingsRepository.instance.fetchScheduledQuoteOverride();
  final availability = computeQuotationAvailability(
    nowInSp: TZDateTime.now(getLocation('America/Sao_Paulo')),
    adminOverride: override,
  );
  final secondChoice = await showModalBottomSheet<String>(
    context: context,
    builder: (_) => ScheduledModeChoiceSheet(availability: availability),
  );
  if (secondChoice == 'scheduled_quote') {
    // segue o fluxo scheduled atual, gravando trip_type='scheduled_quote'
  }
}
if (firstChoice == 'flash') {
  // existente
}
```

O caminho de gravação do `trip_type` precisa ser localizado no repositório de trip do cliente — durante o writing-plans mapear onde o INSERT/RPC atual é feito e adicionar o parâmetro.

### 4.7 Admin — QuotationOverrideCard

Client component renderizado no `/dashboard`:

```
┌─ Cotação de Corrida Agendada ─────────────────┐
│  Estado atual: Auto (dentro do horário — Ativa) │
│  [ Auto ]  [ Forçar ON ]  [ Forçar OFF ]        │
└─────────────────────────────────────────────────┘
```

- Fetch inicial: `getScheduledQuoteOverride()`
- Compute estado exibido: usa `computeQuotationAvailability` com `nowInSp = new Date()` no fuso do browser (assumindo admin operar em SP) + explica no rótulo se está fora do horário
- Clique nos botões: `setScheduledQuoteOverride(...)` + refetch + toast de sucesso/erro

### 4.8 Admin — filtro e badge

- Componente de filtro em `/viagens`: adicionar checkbox/chip "Cotação" (mesmo padrão do "Flash" — descoberto durante writing-plans)
- Badge 💰 em cards com `trip_type='scheduled_quote'` — reusar componente de badge se Flash tem um; se não, criar helper simples

## 5. Migrations e RPCs

### Migration 1 — `NNNNNNNNNNNN_scheduled_quote_trip_types.sql`

```sql
-- +goose Up
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_quote';
ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'scheduled_choose_driver';

-- +goose Down
-- Postgres não suporta remoção de valores de enum em uso; Down = no-op
```

### Migration 2 — `NNNNNNNNNNNN_scheduled_quote_settings.sql`

```sql
-- +goose Up
INSERT INTO system_settings (key, value, updated_by)
VALUES ('scheduled_quote_admin_override', '"auto"'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "authenticated_read_scheduled_quote_override"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (key = 'scheduled_quote_admin_override');

-- +goose Down
DROP POLICY IF EXISTS "authenticated_read_scheduled_quote_override" ON public.system_settings;
DELETE FROM system_settings WHERE key = 'scheduled_quote_admin_override';
```

Nota: se `system_settings` **não tem RLS habilitada** ou já expõe SELECT amplo a `authenticated`, a policy é redundante — verificar durante writing-plans e ajustar (removendo do migration ou reescrevendo).

### Migration 3 — `NNNNNNNNNNNN_set_scheduled_quote_override_rpc.sql`

```sql
-- +goose Up
CREATE OR REPLACE FUNCTION public.set_scheduled_quote_override(new_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Apenas admin pode alterar este setting';
  END IF;

  IF new_value NOT IN ('auto', 'force_enabled', 'force_disabled') THEN
    RAISE EXCEPTION 'Valor inválido: %', new_value;
  END IF;

  INSERT INTO system_settings (key, value, updated_by, updated_at)
  VALUES ('scheduled_quote_admin_override', to_jsonb(new_value), auth.uid(), now())
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by,
                updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_scheduled_quote_override(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_scheduled_quote_override(text) TO authenticated;

-- +goose Down
DROP FUNCTION IF EXISTS public.set_scheduled_quote_override(text);
```

Padrão Flash: `SECURITY DEFINER`, `set search_path = public`, revoke anon, guard `get_user_role()`, validação inline.

**Após aplicar as 3 migrations:** rodar `mcp__supabase__get_advisors` — mesma disciplina.

## 6. Testes automatizados

**Dart (`quotation_availability_test.dart`) — 5 casos mínimos:**

1. `override='auto'` + hora=14 → `available`
2. `override='auto'` + hora=6 → `unavailable`
3. `override='auto'` + hora=20 (exatamente) → `unavailable` (borda superior exclusiva)
4. `override='force_enabled'` + hora=3 → `available`
5. `override='force_disabled'` + hora=12 → `unavailable`

**TypeScript (`quotation-availability.test.ts`) — mesmos 5 casos + 1 extra:**

6. `getScheduledQuoteOverride` retorna `'auto'` como default quando linha ausente (stub Supabase)

**Fora do escopo automatizado:** widgets Flutter, componentes React, cascata de sheets, `launchUrl`, migrações aplicando, cache 60s.

## 7. Segurança

- **RPC `set_scheduled_quote_override`** — SECURITY DEFINER + guard `get_user_role()='admin'` + validação de valor + revoke anon (padrão Flash)
- **Policy `system_settings`** — restrita a `key = 'scheduled_quote_admin_override'`; não abre a tabela inteira
- **WhatsApp URL** — número hardcoded (`5511985889577`), não vem de input do usuário; imune a injeção via `launchUrl`
- **`launchUrl` mode** — `externalApplication` evita webview embutido; abre app do WhatsApp ou fallback do sistema
- **Nenhum secret novo** — sem novas env vars, sem novos serviços externos

## 8. Rollout

1. Aplicar as 3 migrations em dev → staging → prod (via `mcp__supabase__apply_migration`)
2. Rodar `mcp__supabase__get_advisors` — corrigir alertas antes de continuar
3. Merge do PR admin (card + filtro + badge) — não afeta cliente
4. Build & rollout do app cliente com nova versão
5. **Ordem crítica:** migrations DEVEM estar em prod ANTES do app cliente publicar. Cliente antigo continua enviando `standard` sem quebrar (retrocompatível)
6. Sem feature flag: `override='auto'` é o default; kill switch admin (`force_disabled`) resolve emergências

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Clock/timezone errado no cliente | Pacote `timezone` com `America/Sao_Paulo` fixo; fallback UTC-3 documentado |
| Migration `ADD VALUE` bloqueada | Rodar em janela de baixo tráfego; idempotente via `IF NOT EXISTS` |
| Cache 60s propaga override tarde | Documentado como esperado; admin sabe que kill switch leva até 1min |
| Policy nova vaza outras chaves | `USING (key = 'scheduled_quote_admin_override')` escopa |
| WhatsApp sem app instalado | `wa.me` abre no browser mobile como fallback; testado no e2e |
| RPC chamada por não-admin | Guard + revoke anon (padrão Flash) |
| Cliente antigo em prod após migration | Zero impacto — cliente antigo envia `standard`, enum não quebra |

## 10. Fora de escopo (backlog futuro)

- **Escolha seu Motorista** — Subprojeto 2B (lista, chat prévio, dispatch direto, prestador side, RPCs)
- **Chat interno Akira** — Subprojeto 5 (substitui launchUrl WhatsApp por `support_chat` ou similar)
- Push notif diferenciado para `scheduled_quote` no prestador
- Rota admin `/configurações` com múltiplos settings
- UI admin para editar horário base (07-20h)
- Realtime do override no cliente
- Métricas de quantas cotações são criadas fora do horário-base graças a `force_enabled`

## 11. Referências

- Backlog: `docs/superpowers/backlog/2026-07-29-escopo-completo-6-subprojetos.md`
- Padrão RPC Flash: `supabase/migrations/20260729120017*` (revoke anon), `supabase/migrations/20260729120010_create_flash_trip.sql` (SECURITY DEFINER + validação inline)
- Enum trip_type atual: `supabase/migrations/20260729120000_flash_trip_type_enum.sql`
- `TripTypeChoiceSheet` cliente: `C:\Projetos\kz-servicos-app-cliente\lib\features\trip\presentation\widgets\trip_type_choice_sheet.dart`
- `trip_home_page.dart::_openSearch` roteamento entre Flash/scheduled
- `system_settings` schema: `supabase/migrations/20260410120023_*`
- Sidebar admin: `src/components/Sidebar.tsx` (referência de padrão de componentes)
- Filtro Flash no Kanban: `src/app/(dashboard)/viagens/page.tsx` (localizar durante writing-plans)
