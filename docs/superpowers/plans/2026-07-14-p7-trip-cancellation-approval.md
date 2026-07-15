# P7 - Trip Cancellation Approval Implementation Plan

**Goal:** substituir o cancelamento direto do motorista por solicitacao auditavel,
revisada pelo admin, com realtime e push nos dois aplicativos.

**Architecture:** tabela compartilhada com RLS e triggers transacionais; painel web
revisa o pedido; Flutter cria e acompanha a solicitacao; as Edge Functions existentes
continuam sendo os gateways OneSignal/FCM.

**Spec:** `docs/superpowers/specs/2026-07-14-p7-trip-cancellation-approval-design.md`

## Task 1 - Banco e backend

- [x] Criar migration `20260714120000_trip_cancellation_requests.sql`.
- [x] Adicionar tabela, checks, indices, RLS e Realtime.
- [x] Notificar admins no insert.
- [x] Aplicar aprovacao/recusa de forma transacional.
- [x] Disparar FCM especifico para recusa.
- [x] Estender `send-fcm-push` para `trip_cancellation_requests`.

## Task 2 - Painel web

- [x] Adicionar tipos de cancelamento em `src/types/database.ts`.
- [x] Adicionar fetch, approve e reject em `src/lib/api.ts`.
- [x] Integrar carga, realtime e card de revisao em `TripDetailModal.tsx`.
- [x] Impedir cancelamento paralelo na zona de risco quando houver pedido pendente.

## Task 3 - App Flutter

- [x] Criar service/model para `trip_cancellation_requests`.
- [x] Trocar update direto de `trips` por insert da solicitacao.
- [x] Carregar e assinar estado pendente na corrida ativa.
- [x] Atualizar paineis e bottom sheet para o novo significado da acao.
- [x] Adicionar conteudo e deep-link do push de recusa.

## Task 4 - Qualidade

- [x] Atualizar testes TypeScript/Deno aplicaveis.
- [x] Atualizar testes Flutter de painel, service e push.
- [x] Executar lint e build web.
- [x] Executar `flutter analyze` e testes direcionados.
- [x] Atualizar a referencia da skill `kz-database` e o documento de progresso.
