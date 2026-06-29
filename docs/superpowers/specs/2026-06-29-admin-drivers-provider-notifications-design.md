# Admin Motoristas, Notificacoes Globais e App Prestador

Data: 2026-06-29

## Objetivo

Melhorar a experiencia do painel admin e do app prestador sem alterar o pipeline principal de corridas. O trabalho cobre:

- painel Motoristas com foto real, preview publico, ampliacao/remocao de fotos e metricas filtraveis;
- sino global de notificacoes no dashboard admin;
- notificacoes de acao admin e push OneSignal para o admin;
- painel Prestadores sem motoristas;
- app prestador com remocao de fotos, controle online/offline, push de cliente aceitando corrida e estabilizacao do mapa 3D.

## Contexto Atual

O admin web fica em `C:\Projetos\kz-servicos-web-app-fork\kz-servicos-web-app-fork` e usa Next 16, React 19 e Supabase. As instrucoes locais exigem ler a documentacao em `node_modules/next/dist/docs/` antes de alterar codigo Next.

O app prestador fica em `C:\Projetos\kz-servicos-app-prestador` e usa Flutter com Supabase, FCM, Google Maps e notificacoes locais. O worktree atual ja tem alteracoes nao commitadas em push, mapa, perfil e Firebase; a implementacao deve trabalhar com esse estado, sem reverter mudancas existentes.

O banco usa as tabelas existentes `users`, `provider_profiles`, `driver_profiles`, `driver_profile_photos`, `vehicles`, `vehicle_photos`, `trips`, `trip_driver_candidates`, `ratings`, `notifications` e `user_devices`. O fluxo de corrida relevante e:

`searching_drivers -> awaiting_client_confirmation -> awaiting_driver_confirmation -> scheduled`

## Abordagem Escolhida

Usar uma abordagem incremental integrada:

- manter as melhorias de UI nos paineis existentes;
- colocar notificacoes globais no layout do dashboard;
- reaproveitar `notifications`, Supabase Realtime, FCM e OneSignal;
- adicionar APIs/helper functions apenas quando a acao exigir permissao admin ou agregacao de dados;
- corrigir o app prestador pontualmente, sem redesenhar a arquitetura.

Essa abordagem reduz risco porque aproveita o pipeline e as tabelas ja existentes.

## Admin Web

### Sino Global de Notificacoes

O sino deve ser global em `src/app/(dashboard)/layout.tsx` ou em um componente filho do layout. Ele deve:

- ficar fixo no canto superior direito;
- ser redondo, com icone de notificacao e contador de nao lidas;
- abrir um painel/dropdown com as ultimas notificacoes/atualizacoes do app;
- assinar Realtime em `notifications` para admins autenticados;
- permitir marcar itens como lidos;
- abrir o contexto correto quando houver `link` ou `reference_type/reference_id`.

As notificacoes de acao admin devem ser criadas quando uma etapa do pipeline exigir intervencao humana. Exemplos:

- cliente aceitou a proposta e a corrida entrou em `awaiting_driver_confirmation`;
- motorista confirmou agendamento e a corrida ficou pronta para acompanhamento;
- motorista retornou proposta ou preco em `trip_driver_candidates`;
- motorista recusou convite ou recusou revalidacao;
- existem corridas aguardando aprovacao, validacao de preco ou decisao admin.

O painel deve mostrar texto curto, data/hora, tipo e estado de leitura.

### OneSignal no Admin

O admin web ja possui mudancas locais de OneSignal. A implementacao deve preservar essas mudancas e completar o fluxo:

- vincular o usuario logado ao OneSignal;
- disparar push para admins quando uma notificacao admin for criada;
- manter fallback via painel Realtime caso o push falhe ou permissao do navegador nao exista.

Segredos de OneSignal nao devem ser expostos no client. Envio server-side deve ficar em rota API, Edge Function ou trigger segura.

## Painel Motoristas

### Lista

A lista deve exibir a foto real do motorista quando `provider_profiles.users.avatar_url` existir. Se nao existir, manter iniciais como fallback. As fotos publicas atuais continuam aparecendo como miniaturas.

### Preview Publico

Ao clicar no motorista, abrir um modal/sheet de preview do perfil como o cliente veria. O preview deve mostrar:

- avatar;
- nome;
- avaliacao media;
- status online/offline;
- dados principais do veiculo;
- fotos publicas do motorista;
- fotos do carro.

As fotos devem abrir ampliadas em lightbox/modal. O preview deve ter botoes de moderacao para remover fotos.

### Remocao de Fotos por Admin

O admin deve conseguir remover:

- fotos de `driver_profile_photos`;
- fotos de `vehicle_photos`.

A remocao deve excluir o registro no banco. Se for possivel derivar com seguranca o path do arquivo no storage a partir da URL publica, tambem remover o objeto do bucket. Se o path nao for confiavel, remover somente o registro para que a foto saia imediatamente do app e do admin.

A acao deve pedir confirmacao e mostrar feedback de sucesso/erro.

### Historico e Metricas

O modal de historico deve incluir filtros:

- Hoje;
- Semana;
- Mes;
- Ano.

Para o periodo selecionado, mostrar:

- corridas finalizadas: `trips.status = finished` para o `driver_profile_id`;
- corridas canceladas: `trips.status = cancelled` para o `driver_profile_id`;
- corridas recusadas: `trip_driver_candidates.status = rejected` para o motorista;
- media de avaliacoes: media de `ratings.rating` recebidas pelo usuario do motorista no periodo.

A lista de historico continua abaixo das metricas, com as corridas relevantes do periodo e avaliacoes ligadas a cada corrida.

## Painel Prestadores

Motoristas nao devem aparecer na tela de Prestadores. A query ou filtro deve excluir qualquer `provider_profiles` que tenha relacao em `driver_profiles`.

Essa exclusao deve ser feita de forma robusta, nao apenas por nome de categoria, porque a categoria pode mudar ou haver multiplas categorias.

## App Prestador

### Online e Offline no Perfil

A aba Perfil deve permitir alternar online/offline usando `driver_profiles.is_available`. O app ja possui `DriverService.updateAvailability`; a UI deve chamar esse metodo, exibir loading, lidar com erro e recarregar estado local.

### Remocao de Fotos

Nas grids de fotos do carro e do motorista, cada foto deve ter acao de remover. A acao deve:

- pedir confirmacao;
- remover a linha correspondente em `vehicle_photos` ou `driver_profile_photos`;
- remover o objeto de storage quando o path puder ser resolvido com seguranca;
- recarregar o perfil;
- exibir feedback.

O model atual guarda apenas URLs, entao ele deve passar a preservar tambem os IDs das fotos para remocao precisa.

### Push Quando Cliente Aceita Corrida

Quando o cliente aceita a corrida e a trip entra em `awaiting_driver_confirmation`, o motorista deve receber notificacao igual em importancia/som a uma solicitacao de corrida. O app ja reconhece tipos persistentes como `recheck`, `client_accepted_trip` e equivalentes; a implementacao deve garantir que a Edge Function/trigger envie payload com tipo persistente e `trip_id`.

Ao abrir a notificacao, o app deve levar para `/home?tripRequestId=...` ou fluxo equivalente para confirmar/recusar o agendamento.

### Mapa 3D/Tilt

O mapa em corrida ativa deve manter navegacao 3D mais estavel:

- usar tilt alto somente em modo seguindo GPS;
- evitar conflito entre animacoes de camera por GPS e bussola;
- manter heading/bearing suave;
- ao usuario interagir manualmente, pausar seguir-camera e achatar quando adequado;
- ao tocar em recenter, voltar a seguir com tilt 3D.

Os testes devem cobrir a logica pura que for extraida para decidir tilt, following e tipos de push.

## Banco e Pipeline

As migrations devem ser lidas antes da implementacao final. O pipeline nao deve pular estados:

1. Admin procura/adiciona motoristas em `searching_drivers`.
2. Motorista aceita/recusa convite em `trip_driver_candidates`.
3. Admin aprova candidato/preco quando necessario.
4. Cliente confirma em `awaiting_client_confirmation`.
5. Motorista revalida em `awaiting_driver_confirmation`.
6. Corrida vira `scheduled`.

Notificacoes admin devem acompanhar esse fluxo sem substituir as regras existentes. Push ao prestador continua via FCM. Push ao admin usa OneSignal.

## Testes e Verificacao

Web/admin:

- testes unitarios para helpers de metricas, periodos e filtragem de prestadores quando possivel;
- lint/build do Next;
- verificacao manual do painel Motoristas, preview, lightbox, remocao e sino global.

Flutter:

- testes para model de fotos com IDs;
- testes para `PushNotificationService` cobrindo tipo persistente de cliente aceitando corrida;
- testes para logica de camera/tilt se extraida;
- `flutter test`;
- `flutter analyze`.

## Riscos

- Ha mudancas nao commitadas nos dois repositorios. A implementacao deve preservar trabalho existente.
- Remover arquivo do storage a partir de URL publica pode falhar se a URL tiver query string ou formato inesperado. O requisito minimo e remover a linha no banco para moderacao imediata.
- OneSignal exige segredo server-side para envio. Se ele nao estiver disponivel no ambiente, o painel Realtime deve continuar funcionando e a falta do segredo deve ser reportada.
- RLS pode bloquear delecoes feitas pelo app prestador se as policies remotas estiverem defasadas. Nesse caso, criar migration idempotente para alinhar policies.

## Fora de Escopo

- Redesenhar todo o dashboard admin.
- Criar uma central operacional separada.
- Alterar o app cliente.
- Migrar FCM do app prestador para OneSignal.
