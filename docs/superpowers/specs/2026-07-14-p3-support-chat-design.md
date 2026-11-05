# P3 - Chat de suporte KZ x prestador

## Objetivo

Permitir que qualquer prestador autenticado converse diretamente com a equipe KZ
durante todo o ciclo de trabalho. O painel admin lista somente conversas que ja
receberam mensagem e permite responder em tempo real.

## Decisao de arquitetura

O schema existente `chat_rooms`/`chat_messages` continua reservado ao chat
cliente x prestador vinculado a uma corrida ou servico. O suporte usa tabelas
proprias para nao misturar participantes, historico, contadores ou politicas RLS.

Cada usuario prestador possui no maximo uma `support_conversation` persistente.
A conversa nao pertence a uma corrida; assim, o mesmo canal permanece acessivel
em solicitacoes, agendamentos, corrida ativa e fora de uma corrida.

## Modelo de dados

### `support_conversations`

- `id`: UUID.
- `provider_user_id`: usuario prestador, unico.
- `last_message_at`, `last_message_preview`, `last_sender_id`: resumo da lista.
- `unread_admin_count`, `unread_provider_count`: contadores transacionais.
- `created_at`, `updated_at`.

### `support_messages`

- `id`: UUID.
- `conversation_id`: FK com cascade.
- `sender_id`: usuario que enviou.
- `message`: texto entre 1 e 4000 caracteres.
- `is_read`, `read_at`, `created_at`.

## Autorizacao

- Prestador ve e cria somente a propria conversa.
- Prestador e admins leem as mensagens da conversa.
- `sender_id` deve ser sempre `auth.uid()`.
- Prestador envia somente na propria conversa; admin envia em qualquer conversa.
- Updates de mensagem alteram apenas `is_read`/`read_at` e somente pelo destinatario.
- Triggers `SECURITY DEFINER` mantem resumo e contadores sem ampliar o acesso do cliente.

## Notificacoes

- Prestador envia: trigger cria uma `notifications` para cada admin ativo, tipo
  `admin_support_message`, com link `/chats/<provider_user_id>`. O gateway
  OneSignal existente envia o push e preserva o deep-link.
- Admin responde: trigger chama `send-fcm-push` com tabela `support_messages`.
  O Flutter recebe tipo `support_message` e abre `/support-chat`.

## Painel web

- Sidebar desktop e navegacao inferior mobile recebem a aba `Chats`.
- `/chats`: lista por `last_message_at`, nome, previa e nao lidas.
- `/chats/[providerId]`: cabecalho com voltar, historico, composer e Realtime.
- Ao abrir a conversa, mensagens do prestador sao marcadas como lidas.

## App Flutter

- Rota `/support-chat` cria ou reutiliza a conversa do usuario atual.
- Tela de mensagens em tempo real com composer de texto.
- Acesso global na home e acesso explicito durante a corrida ativa.
- Push `support_message` abre diretamente a rota.

## Rollout

1. Aplicar P7, se ainda pendente.
2. Aplicar o SQL P3.
3. Fazer deploy de `send-fcm-push` e `send-admin-onesignal-push`.
4. Publicar web e Flutter.
5. Testar mensagem nos dois sentidos com app fechado e aberto.

## Fora desta iteracao

- Anexos, audio e localizacao no suporte.
- Multiplas filas/departamentos de atendimento.
- Encerramento, atribuicao individual de admin e SLA.
- Edicao ou exclusao de mensagens.
