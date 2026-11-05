---
name: kz-database
description: Use ao escrever queries ou código do cliente Supabase, tipos que mapeiam tabelas, políticas RLS, triggers, RPCs ou realtime, e ao depurar erros de dados (coluna em falta, permission denied) no banco do Só Serviços (KZ Serviços).
---

# Banco de dados — Só Serviços

Um único backend Supabase serve os 3 apps (painel admin Next.js, app Cliente e app Prestador, ambos Flutter).
URL: `https://mtsqeomctrqfyekyzapc.supabase.co` (projeto `mtsqeomctrqfyekyzapc`). **As chaves não estão aqui nem no git**: o painel lê-as de `.env.local`.
A verdade é sempre o banco real: as references abaixo foram geradas a partir dele em 2026-11-05.

## Regras inegociáveis

1. **Nunca apagar dados do banco** (nem `DELETE`/`TRUNCATE`/`DROP` sobre dados). Produtos e pedidos desativam-se ou cancelam-se, não se eliminam. Alterações de esquema são **só aditivas**, num ficheiro novo em `supabase/migrations/<timestamp>_<nome>.sql`.
2. Quem aplica SQL no banco é a pessoa responsável pelo banco: escreve-se o `.sql` e pede-se a aplicação.
3. **Zero segredos no git** (chaves, tokens, JWT). Nunca colar chaves em ficheiros versionados ou nestas references.
4. **Ao criar uma migration, atualizar as references** correspondentes: `schema.md` (tabelas, colunas, enums), `rls-policies.md`, `triggers.md`, `functions-and-rpcs.md`, `api-endpoints.md`.
5. As migrations exportadas do histórico remoto são um snapshot e não garantem replay limpo; o corpo das funções vive lá, não nas references.

## Papéis e acesso

`users.role`: `client` | `provider` | `admin`. As políticas usam `get_user_role()`. O admin vê e altera quase tudo; o cliente vê o que é seu; o prestador vê só pedidos em que é o prestador **ou foi convidado** (`service_requests_select_invited_provider`). Detalhe em `references/rls-policies.md`.

## Fluxo de serviços (`service_requests`)

Estados: `open → under_review → searching_provider → awaiting_client_confirmation → awaiting_provider_confirmation → assigned → in_progress → finished`; laterais: `review_rejected` e `cancelled`.

1. O cliente cria o pedido (`open`; o admin também pode criar).
2. Admin: «Iniciar análise» (`under_review`), depois «Aprovar» (`searching_provider`) ou «Rejeitar» com motivo (RPC `reject_service_request` → `review_rejected`; o motivo fica em `service_request_status_history.observations`).
3. Admin convida prestadores aprovados que cobrem a categoria (insert em `service_request_provider_candidates`, `status = pending`; UNIQUE pedido+prestador). Não existe tabela `service_request_proposals`: os preços estão nos candidatos (`offered_price`, `kz_proposed_price`).
4. Admin escolhe com a RPC `select_service_request_provider(pedido, prestador, preço)`: o pedido passa a `awaiting_client_confirmation` com `final_price`, o candidato fica `accepted` e os restantes `rejected`.
5. Passar a `assigned` com prestador definido (vindo de `searching_provider` ou `awaiting_client_confirmation`) fica `awaiting_provider_confirmation` por trigger. Os passos de confirmação do cliente e do prestador, e o fim do fluxo, ainda estão por validar no teste ponta a ponta.
6. Cancelar rejeita os candidatos `pending`/`accepted` (trigger). Cada mudança de estado grava `service_request_status_history`.

O painel barra `awaiting_*`, `assigned`, `in_progress` e `finished` sem prestador definido, porque o banco aceitaria.

## Fluxo de produtos (`products`, `product_orders`, `product_order_items`)

- Catálogo em `products` (`is_active`, `sort_order`); o admin edita e desativa, **não elimina**. Os preços iniciais são exemplos.
- O cliente cria o pedido **só pela RPC** `create_product_order(p_items, p_delivery_address, ...)`: os preços vêm sempre do catálogo, no servidor; a taxa de entrega vem de `system_settings.product_delivery_fee`.
- Estados: `pending → confirmed → out_for_delivery → delivered`, ou `cancelled`. O cliente cancela só em `pending` (RPC `cancel_product_order`); o admin avança estados e cancela com `cancel_reason` por update.
- Triggers preenchem `confirmed_at`/`delivered_at`/`cancelled_at` e notificam o cliente (`notifications.type = 'product_order'`); pedido novo notifica admins. Realtime ativo em `product_orders`.

## Convenções de dados (Angola)

- **Telefone**: gravar sempre em E.164 sem espaços (`+244923000001`); mostrar como `+244 9XX XXX XXX` (`formatPhoneAO`). Dados legados (+55, etc.) ficam intactos.
- **Moeda**: Kwanza, `formatKz` (`1.500,00 Kz`); valores em `numeric`. Datas `dd/MM/yyyy`, 24 h, fuso `Africa/Luanda`.
- **Colunas legadas mantidas** (não renomear): `users.cpf` (rótulo «BI / NIF»), `addresses.zip_code`, `payment_method = 'pix'` (escondido das opções), `provider_profiles.bank_pix_key` (rótulo «IBAN»), `bank_agency` («Agência»).
- Slugs de `service_categories` são estáveis; os nomes estão em pt-AO (Canalizador, Limpeza geral, Empregada doméstica, ...).

## No código do painel

- Cliente Supabase: `src/lib/supabase.ts`. Chamadas por área: `src/lib/api.ts` (viagens, serviços, utilizadores), `src/lib/products-api.ts` (produtos e pedidos), `src/lib/service-flow-api.ts` (análise, convites e escolha de prestador).
- Lógica pura e testada: `src/lib/product-orders.ts`, `src/lib/service-requests.ts`, `src/lib/format.ts`, `src/lib/payment.ts`.
- Tipos das tabelas: `src/types/database.ts` (atualizar junto com as migrations).

## Índice das references

| Ficheiro | Conteúdo |
|---|---|
| `references/schema.md` | Enums e, por tabela, colunas, tipos, nulos, defaults, PK/FK/UNIQUE/CHECK; tabelas do domínio em destaque; realtime |
| `references/rls-policies.md` | Políticas RLS por tabela (comando, papéis, USING, WITH CHECK) |
| `references/triggers.md` | Triggers por tabela (quando, eventos, condição, função) |
| `references/functions-and-rpcs.md` | RPCs e funções de trigger (assinatura, security definer, uso) |
| `references/api-endpoints.md` | REST/RPC/Realtime, operações permitidas por tabela, embeds usados e rotas Next do painel |
