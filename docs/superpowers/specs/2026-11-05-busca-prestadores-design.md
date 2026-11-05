# Buscar prestadores (substitui a home de viagens) — design e contrato

Data: 2026-11-05 · Pedido do utilizador (Guilherme) · Orquestradora: `tellin-52`. Complementa `2026-11-05-so-servicos-reativacao-design.md` (regras §3 e pt-AO §5 continuam a valer).

## 1. O que o utilizador pediu (palavras dele, resumidas)
**App Cliente**
1. A **primeira tela** deixa de ser a de corrida/viagem. A tela de viagens **não se apaga**: o layout dela é reaproveitado e vira **"Buscar prestadores de serviço"**. Em vez de escolher um endereço no campo de texto, o utilizador **digita o serviço/prestador** que quer.
2. Ao começar a digitar aparece um **autocomplete** por baixo (igual ao de endereço), com as **categorias de serviço** que o app pode fornecer.
3. **Remover o banner do topo** da tela inicial.
4. Ao escolher uma categoria, a animação que era "procurando motoristas próximos" passa a **"a procurar prestadores próximos"**.
5. Prestadores **fictícios (mocados) mas que aparecem de verdade** perto do cliente, **bem visual** (é um teste/demo). Tocar num **pin** do mapa abre um **modal inferior** com os dados do prestador, **faixa de preço** e **tempo médio de resposta**. Ao **aceitar**, o pedido é enviado ao prestador e **o fluxo continua como já existe**.
**Painel admin**
6. A tela de **Viagens deixa de existir** no menu: ficam só **Serviços** e **Entregas**. **Nada de apagar** a tela nem o schema de viagens: fica **inativa**, para o utilizador poder **reativar as caronas no futuro**.

## 2. Decisões (minhas — dizer se algo estiver errado)
- **Interruptor único `trips_enabled`** em `system_settings` (jsonb, hoje `false`). Cliente e Painel lêem-no; o admin pode ligá-lo no Painel. Com `false`: Cliente abre em "Buscar prestadores" e a tela de viagens fica inacessível; Painel esconde "Viagens". Com `true`: comportamento antigo volta (no Cliente a home original; a busca de prestadores continua acessível por um atalho). Falha ao ler o interruptor → trata como `false`.
- **Nada é apagado**: telas, rotas, repositórios, schema e testes de viagens ficam; só ficam desligados atrás do interruptor.
- **"Aceitar" = pedido direto**: RPC `client_request_service_from_provider` cria o pedido já em `searching_provider` e convida **só** esse prestador (a escolha do cliente substitui a aprovação inicial do admin). Depois segue o fluxo canónico existente: prestador propõe preço → admin escolhe (`select_service_request_provider`) → cliente aceita → prestador confirma → em curso → finalizado.
- **"Entregas"** = os pedidos de produtos (`/pedidos-produtos`); renomear só o rótulo do menu/título, a rota pode ficar.
- Pins dos prestadores: **posição simulada pelo servidor** (estável por prestador, 250–1900 m do ponto enviado). Só prestadores `is_demo` aparecem (os reais ainda não têm localização).

## 3. Backend (JÁ APLICADO e testado: 28/28) — migrations `20261105150000_service_provider_search.sql` e `20261105151000_direct_request_duplicate_guard.sql`
- `rpc('search_service_providers', { p_category_id, p_lat, p_lng, p_limit = 12 })` → lista de `{ provider_profile_id, full_name, avatar_url, bio, category_id, category_name, average_rating, total_ratings, price_min, price_max, avg_response_minutes, is_demo, lat, lng, distance_m }`. Preços em **Kz**, tempo em **minutos**. Devolve 8–13 prestadores por categoria. As coordenadas seguem o `p_lat/p_lng` enviado (no emulador a localização é a Califórnia: os pins aparecem lá à mesma). Sem sessão → erro.
- `rpc('client_request_service_from_provider', { p_provider_profile_id, p_service_category_id, p_description (obrigatória), p_service_date = agora, p_address_id = null, p_observations = null })` → `uuid` do pedido. Erros pt-AO em `message` (ex.: "Prestador indisponível para este serviço", "Já enviou um pedido a este prestador. Aguarde a proposta dele"). Só papel `client`.
- Categorias: `service_categories` com `service_type = 'other_service'` e `is_active` (15; nomes já em pt-AO). A categoria "Motorista" (`trip`) **não** entra no autocomplete.
- 75 **prestadores fictícios** (`provider_profiles.is_demo = true`, e-mails `demo.*@demo.so-servicos.test`) + a conta real de teste **Miguel Prestador** (`miguelm@prestador.com`, Eletricista/Canalizador/Ar condicionado), que também aparece como pin e **é o único que pode responder** ao pedido (os outros são figurantes).
- Interruptor: `select value from system_settings where key='trips_enabled'` (cliente autenticado lê **só** essa chave; escrita só admin).
- Contas de teste (senha `123123`): `miguelm@cliente.com`, `miguelm@admin.com`, `miguelm@prestador.com`. O utilizador autorizou login real nelas.

## 4. App Cliente (repo `C:\Projetos\kz-servicos-app-cliente`) — o que fazer
1. **Interruptor** `tripsEnabled` (lido após o login, fallback `false`), exposto num único sítio (ex.: cubit/serviço) e usado para escolher a home. Código de viagens intocado.
2. **Tela "Buscar prestadores"**: parte do layout da tela de viagens (mapa + painel inferior + campo). Campo de texto "Que serviço procura?"; autocomplete reaproveita o componente/estilo do de endereço, filtrando categorias por nome **sem diferenciar acentos/maiúsculas** (e pela descrição); mostra ícone + nome + descrição curta. **Sem banner no topo.** Localização do cliente: pedir permissão; se negada/indisponível, centro de Luanda `(-8.8383, 13.2344)`.
3. **Procura**: ao escolher a categoria, animação de radar/pulso a partir do cliente com o texto **"A procurar prestadores próximos…"** (≥ ~2,5 s, mesmo que a resposta chegue antes), depois os **pins surgem em sequência** (animação de entrada), com ícone da categoria e cor da marca (`#FF9A52`), e a câmara enquadra todos. Chamar `search_service_providers` com a posição do cliente.
4. **Modal inferior** ao tocar num pin: avatar (iniciais se não houver foto), nome, categoria, nota ★ (n avaliações), **faixa de preço** (`5.500 – 38.500 Kz`, usar o `formatKz` existente), **"Responde em ~18 min"**, bio curta, botão **"Solicitar"**. Estados: carregando/erro tratados, textos pt-AO.
5. **Solicitar**: pede só a **descrição do serviço** (obrigatória; morada = localização atual, data = agora), chama `client_request_service_from_provider`, mostra confirmação e leva ao acompanhamento **existente** (lista/detalhe de pedidos com os estados reais e "aceitar proposta"). Erros do servidor mostrados tal como vêm (já em pt-AO).
6. **Testes** (TDD onde der): filtro do autocomplete (acentos), escolha da home pelo interruptor, formatação do cartão (Kz, minutos), mapeamento do JSON. Rodar `flutter analyze` (sem erros novos) e `flutter test`.
7. **Verificação real no emulador** (`emulator-5554`, login `miguelm@cliente.com`): buscar "canal…", escolher Canalizador, ver os pins, abrir um, solicitar ao **Miguel Prestador**, confirmar o pedido em "os meus pedidos". Capturas de ecrã no relatório. Dica: `adb emu geo fix 13.2344 -8.8383` põe o emulador em Luanda (opcional; funciona também na Califórnia).

## 5. Painel (`C:\Users\v27me\orca\workspaces\kz-servicos-web-app-fork\tellin`)
1. Ler `trips_enabled` (cliente Supabase com a sessão do admin) num hook único; **com `false`**: tirar "Viagens" do menu (Sidebar + gaveta mobile), esconder KPIs/atalhos de viagens do dashboard, e a rota `/viagens` **redireciona** para `/outros-servicos` (o código e a página ficam). **Com `true`**: tudo como antes.
2. Menu final com `false`: **Serviços** e **Entregas** (+ o que não é de viagens: Clientes, Prestadores, Financeiro, Logs, etc., como já estão). Renomear "Pedidos de produtos" → **"Entregas"** (rótulo e título; rota pode ficar).
3. **Interruptor de administração**: secção/cartão "Caronas (viagens)" com um switch **"Ativar caronas"** que escreve `system_settings.trips_enabled` (jsonb boolean) e atualiza o menu sem recarregar à mão. Colocar numa página existente (ex.: dentro de Entregas/Produtos ou Dashboard) ou numa página nova `/configuracoes`, à escolha, mas fácil de achar. Pedir confirmação ao ligar.
4. **Prestadores**: mostrar badge **"Demo"** nos `is_demo` e permitir filtrar por eles (os 75 fictícios não devem poluir a lista sem aviso). Ver também como o `ServiceFlowPanel` mostra um pedido direto (`searching_provider` com um convite): tem de ficar claro que o cliente escolheu aquele prestador.
5. `npm test`, `npm run lint` (sem erros novos), `npm run build`; ver no browser com `miguelm@admin.com` (autorizado) com `trips_enabled=false` e depois ligado e desligado outra vez (**deixar `false` no fim**).

## 6. Prestador (`C:\Projetos\kz-servicos-app-prestador`) — só verificação
Confirmar que um pedido direto aparece ao prestador (`miguelm@prestador.com`) como convite normal, com o texto do cliente, e que **propor preço** funciona. Criar o pedido de teste por script (RPC como `miguelm@cliente.com`) e **cancelá-lo no fim** (nunca apagar). Corrigir só o que estiver realmente quebrado no lado do prestador.

## 7. Regras (iguais às anteriores)
Nada de apagar no banco · SQL/mudanças de banco só através da `tellin-52` · zero segredos no git · um único escritor por repo · commits locais no branch atual com `git add <caminhos>` (nunca `-A`), mensagem em pt terminada com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, **sem push** (publico eu, depois de verificar) · evidência (comandos e saída real) antes de dizer "feito" · relatório curto (≤ 12 linhas) à `tellin-52`.
