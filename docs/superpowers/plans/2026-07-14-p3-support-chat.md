# P3 - Support Chat Implementation Plan

**Goal:** entregar um canal de texto em tempo real entre prestadores e admins,
com navegacao direta por push nos dois aplicativos.

**Architecture:** conversa persistente por usuario prestador, tabelas separadas
do chat cliente x prestador, RLS por participante/admin e triggers de notificacao.

**Spec:** `docs/superpowers/specs/2026-07-14-p3-support-chat-design.md`

## Task 1 - SQL de publicacao

- [x] Gerar SQL Editor up-only do P7.
- [x] Criar migration das tabelas de suporte.
- [x] Adicionar RLS, indices, contadores, Realtime e triggers de push.
- [x] Gerar SQL Editor up-only do P3.

## Task 2 - Painel web

- [x] Adicionar tipos e funcoes Supabase.
- [x] Adicionar `Chats` na navegacao desktop e mobile.
- [x] Criar lista `/chats` com previa e nao lidas.
- [x] Criar conversa `/chats/[providerId]` com envio, leitura e Realtime.

## Task 3 - App Flutter

- [x] Criar model/service de suporte.
- [x] Criar pagina `/support-chat`.
- [x] Adicionar acesso na home e na corrida ativa.
- [x] Tratar conteudo e deep-link do push `support_message`.

## Task 4 - Qualidade

- [x] Adicionar testes focados para service, navegacao e push Flutter.
- [x] Executar lint/build web e analyze/test Flutter.
- [x] Atualizar skill `kz-database` e documento de progresso.
