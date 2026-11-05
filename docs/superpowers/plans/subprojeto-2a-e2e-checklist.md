# Subprojeto 2A — Corrida Agendada Fundação — Checklist manual e2e

**Pré-requisitos:**
- Migrations aplicadas em Supabase (`20260729150000-2` — enum + settings + RPC).
- App admin (`kz-servicos-web-app-fork`) rodando (`npm run dev`).
- App cliente Flutter (`kz-servicos-app-cliente`) buildado (`flutter run`).
- 1 cliente autenticado; 1 admin autenticado.
- Ambiente pode simular horário forçando override admin (evita mock de sistema).

---

## Cenário 1 — Cotação dentro do horário (auto)

1. Admin: dashboard mostra card "Cotação de Corrida Agendada" com botão **Auto** ativo.
2. Cliente: tap na barra de endereço → escolher **Corrida Agendada** → sub-sheet abre.
3. **Assertivas visuais** (dentro do horário 07-20h SP):
   - Card "💰 Cotação" habilitado (cor padrão), subtitle "A KZ busca o melhor motorista e preço para você".
   - Botão "💬 Falar com o Akira" no rodapé, discreto (TextButton).
4. Cliente tap em "Cotação" → segue fluxo scheduled atual (picker de endereços + detalhes).
5. Confirmar solicitação → trip é criada.

### Assertiva SQL

```sql
SELECT id, status, trip_type FROM trips ORDER BY created_at DESC LIMIT 1;
```

Esperado: `status='open'` (ou o default do fluxo scheduled), `trip_type='scheduled_quote'`.

---

## Cenário 2 — Cotação fora do horário (auto)

Simular via override admin (mais confiável que esperar a hora):

1. Admin: card do dashboard → tap **Forçar OFF** → estado vira "Forçada OFF (inativa)".
2. Cliente: (re-abrir app OU aguardar 60s para expirar cache) tap na barra → Corrida Agendada.
3. **Assertivas visuais:**
   - Card "💰 Cotação" cinza, subtitle "Disponível das 07h às 20h", **onTap inativo**.
   - Botão "💬 Falar com o Akira" em destaque logo abaixo (FilledButton com largura total).
4. Tap em "Falar com o Akira" → app do WhatsApp abre (ou browser mobile fallback com `wa.me`) com número `55 11 98588-9577`.

---

## Cenário 3 — Admin `force_enabled` fora do horário

1. Admin: card → **Forçar ON** → estado "Forçada ON (ativa)".
2. Cliente: reabrir/aguardar 60s → Corrida Agendada → Cotação habilitada mesmo que hora local esteja fora de 07-20h SP.
3. Executar fluxo até criar trip → `trip_type='scheduled_quote'`.

---

## Cenário 4 — Voltar para Auto

1. Admin: card → **Auto** → estado retorna a "Auto (dentro/fora do horário — ...)" conforme relógio.
2. Cliente: reabrir → Cotação habilitada se hora local ∈ [07,20), inativa caso contrário.

---

## Cenário 5 — Filtro Cotação no Kanban admin

1. Após Cenário 1 (trip Cotação criada): admin abre `/viagens`.
2. Dropdown de filtro tem **💰 Cotação** como opção.
3. Selecionar Cotação → só trips `trip_type='scheduled_quote'` aparecem.
4. Cards mostram badge **💰 COTAÇÃO** (verde).

---

## Cenário 6 — Cache 60s no cliente

1. Admin: setar override para **Forçar OFF**.
2. Cliente (com o sub-sheet AINDA aberto): estado NÃO muda até fechar e reabrir.
3. Fechar sub-sheet, aguardar 60s+, reabrir → estado reflete `force_disabled`.

Aceitável: mudanças do admin propagam em até 1 minuto no cliente.

---

## Cenário 7 — Trip standard antiga

1. Admin: `/viagens` sem filtro (todos).
2. Trips com `trip_type='standard'` (criadas antes deste subprojeto) continuam listadas.
3. Filtrar por **Padrão** → só as antigas aparecem.
4. Filtrar por **⚡ Flash** → só Flash.

Confirma retrocompatibilidade do enum.

---

## Regressão obrigatória

- [ ] Fluxo Flash: cliente abre app → escolhe Flash → propostas → aceite. Zero mudança de comportamento.
- [ ] Fluxo scheduled antigo (se cliente antigo em prod ainda existir): continua criando trips `standard` sem quebrar.
- [ ] `/dashboard` admin: outros cards continuam visíveis, sem regressão de layout com o novo `QuotationOverrideCard`.
- [ ] `/viagens` admin: badge Flash e round trip continuam funcionando (encadeamento condicional preservou ordem).
- [ ] Advisor Supabase limpo pós-migrations (`mcp__supabase__get_advisors`).

---

## Débitos identificados (backlog)

- [ ] Chat interno com Akira via `support_chat` — Subprojeto 5 (2A usa launchUrl WhatsApp).
- [ ] Opção "Escolha seu Motorista" no sub-sheet — Subprojeto 2B.
- [ ] Rota admin `/configurações` com múltiplos settings — hoje é só card no dashboard.
- [ ] UI admin para editar horário base (07-20h) — hardcoded.
- [ ] Realtime do override no cliente (cache 60s é suficiente).
- [ ] Push notif diferenciado para `scheduled_quote` no prestador — mesmo fluxo scheduled atual.

---

## Execução

- [ ] Cenário 1 — Cotação dentro do horário
- [ ] Cenário 2 — Cotação fora / force_disabled
- [ ] Cenário 3 — force_enabled fora do horário
- [ ] Cenário 4 — Voltar para Auto
- [ ] Cenário 5 — Filtro + badge admin
- [ ] Cenário 6 — Cache 60s
- [ ] Cenário 7 — Retrocompatibilidade standard
- [ ] Regressão obrigatória
- [ ] Registrar bugs em `docs/superpowers/plans/subprojeto-2a-e2e-bugs.md` (criar sob demanda)
