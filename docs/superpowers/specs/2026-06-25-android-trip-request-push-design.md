# Design: Push Android para solicitação de corrida com app encerrado

**Data:** 2026-06-25  
**Status:** Aprovado

## Objetivo

Quando o administrador adicionar um motorista a uma corrida e o aplicativo Android do motorista estiver removido da lista de aplicativos recentes, o Android deve exibir uma notificação sonora de nova corrida em poucos segundos.

O fluxo deve continuar funcionando com o aplicativo em primeiro plano ou em segundo plano. O estado Android **Forçar parada** fica fora do escopo, pois o sistema operacional bloqueia o recebimento de FCM até o usuário abrir o aplicativo novamente.

## Estado atual e causa da falha

O sistema já possui os componentes principais:

- o painel insere convites em `trip_driver_candidates`;
- um trigger PostgreSQL chama a Edge Function `send-fcm-push`;
- a Edge Function busca o token do motorista e envia pelo FCM HTTP v1;
- o aplicativo Flutter registra tokens FCM e possui o canal `trip_notifications`.

As chamadas recentes à Edge Function retornam HTTP 401. O trigger contém uma chave `service_role` embutida no SQL e a função compara esse valor com a chave atual do ambiente. Esse acoplamento também expõe uma credencial com acesso administrativo ao banco.

O envio persistente atual usa mensagem FCM somente com `data`. Isso depende da execução do código Dart em segundo plano e é menos confiável quando o processo do aplicativo foi encerrado.

## Arquitetura escolhida

```text
Painel administrativo
  -> INSERT em trip_driver_candidates
  -> trigger PostgreSQL
  -> POST autenticado para send-fcm-push
  -> Edge Function consulta token FCM
  -> FCM HTTP v1 envia notification + data
  -> Android exibe notificação sonora
  -> toque abre o app e recarrega a corrida
```

O banco continuará sendo a fonte do evento. Assim, qualquer fluxo que adicione um motorista como candidato produzirá a mesma notificação, sem depender exclusivamente da interface atual do painel.

## Autenticação entre PostgreSQL e Edge Function

A chamada interna usará um secret dedicado, por exemplo `PUSH_WEBHOOK_SECRET`.

- O trigger enviará o secret em um header próprio.
- A Edge Function comparará o header com o secret armazenado em seu ambiente.
- O secret não concederá acesso ao banco ou ao Firebase.
- A chave `service_role` não será armazenada em migrations, funções SQL ou código cliente.

Como funções PostgreSQL não devem conter o valor literal do secret, a implementação deverá armazená-lo em mecanismo server-side apropriado do Supabase e recuperá-lo durante o trigger. Caso o ambiente não disponibilize Vault, a alternativa será retirar o `net.http_post` do trigger e usar um webhook de banco configurado pelo Supabase com o secret.

## Evento que dispara a notificação

O evento principal será:

- tabela: `trip_driver_candidates`;
- operação: `INSERT`;
- candidato com `status = pending`;
- corrida relacionada com `status = searching_drivers`.

O trigger enviará à Edge Function:

- `trip_id`;
- `driver_profile_id`;
- `client_id`;
- identificadores dos endereços de origem e destino;
- tipo do evento.

Cada novo candidato receberá somente a própria notificação. Alterações de status posteriores continuarão usando os eventos existentes, mas não fazem parte do critério principal desta entrega.

## Registro e resolução do token

O aplicativo registrará o token depois da autenticação e em toda atualização do FCM.

Para manter compatibilidade com o schema atual:

- o token será salvo em `driver_profiles.fcm_token`;
- o token também poderá ser mantido em `users.fcm_token`;
- a Edge Function deduplicará tokens antes do envio.

`user_devices` não será introduzida como dependência obrigatória nesta entrega, pois atualmente não possui registros e o app já utiliza as colunas existentes. A migração para múltiplos dispositivos pode ser tratada separadamente.

Se o FCM responder que um token está inválido ou não registrado, a Edge Function limpará ou desativará o token correspondente para evitar novas tentativas inúteis.

## Payload FCM para Android

A solicitação de corrida será enviada com:

- bloco `notification`, para que o Android exiba a notificação mesmo com o processo Flutter encerrado;
- bloco `data`, para preservar `type = trip_request` e `trip_id`;
- prioridade Android alta;
- canal `trip_notifications`;
- som associado ao canal;
- comportamento de toque que abre o aplicativo.

O título será `Nova corrida disponível!`. O corpo identificará o passageiro e, quando disponíveis, origem e destino.

O aplicativo não criará uma segunda notificação local quando receber em background uma mensagem que já contenha o bloco `notification`. Em primeiro plano, continuará exibindo a notificação local e atualizando a tela.

## Canal e som no Android

O canal `trip_notifications` será configurado com:

- importância máxima/alta;
- prioridade alta;
- vibração;
- som de nova corrida empacotado como recurso Android;
- categoria apropriada para alerta de corrida.

Como as propriedades de canais Android ficam persistidas no dispositivo, qualquer mudança incompatível de som ou importância exigirá um novo identificador de canal, como `trip_requests_v2`, ou a reinstalação/limpeza dos dados do app durante testes.

A notificação deve tocar uma vez. O áudio em loop da tela de solicitação continua sendo responsabilidade do aplicativo quando ele estiver aberto.

## Abertura da solicitação

Ao tocar na notificação:

1. o Android abre o aplicativo;
2. o app lê `type` e `trip_id`;
3. a sessão é restaurada;
4. a home recarrega os convites do motorista;
5. a solicitação correspondente é apresentada se ainda estiver pendente.

Se a corrida já tiver sido cancelada, removida ou respondida, o app abre a home sem apresentar dados obsoletos.

## Tratamento de erros e observabilidade

A Edge Function retornará e registrará resultados distintos para:

- autenticação interna inválida;
- motorista sem token;
- configuração Firebase ausente;
- falha ao obter access token OAuth;
- token FCM inválido;
- erro da API FCM.

O trigger não deve cancelar a inclusão do candidato quando o push falhar. A falha de notificação será observável nos logs da Edge Function e, quando aplicável, nos logs do PostgreSQL.

## Segurança

Antes da liberação:

- rotacionar a chave `service_role` exposta em código e conversa;
- rotacionar as chaves privadas Firebase Admin expostas;
- remover arquivos de conta de serviço dos repositórios e do pacote Android;
- manter credenciais somente em secrets server-side;
- adicionar padrões de `.gitignore` para contas de serviço;
- verificar o histórico Git e tratar credenciais previamente versionadas como comprometidas.

O arquivo `google-services.json` do app Android não é uma chave privada de Admin SDK e pode permanecer conforme o fluxo padrão do Firebase. Arquivos `*-firebase-adminsdk-*.json` e `*-serviceaccount.json` não podem ser empacotados ou versionados.

## Testes

### Automatizados

- Edge Function resolve corretamente o motorista e monta `notification + data`.
- Requisição sem o secret dedicado retorna 401.
- Evento de candidato pendente gera `type = trip_request`.
- Token duplicado é enviado uma única vez.
- Token inválido é tratado sem falhar toda a operação.
- Flutter não duplica notificação de mensagem que já contém `notification`.
- Flutter interpreta `trip_id` ao abrir a notificação.

### Integração Android

1. Entrar no app como motorista e autorizar notificações.
2. Confirmar que o token foi salvo no Supabase.
3. Remover o app da lista de recentes.
4. No painel, adicionar esse motorista a uma corrida em `searching_drivers`.
5. Confirmar notificação sonora em poucos segundos.
6. Tocar na notificação e confirmar que a home carrega a solicitação.
7. Repetir com o app em primeiro e segundo plano.
8. Confirmar que não há notificação duplicada.

## Critérios de aceite

- Android apenas.
- Funciona com o app removido dos recentes.
- Não promete funcionamento após **Forçar parada**.
- A inclusão do motorista em `trip_driver_candidates` gera uma única notificação sonora.
- O toque abre o app e recarrega a corrida pendente.
- Nenhuma chave `service_role` ou Firebase Admin fica no código, migration, APK ou frontend.
- Falhas de envio não impedem a criação do convite no banco.

## Fora do escopo

- iOS.
- Entrega após **Forçar parada**.
- múltiplos dispositivos por usuário via `user_devices`.
- áudio contínuo enquanto o app está encerrado.
- reformulação das demais notificações de cliente, chat ou serviço.
