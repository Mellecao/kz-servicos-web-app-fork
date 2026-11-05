# Detalhes da corrida ao clicar num log (painel admin)

## Problema

Na página `/logs` do painel admin, cada log mostra apenas o `entity_id` (UUID cru) da corrida relacionada à ação. Não há como o admin ver de qual corrida se trata sem copiar o UUID e procurar manualmente em `/viagens`.

## Solução

Ao clicar numa linha de log que possua `entity_id`, abrir o `TripDetailModal` (já usado em `/viagens`) com os detalhes completos da corrida.

## Escopo

- Cobre apenas logs de **Viagens** (`trips`). Logs de "Outros Serviços" (`service_requests`) não abrem um modal dedicado agora — ficam fora de escopo deste spec (a coluna `entity_type` em `admin_logs` está sempre `'trip'` mesmo para logs de serviço, então hoje não há como distinguir os dois tipos de forma confiável; ver "Notas" abaixo).
- Linhas sem `entity_id` continuam não-clicáveis, como hoje.

## Fluxo

1. Linhas de log com `entity_id` preenchido viram clicáveis: trocar o `<div>` da linha por um `<button>` (mesmo padrão de `src/app/(dashboard)/viagens/page.tsx`), com `hover:border-primary/40 hover:bg-background` e `cursor-pointer`.
2. Ao clicar:
   - Marca a linha como carregando (`loadingLogId` no state) para dar feedback visual (ex.: pequeno spinner substituindo o ícone do entity_id).
   - Chama `fetchTripById(entity_id)` (já existe em `src/lib/api.ts:327`, mesma função usada internamente pelo `TripDetailModal`).
   - **Sucesso:** guarda a viagem retornada em `selectedTrip`, abre o modal (`tripModalOpen = true`).
   - **Erro** (viagem não encontrada — porque foi excluída, ou porque o `entity_id` pertence a um `service_request` e não a uma `trip`): dispara `toast("warning", "Não foi possível encontrar os detalhes desta corrida.")` via `useToast`. Nenhum modal abre.
   - Em ambos os casos, limpa `loadingLogId`.
3. `TripDetailModal` recebe `onUpdate={loadLogs}` — qualquer ação feita dentro do modal (aprovar, recusar, editar, etc.) recarrega a lista de logs para refletir novas entradas.

## Componentes afetados

- `src/app/(dashboard)/logs/page.tsx`:
  - Novo state: `selectedTrip: Trip | null`, `tripModalOpen: boolean`, `loadingLogId: string | null`.
  - Novo handler: `handleLogClick(entityId: string)`.
  - Linhas com `entity_id` viram `<button>` clicável; linhas sem `entity_id` continuam `<div>`.
  - Renderiza `<TripDetailModal trip={selectedTrip} open={tripModalOpen} onClose={...} onUpdate={loadLogs} />` no final do componente.
  - Usa `useToast` de `@/components/Toast`.
- Nenhuma mudança em `src/lib/api.ts`, banco de dados, ou tipos — reaproveita `fetchTripById` e `TripDetailModal` existentes.

## Fora de escopo / Notas

- Não corrige o bug pré-existente de `entity_type` sempre gravado como `'trip'` em `admin_logs` (ver `logAdminAction` em `src/lib/api.ts:46`). Isso é o motivo de não conseguirmos diferenciar visualmente, na lista, quais logs são de viagem vs. serviço antes de clicar.
- Não adiciona suporte a abrir `ServiceDetailModal` para logs de `service_requests` — possível follow-up futuro.
- Não há lógica pura nova que justifique teste unitário; a validação é manual via browser (ver plano de testes no plano de implementação).

## Plano de testes manuais

1. `npm run dev`, abrir `/logs`.
2. Clicar num log cujo `entity_id` é uma viagem existente → `TripDetailModal` abre com os dados corretos.
3. Clicar num log de uma viagem já excluída (ex.: log "Viagem excluída") → toast de aviso aparece, nenhum modal abre.
4. Clicar num log sem `entity_id` → nada acontece (linha não é clicável).
5. Clicar num log de "outro serviço" (`service_requests`) → toast de aviso aparece (comportamento esperado, fora de escopo).
6. Fazer uma ação dentro do modal (ex. aprovar) e confirmar que a lista de logs atualiza.
