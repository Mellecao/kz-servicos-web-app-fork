# Escopo completo — 6 subprojetos (backlog)

**Data:** 2026-07-29
**Origem:** briefing inicial do Guilherme na conversa que decompôs o escopo em 6 subprojetos e começou pelo Flash.
**Status:** Flash entregue (backend + admin). Subprojetos 2–6 pendentes.

Este documento preserva a descrição original do Guilherme dos 6 subprojetos. Cada um vira um ciclo próprio: **brainstorming → spec → writing-plans → execução → verificação**. NÃO tratar como spec pronto — usar como fonte para gerar spec quando cada subprojeto começar.

**Codebases envolvidos em todos:**
- Admin: `C:\Projetos\kz-servicos-web-app-fork` (Next.js)
- App cliente: `C:\Projetos\kz-servicos-app-cliente` (Flutter, BLoC/Cubit, go_router)
- App prestador: `C:\Projetos\kz-servicos-app-prestador` (Flutter, StatefulWidget + services, go_router)
- Supabase (via MCP direto em produção)

---

## Subprojeto 1 — Corrida Flash (ENTREGUE)

Descrição: "Preciso de uma viagem agora" — corrida instantânea sem aprovação admin, dispatch p/ todos motoristas aprovados, propostas com preço livre, cliente escolhe, motorista faz re-check.

**Status:** backend + admin entregues. Falta apps cliente + prestador (Fases 5–6 do plano `2026-07-29-corrida-flash-plan.md`).

Ver: `docs/superpowers/specs/2026-07-29-corrida-flash-design.md`
Ver: `docs/superpowers/plans/2026-07-29-corrida-flash-plan.md`

---

## Subprojeto 2 — Corrida Agendada (Cotação + Escolha seu Motorista)

**Original do Guilherme:**

> Corrida agendada: Ao clicar nessa opção, duas opções são mostradas: (Cotação) (A KZ buscara o melhor motorista com o melhor preço para você "disponivel apenas das 07:00AM as 20:00" (caso esteja forta do horario o botão fica cinza indisponivel) e (Escolha seu motorista) caso voce ja tenha um motorista favorito, faça uma cotação direto com ele (disponivel a qualquer horario).
>
> A cotação é a corrida como ja funciona atualmente, passando por todos os passos no painel adm.
>
> A escolha seu motorista, ao clicar nessa opção o usuario vai escolher os endereços, depois digitar os detalhes da corrida e por fim, escolher o motorista desejado. uma tela com todos os motoristas disponiveis ficara aberta e o passageiro pode escolher um motorista para enviar a solicitação de corrida, ele tambem pode abrir um chat com o motorista. esse chat, para o motorista, deve mostrar que é uma viagem ainda não agendada e com todos os detalhes.
>
> ao selecionar o motorista, o motorista recebe a solicitação, após isso a corrida é automaticamente agendada.
>
> deve ficar claro nessa solicitação que é uma solicitação de AGENDAMENTO. (para motoristas)

**Pontos-chave para brainstorm:**
- Ponto de entrada: BottomSheet inicial (mesmo do Flash — a opção "Agendamento" abre outro sub-menu com Cotação vs Escolha)
- Janela horária da Cotação: 07:00-20:00 (timezone SP). Fora disso, botão cinza. Fuso configurável? Persistir em `system_settings`?
- Estender `trip_type` enum: adicionar `'scheduled_quote'` (Cotação) e `'scheduled_choose_driver'` (Escolha seu Motorista) — deixa espaço pré-reservado desde a Fase 1 do Flash.
- **Cotação** = fluxo standard atual (admin aprova, seleciona motorista, etc.). Só muda o discriminator e a entry UI.
- **Escolha seu Motorista**: tela com todos motoristas disponíveis (definir "disponíveis": aprovados + com localização recente? Só aprovados? Filtro por categoria?). Cliente vê perfis, chat prévio, escolhe → solicitação vai direto para 1 motorista específico, sem admin approval.
- Chat prévio: reusa `chat_rooms`/`chat_messages`. Motorista vê marcação clara "SOLICITAÇÃO DE AGENDAMENTO — corrida ainda não confirmada".
- Ao motorista aceitar → corrida vira `scheduled` automaticamente. Sem re-check.
- Flag visual "AGENDAMENTO" no push e nas telas do motorista.

**Dependências:**
- Precisa das RPCs Flash prontas como referência de padrão (usar SECURITY DEFINER, revoke anon).
- Reusa infraestrutura de chat existente.

---

## Subprojeto 3 — Mapa admin de motoristas em tempo real

**Original do Guilherme:**

> no painel adm, deve ter uma opção no menu lateral que é um mapa aonde mostra a localização em tempo real de todos os motoristas (alguns usuarios ja compartilham localização em segundo plano e o app ja tem esse suporte). o mapa deve ter "zoom" no estado de sp na regiao de sao paulo até campinas.

**Pontos-chave para brainstorm:**
- Nova rota no admin: `/mapa-motoristas` ou similar. Item no `Sidebar.tsx`.
- Fonte de dados: `driver_locations` (já existe, atualizado pelo prestador a cada 5s via `active_trip_page.dart`).
- Subscrição realtime em `driver_locations` filtrada por `updated_at > now() - 10 min` (só ativos).
- Zoom inicial: SP → Campinas. Bounds fixos ou centralizados em coordenada específica com raio.
- Renderizar via Google Maps JS (já usa no admin) ou Mapbox — checar o que já está integrado.
- Ícone customizado por motorista (foto? status? tem trip ativa vs livre?).
- Popup ao clicar no marker: nome, veículo, se está em corrida (linkar pra `/viagens?openTrip=X`).
- **Escopo isolado** (não toca em fluxo de corrida). Bom candidato pra ser feito em paralelo com outros subprojetos ou por outro dev.

**Dependências:** nenhuma pesada. Só que os motoristas continuem publicando `driver_locations` (já publicam).

---

## Subprojeto 4 — Cliente vê localização do motorista em corrida em andamento

**Original do Guilherme:**

> o cliente deve conseguir ver a localização do motorista que ela esta com corrida "em andamento" ex: ele deve cosneguir ver aonde o motorista esta quando ele estiver indo buscar o passageiro.

**Pontos-chave para brainstorm:**
- App cliente: quando `trip.status IN ('scheduled','started')`, tela de "corrida em andamento" mostra mapa com pin do motorista se movendo em tempo real.
- Fonte: subscrição realtime em `driver_locations` do driver da trip (`driver_profile_id = trip.driver_profile_id`).
- Padrão de subscrição já existe no app cliente (canal `driver-loc-$driverProfileId`).
- Rota estimada: pin do motorista + pin do pickup até chegar; depois motorista + pin do dropoff.
- Precisa lidar com `execution_stage`: `to_pickup` vs `to_stop` vs `to_destination` — visual do mapa muda.
- Bonus: ETA calculada com haversine + velocidade média (já usado em ideias anteriores).
- **Pode encaixar naturalmente na tela existente** de "corrida em andamento". Não é feature nova, é refino.

**Dependências:** Flash entregue (a tela de corrida em andamento reusa fluxo padrão). Independente do resto.

---

## Subprojeto 5 — "Falar com o Akira" (suporte)

**Original do Guilherme:**

> no app cliente deve ter a opção "Falar com o akira", isso deve ser exibido na tela aonde mostra (cotação) e (escolher motoristas) como uma opção de suporte, quando a opção de "cotação" esta indisponivel (fora do horario).

**Pontos-chave para brainstorm:**
- Ponto de entrada: na tela do subprojeto 2 (opções da Corrida Agendada), quando "Cotação" está desabilitada (fora do horário 07-20h), aparece link/botão "Falar com o Akira" como fallback de suporte.
- Também disponível sempre em algum outro lugar (menu de suporte geral)?
- Akira = quem é? Chat direto? Bot? Humano de plantão? WhatsApp? Suporte via `support_chat` (já existe migração `20260714130000_support_chat.sql`)?
- Se via `support_chat`: reusa infraestrutura existente. Se via WhatsApp: só um `launchUrl('https://wa.me/...')`.
- **Subprojeto pequeno** — depende de decisões de negócio (canal de suporte). Provavelmente 1-2 dias.

**Dependências:** subprojeto 2 (a tela onde ele aparece).

---

## Subprojeto 6 — Outros Serviços com formulário livre

**Original do Guilherme:**

> na tela de solcitar "Outros serviços" no app cliente, deve haver um formulario unico ao solicitar serviço, aonde o usuario insere o titulo do problema, fotos, qual profissional ela precisa (escreve mesmo, sem opções pré-definidas) e o adm vai receber isso la no painel adm e re-passar para os prestadores (semelhante com o "buscando motoristas" das viagens), o prestador recebe a solicitação de trabalho, mas não igual a de motoristas, mais discreta no menu "agendamentos".

**Pontos-chave para brainstorm:**
- Substitui/refatora o fluxo atual de `service_requests` — hoje usa `service_categories` pré-definidas. Guilherme quer campo LIVRE ("qual profissional você precisa" — texto).
- Fluxo cliente:
  - Título do problema (texto)
  - Fotos (upload em `service_request_photos` — já existe)
  - Descrição do profissional (texto livre, sem enum) — nova coluna `service_requests.freeform_profession`?
  - Enviar → status `open` → admin recebe
- Fluxo admin: painel de service_requests já existe em `/outros-servicos/page.tsx`. Admin lê, decide para quais prestadores repassar.
- Fluxo prestador: recebe **"solicitação discreta"** em `Agendamentos` — não é push forte igual dispatch de motorista. Fica listada, prestador entra e aceita.
- **"semelhante ao 'buscando motoristas' das viagens" — mas discreto**: significa dispatch a múltiplos prestadores + preço livre, sem push agressivo?
- Precisa clarificar: como admin escolhe pra quem repassar? Match por categoria? Todos aprovados? Filtro?
- Já existe `service_request_proposals` (migration `20260701130000`) — aparentemente proposal system já parcialmente construído.
- **Subprojeto grande e isolado do fluxo de corrida** — pode ser feito totalmente em paralelo.

**Dependências:** nenhuma dos outros subprojetos.

---

## Ordem de execução acordada

1. ✅ **Subprojeto 1 — Corrida Flash** (backend + admin ENTREGUES; apps cliente+prestador PENDENTES)
2. **Subprojeto 4 — Localização do motorista p/ cliente** (pequeno, aproveita infra do Flash)
3. **Subprojeto 3 — Mapa admin ao vivo** (mesmo dado do 4)
4. **Subprojeto 2 — Corrida Agendada 2 modos** + **Subprojeto 5 — Falar com o Akira** (entram na mesma tela)
5. **Subprojeto 6 — Outros Serviços formulário livre**

Cada um roda seu ciclo próprio de brainstorming → spec → plan → execução.

---

## Contexto acumulado que serve para todos os próximos

**Padrões descobertos executando Flash:**

- **`add_all_approved_trip_candidates`** exige `admin` — para RPCs SECURITY DEFINER do cliente, **inlinar o INSERT** de candidatos.
- **Revoke anon** em toda RPC SECURITY DEFINER (advisor Supabase flagou). Padrão:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.foo(...) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.foo(...) TO authenticated;
  ```
- **App cliente Flutter:** BLoC/Cubit + `Supabase.instance.client` global + realtime `.channel().onPostgresChanges()`. Sem freezed — models manuais com `fromJson`+`toEntity`. Testes com `bloc_test` + `mocktail`.
- **App prestador Flutter:** StatefulWidget + services (não usa BLoC!). Push notif routing em `push_notification_service.dart::buildOpenedMessageLocation`. GPS publishing já roda no `active_trip_page.dart` (5s timer).
- **Admin (Next.js):** node:test (sem jest/RTL). Só função pura testável. Filtros em `src/lib/*`, componentes em `src/components/`, páginas em `src/app/(dashboard)/`.
- **Push:** trigger `trigger_push_on_candidate_insert` chama edge function `send-fcm-push` (não OneSignal direto). Payload agora inclui `trip_type` — pode variar título por tipo.
