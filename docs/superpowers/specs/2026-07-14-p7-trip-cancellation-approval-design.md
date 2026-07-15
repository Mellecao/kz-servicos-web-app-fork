# P7 - Cancelamento de viagem com aprovacao do admin

**Data:** 2026-07-14
**Status:** Aprovado para implementacao

## Problema

O app do motorista cancela a viagem imediatamente ao atualizar `trips.status` para
`cancelled`. O novo fluxo deve manter a corrida ativa enquanto o admin analisa o
pedido, mostrar o motivo no painel e avisar as duas pontas por push/realtime.

## Decisoes

- Implementar banco, painel web e app Flutter nesta iteracao.
- Criar `trip_cancellation_requests` para preservar auditoria e multiplas tentativas.
- Permitir apenas um pedido `pending` por viagem.
- Exigir motivo do motorista com no minimo 10 caracteres.
- Exigir motivo do admin ao recusar, com no minimo 3 caracteres.
- Aprovacao usa o push existente de mudanca da viagem para `cancelled`.
- Recusa envia push FCM proprio com motivo e deep-link para a corrida ativa.

## Banco de dados

### Tabela

`trip_cancellation_requests`:

- `id`, `trip_id`, `requested_by`, `reason`, `status`.
- `reviewed_by`, `reviewed_at`, `review_reason`.
- `created_at`, `updated_at`.
- Check de status: `pending`, `approved`, `rejected`.
- Indice unico parcial em `trip_id` quando `status = 'pending'`.

### RLS

- Motorista confirmado da viagem pode inserir um pedido proprio apenas em viagens
  `scheduled` ou `started`.
- Motorista pode ler os proprios pedidos.
- Admin pode ler e revisar todos os pedidos.
- Colunas de autoria e motivo original ficam imutaveis apos o insert.

### Triggers

1. Insert `pending`: cria `admin_trip_cancellation_request` em `notifications`.
2. Review para `approved`: cancela a viagem na mesma transacao, preservando o motivo
   original em `trips.cancellation_reason`.
3. Review para `rejected`: mantem a viagem ativa e chama `send-fcm-push`.
4. Cancelamento externo da viagem: resolve eventual pedido pendente como aprovado.
5. A tabela entra em `supabase_realtime` com `REPLICA IDENTITY FULL`.

## Painel web

`TripDetailModal` busca o pedido pendente junto dos demais dados e assina realtime
para `trips` e `trip_cancellation_requests`.

Quando houver pedido pendente, exibe antes do motorista confirmado:

- nome do motorista;
- motivo em texto secundario;
- botoes `Aprovar` e `Recusar`;
- campo obrigatorio de motivo ao recusar;
- estados de carregamento e feedback por toast.

A zona de risco nao oferece um segundo caminho de cancelamento enquanto o pedido
estiver pendente.

## App Flutter

`CancelTripSheet` passa a comunicar que o motorista esta enviando uma solicitacao.
O app insere em `trip_cancellation_requests` e nao altera `trips`.

A tela ativa:

- carrega um pedido pendente ao abrir;
- assina realtime da nova tabela;
- desabilita nova solicitacao enquanto houver uma pendente;
- informa que a corrida continua ativa durante a analise;
- reabilita o fluxo e mostra o motivo quando houver recusa;
- continua usando o realtime de `trips` para sair da corrida quando aprovada.

O push `trip_cancellation_rejected` abre
`/home?activeTripId=<tripId>` e mostra o motivo da KZ.

## Deploys necessarios

1. Aplicar a migration.
2. Redeploy `send-fcm-push`.
3. Redeploy `send-admin-onesignal-push` pelas mudancas pendentes do P1.

## Testes

- SQL/RLS: um pedido pendente por viagem, motorista correto, admin review e
  transicao atomica para `cancelled`.
- Web: pedido aparece por realtime, aprovacao, recusa com validacao e concorrencia.
- Flutter: solicitacao nao encerra a corrida, estado pendente, recusa e aprovacao.
- Push: admin abre a viagem correta; motorista recusado volta para a corrida ativa.

