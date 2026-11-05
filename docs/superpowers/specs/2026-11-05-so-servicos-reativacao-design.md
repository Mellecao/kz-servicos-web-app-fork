# Só Serviços — Reativação do ecossistema para Luanda (design + contrato de orquestração)

Data: 2026-11-05 · Orquestradora: sessão `tellin-52` · Aprovado pelo usuário (Guilherme) em chat.

## 1. Intenção
O ecossistema KZ Serviços ficou parado meses. Vai ser **revendido**, operando em **Luanda, Angola**, com a marca **Só Serviços** ("Serviços de apoio ao domicílio"). A demo para venda tem de estar **limpa, bonita e a funcionar**; features novas valem menos que o que já existe funcionar muito bem.

Três apps, **um só backend** (Supabase `mtsqeomctrqfyekyzapc`):

| App | Pasta | Stack |
|---|---|---|
| Painel admin | `C:\Users\v27me\orca\workspaces\kz-servicos-web-app-fork\tellin` (worktree) | Next.js 16 + Tailwind 4 + Supabase |
| App Cliente | `C:\Projetos\kz-servicos-app-cliente` | Flutter (clientes: viagens e serviços) |
| App Prestador | `C:\Projetos\kz-servicos-app-prestador` | Flutter (motoristas e prestadores) |

## 2. Objetivos / não-objetivos / anti-objetivos
**Objetivos:** (1) marca e cores novas nos 3 apps; (2) tudo em português de Angola; (3) módulo "Pedir produtos" no app Cliente + gestão no painel; (4) fluxo de **serviços** testado de ponta a ponta e a funcionar bem.
**Não-objetivos (agora):** pagamentos online reais, integração Multicaixa, publicar nas lojas, novo projeto Firebase, entregadores no app Prestador para produtos (pedidos de produtos são geridos pelo admin).
**Anti-objetivos:** perder/apagar dados; segredos no git; "funciona só no meu PC"; quebrar o fluxo de viagens/serviços ao mexer em textos.

## 3. Regras inegociáveis (valem para TODAS as sessões)
1. **Nunca apagar nada do banco.** Alterações de banco = **só aditivas**, num ficheiro `.sql` novo em `supabase/migrations/`. **Só a `tellin-52` aplica SQL no banco**: se precisar de mudança, escreva o `.sql` e peça-me por mensagem.
2. **Zero segredos no git.** Chaves vivem em `.env.local` (painel, já criado e ignorado), `--dart-define`/variáveis de ambiente (Flutter). Nunca coloque chaves em ficheiros versionados nem em mensagens para mim.
3. **Sem `git push`. Sem `git commit` por agora** — o utilizador ainda não autorizou commits; deixe tudo na working tree. Nunca `git add -A`/`reset --hard`/`clean`/`checkout .` (há alterações prévias de outros em alguns repos). Não crie branches sem eu pedir.
4. **Âmbito:** edite só o seu repo (secção 8). Não toque noutras sessões nem noutros projetos (corretor-remax, burrfish, jormungandr não são nossos).
5. **Sem perguntas ao utilizador.** O brainstorming está concluído. Se ficar bloqueado: mensagem para `tellin-52` (curta, com o que tentou).
6. **Evidência antes de afirmar:** só diga "feito" depois de correr os comandos de verificação e ler o resultado (painel: `npm run lint` e `npm run build`; Flutter: `flutter analyze` e `flutter test`). Se algo já falhava antes de mexer, registe como baseline, não esconda.
7. **pt-AO em todo o texto visível** (secção 5). Identificadores de código ficam em inglês.
8. **YAGNI/DRY:** um único formatter de Kz, um único sítio para constantes da marca. Não reescreva o que funciona.
9. Flutter: **não** altere `applicationId`/bundle id nem `firebase_options.dart`/`google-services.json` (push depende deles; é item em aberto para o utilizador).

## 4. Marca
Assets prontos em `C:\Users\v27me\orca\workspaces\kz-servicos-web-app-fork\tellin\public\brand\` (copie para o seu repo; **não** gere novos):
`logo-horizontal-white.png` (para fundo ESCURO), `logo-horizontal-dark.png` (para fundo CLARO), `logo-icon.png`, `app-icon-1024.png`, `app-icon-foreground-1024.png` (adaptativo Android; fundo `#16161D`), `app-icon-monochrome-1024.png`, `favicon.ico`, `favicon-{32,180,192,512}.png`, `splash-1242x2688.png`, `brand.json`.

**Tokens:** primária (laranja) `#FF9A52` · escura (hover/pressed) `#E68B4A` · clara `#FFB27A` · rosa `#E54C65` · texto sobre primária `#1F2430` (**não** use branco sobre laranja: contraste fraco) · degradê da marca `#E54C65 → #FF9A52`.
**Substituir o amarelo antigo** (`#FEBF22`, `#e5ab1e`, `#FFD700`, `#FFA000`, variantes `amber`/`yellow` do Tailwind) pela família laranja, incluindo os degradês "mesh" do onboarding do Cliente. Mantenha as outras cores (verde de sucesso, azul secundário) salvo se destoarem.
**Nome visível:** "Só Serviços" (label Android, `CFBundleDisplayName` iOS, `<title>`/manifest web, ecrãs de login/splash/onboarding/cabeçalhos/e-mails de texto). Ícones do launcher e splash nativo com os assets acima.

## 5. Angola (localização)
| Tema | Regra |
|---|---|
| Idioma | Português de Angola (norma europeia/angolana). Flutter: `Locale('pt','AO')`, fallback `pt_PT` se o `intl` não tiver `pt_AO` (verifique). |
| Vocabulário | ecrã (não tela) · telemóvel (não celular) · utilizador (não usuário) · palavra-passe (não senha) · ficheiro · autocarro (não ônibus) · viatura/carro · canalizador (não encanador) · carpinteiro (não marceneiro) · empregada doméstica/limpeza (não faxineira/diarista) · controlo de pragas (não dedetizador) · "viagem" no lugar de "corrida"/"carona" · "Terminar sessão" (não Sair/Logout) · "Eliminar" · "Ficheiro" · "Botija de gás" (não botijão). Evite brasileirismos ("você" → tratamento neutro/"o seu", "legal", "tá", gerúndio brasileiro "estou fazendo" → "estou a fazer"). |
| Moeda | **Kwanza (AOA)**, formato `1.500,00 Kz` (milhar `.`, decimal `,`, sufixo ` Kz`). Um único helper `formatKz(num)` por app. Remover todo `R$`. |
| Telefone | **Mostrar** como `+244 9XX XXX XXX`; **gravar** SEMPRE em E.164 sem espaços (`+244923000001`) — igual nos 3 apps, para pesquisa, WhatsApp e SMS. Móvel: 9 dígitos começados por 9; fixo de Luanda: 9 dígitos começados por 2. Máscara e validação; DDI padrão **+244** (remover `+55`/DDD). Dados legados (+55, etc.) ficam intactos. Pesquisa por telefone compara só os dígitos. |
| Documento | CPF/CNPJ → rótulo **"BI / NIF"**; validação permissiva (alfanumérica 9–14). A coluna `users.cpf` **mantém-se** (não renomear). |
| Pagamento | Esconder `pix`. `debit` → "Multicaixa / cartão de débito"; `credit` → "Cartão de crédito"; `cash` → "Numerário"; `billing` → "Faturação". `bank_pix_key` → rótulo "IBAN"; `bank_agency` → "Agência". |
| Morada | Remover CEP e UF. `state` → "Província" (Luanda). Exemplos/placeholder: Talatona, Maianga, Ingombota, Viana, Kilamba, Cazenga, Belas, Cacuaco. |
| Mapa | Centro padrão Luanda `(-8.8383, 13.2344)`; Places restrito a Angola (`componentRestrictions: country:ao` / `includedRegionCodes:["ao"]`, `region=ao`, idioma `pt-PT`); geocoding com `region=ao`. |
| Datas | `dd/MM/yyyy`, 24 h, fuso `Africa/Luanda` (UTC+1). |
| Suporte/WhatsApp | O número do suporte (`akira_whatsapp.dart` no Cliente) é do Brasil: ponha numa **única constante** com placeholder `+244 900 000 000` e avise-me para eu pedir o número real ao utilizador. |

| Marca nos textos | Toda menção à marca antiga **"KZ"/"KZ Serviços"/"equipe KZ"/"pela KZ"** nos textos visíveis passa a **"Só Serviços"** (ex.: "Esta viagem foi cancelada pela Só Serviços."). "Corrida em andamento" → "Viagem em curso"; "aguardando/buscando" → "a aguardar/à procura". Não mexa em identificadores de pacote/projeto. |

Textos que vêm do **banco** (mensagens de RPC/triggers/notificações) já foram passados para pt-AO pela `tellin-52` (migrations `20261105130000` e `20261105131000`); avise-me se ainda vir texto brasileiro vindo do servidor.

**Nomes de categorias (DB) — renomeação combinada:** o banco passará a ter estes nomes (slugs não mudam). O Prestador usa o **nome** como chave (`core/constants/category_colors.dart` e a lista fixa em `registration_page.dart`): a `tellin-a5` deve passar a aceitar **os nomes novos** (e, se simples, também os antigos como alias) e **avisar-me quando estiver feito** — só então eu aplico o UPDATE no banco. Preferível indexar por `slug` onde o app já o recebe.

| slug | nome antigo | nome novo |
|---|---|---|
| `plumber` | Encanador | **Canalizador** |
| `cleaner` | Faxineira | **Limpeza geral** |
| `housekeeper` | Diarista | **Empregada doméstica** |
| `ac_technician` | Ar-condicionado | **Ar condicionado** |
| `carpenter` | Marceneiro | **Carpinteiro** |
| `pest_control` | Dedetizador | **Controlo de pragas** |

Os restantes ficam iguais (Pedreiro, Técnico de Informática, Serralheiro, Chaveiro, Montador de Móveis, Motorista, Pintor, Jardineiro, Eletricista, Vidraceiro).

## 6. Módulo de produtos (contrato fechado — já aplicado no banco)
Migration: `supabase/migrations/20261105120000_products_module.sql` (lê-a antes de codar). Resumo:
- `products(id, slug, name, description, unit_label, price numeric, image_url, is_active, sort_order)` — 8 produtos seed: `agua-cisterna`, `gelo-escama`, `gelo-cubos`, `agua-20l`, `agua-10l`, `botija-6kg`, `botija-12kg`, `botija-25kg`. **Preços são EXEMPLOS** (editáveis no painel).
- `product_orders(id, client_id, status, delivery_address, delivery_reference, delivery_lat/lng, contact_phone, notes, payment_method, subtotal, delivery_fee, total, cancel_reason, confirmed_at, delivered_at, cancelled_at, created_at)` · status: `pending → confirmed → out_for_delivery → delivered` ou `cancelled`.
- `product_order_items(order_id, product_id, product_name, unit_price, quantity, line_total)`.
- **Cliente cria pedido só por RPC** (`create_product_order(p_items jsonb, p_delivery_address, p_delivery_reference, p_delivery_lat, p_delivery_lng, p_contact_phone, p_notes, p_payment_method) → uuid`; `p_items = [{"product_id":"<uuid>","quantity":2}]`). Os preços vêm sempre do catálogo, no servidor. Cancelar: `cancel_product_order(p_order_id, p_reason)` (só `pending`).
- RLS: cliente vê só os seus pedidos; admin vê/edita tudo; catálogo visível a autenticados (admin vê inativos). Realtime ativo em `product_orders`. Mudança de estado notifica o cliente (`notifications`, `type='product_order'`); pedido novo notifica admins. Taxa de entrega em `system_settings.product_delivery_fee` (valor atual 1000).

**App Cliente — UI exigida:** entrada "Produtos" na home; catálogo (cartões com ícone Material por produto, preço em Kz, stepper de quantidade); carrinho com total; checkout (morada via o seletor/Places já existente, referência, telemóvel, pagamento `cash|debit|credit`, notas, resumo subtotal+taxa+total) → RPC; ecrã de sucesso; "Os meus pedidos" com detalhe e linha de estado em tempo real; cancelar enquanto `pending`. Estados vazio/erro/carregamento tratados, textos pt-AO.
**Painel — UI exigida:** página **Pedidos de produtos** (`/pedidos-produtos`, no menu): vista por estado (kanban ou lista, reaproveite `KanbanBoard`/`KanbanListView` se servir), detalhe com itens/cliente/telefone/morada (+ link Google Maps), avançar estado e cancelar com motivo, atualização em tempo real; página **Produtos** (`/produtos`): editar nome, descrição, preço, ordem, ativar/desativar (**sem eliminar**) e editar a taxa de entrega.

## 7. Serviços ("tem de funcionar super bem")
Fluxo `service_requests` (estados: `open, under_review, review_rejected, searching_provider, assigned, in_progress, finished, cancelled, awaiting_client_confirmation, awaiting_provider_confirmation`) + convites a prestadores (`service_request_provider_candidates`) + propostas de preço (`service_request_proposals`) + chat + avaliações. Fase 5 será detalhada depois das fases 1–4; até lá, **anote** (não corrija fora de âmbito) qualquer bug que veja no fluxo de serviços do seu app e inclua-o no relatório.

Utilizadores de teste (palavra-passe `<palavra-passe de teste: pedir ao utilizador>`): `miguelm@cliente.com` (cliente) · `miguelm@admin.com` (admin) · `miguelm@prestador.com` (prestador **não motorista**, aprovado: Eletricista/Canalizador/Ar condicionado).

## 8. Divisão do trabalho
| Sessão | Repo (caminho absoluto) | Entrega |
|---|---|---|
| `tellin-da` | `C:\Projetos\kz-servicos-app-cliente` | marca → Angola → **módulo de produtos (Cliente)** → serviços |
| `tellin-a5` | `C:\Projetos\kz-servicos-app-prestador` | marca → Angola → serviços (lado prestador) |
| `tellin-18` | `C:\Users\v27me\orca\workspaces\kz-servicos-web-app-fork\tellin` (só `src/`, `public/` exceto `public/brand/`, `package.json`) | marca → Angola → **Pedidos de produtos + Produtos (painel)** → serviços (painel) |
| `tellin-52` | banco, `supabase/`, `docs/superpowers/handoff/` | migrations, usuários, textos do servidor, integração e2e, STATUS |

Ordem em cada sessão: (1) **baseline** (instalar, analisar/lint/build/test, registar o que já falha) → (2) marca → (3) Angola → (4) produtos (Cliente e painel) → (5) serviços. Escreva um plano curto antes de cada fase (skill `writing-plans`) e use TDD onde o repo já tem testes.

**Relatório** (mensagem a `tellin-52`, ≤ 12 linhas) ao fechar cada marco (1, 2+3, 4): o que ficou feito · comandos de verificação e resultado real · ficheiros/áreas tocadas · bugs encontrados · bloqueios.

## 9. Ambiente (Windows / PowerShell)
```powershell
# Flutter + JDK (o Java do PATH é 1.8 e NÃO serve; use o JDK 21):
$env:PATH = "C:\Users\v27me\flutter\bin;" + $env:PATH
$env:JAVA_HOME = "C:\Users\v27me\.jdks\jdk-21.0.12.1+1"; $env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH
# Chave do Maps (não commitar): ler do .env.local do painel
$env:GOOGLE_MAPS_API_KEY = (Select-String -Path 'C:\Users\v27me\orca\workspaces\kz-servicos-web-app-fork\tellin\.env.local' -Pattern '^GOOGLE_MAPS_API_KEY=(.*)$').Matches[0].Groups[1].Value
flutter run -d emulator-5554 --dart-define=GOOGLE_MAPS_API_KEY=$env:GOOGLE_MAPS_API_KEY
```
- Emulador Android partilhado já em execução: `emulator-5554` (Android 15). **Não o reinicie nem limpe dados.** Os dois apps podem coexistir nele; para testes sem emulador há `-d chrome` (web; `web/google_maps_config.js`, confirme que está no `.gitignore`).
- Supabase URL `https://mtsqeomctrqfyekyzapc.supabase.co`. Os apps Flutter têm a chave anon **legacy** fixa em `main.dart` (pública por desenho, mesmo projeto): **deixe como está** por agora.
- A skill de banco do utilizador (https://github.com/BlackElephant-from-Brazil/kz-database-skill, clonada em `C:\Users\v27me\AppData\Local\Temp\kzskill`) está **desatualizada** (28/04, outro projeto Supabase, 22 tabelas vs 36): use só como mapa. A verdade é o banco; peça-me introspeção se precisar.
- Item **em aberto para o utilizador** (não é seu): a chave legacy `service_role` está embutida em triggers/migrations antigas do histórico remoto → rotacionar antes da entrega ao comprador.
