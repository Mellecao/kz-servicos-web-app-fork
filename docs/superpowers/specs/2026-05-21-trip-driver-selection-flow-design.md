# Design: Fluxo de Seleção de Motorista por Corrida

**Data:** 2026-05-21  
**Status:** Aprovado

---

## Problema

O fluxo de corridas está incompleto e com comportamentos errados:

- O botão "Cheguei no local" no app motorista não faz nada
- O app motorista navega direto para a corrida ativa ao aceitar, antes do cliente confirmar
- O `DriverSelectionPanel` no app cliente usa dados mock — o cliente não consegue selecionar um motorista de verdade
- Não há real-time: ambos os apps precisam trocar de tela para atualizar dados
- O admin não tem como aprovar candidatos antes de mostrá-los ao cliente

---

## Fluxo Completo Aprovado

```
Cliente cria corrida (open)
  → Admin seleciona motoristas para receber (searching_drivers) [já existe]
    → Motoristas recebem no app, aceitam + dão preço (candidate: accepted + offered_price)
      → Admin vê candidatos com preços, aprova os que quer mostrar (admin_approved = true)
        → Cliente vê candidatos aprovados, seleciona um
          → Trip: driver_profile_id setado, status → scheduled
            → Motorista inicia corrida (started)
              → Motorista chega, trip progride, finaliza
```

---

## Seção 1: Banco de Dados

### Migration

Um único campo novo em `trip_driver_candidates`:

```sql
ALTER TABLE trip_driver_candidates 
  ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_trip_driver_candidates_admin_approved 
  ON trip_driver_candidates(trip_id, admin_approved);
```

### Regras de leitura por ator

| Ator | Filtro em `trip_driver_candidates` |
|------|-------------------------------------|
| Driver app | `status = 'pending'` (solicitações não respondidas) |
| Admin panel | `status = 'accepted'` (motorista respondeu com preço) |
| Client app | `admin_approved = true` (aprovados pelo admin) |

---

## Seção 2: Painel Admin (kz-servicos-web-app)

**Arquivo:** página de detalhe de corrida (onde já existe o campo de seleção de motoristas)

### O que muda

- Na lista de candidatos com `status = 'accepted'`, adicionar botão "Aprovar" por candidato
- Clique chama: `UPDATE trip_driver_candidates SET admin_approved = true WHERE id = X`
- Admin pode aprovar múltiplos candidatos
- Admin pode desaprovar: `admin_approved = false`

### O que NÃO muda

- Status da corrida permanece `searching_drivers` durante aprovação
- Admin não seleciona o motorista final — só libera quem o cliente pode ver
- A corrida só vai para `scheduled` quando o cliente escolher

---

## Seção 3: App Motorista (kz-servicos-app-prestador)

### Fluxo novo (vs. atual)

| Passo | Antes | Depois |
|-------|-------|--------|
| Aceitar solicitação | Navega para active_trip_page | Mostra banner na home |
| Aguardar cliente | — | Banner: "Aguardando passageiro aceitar" |
| Cliente seleciona motorista | — | Notificação: "Você foi selecionado!" |
| Entrar na corrida | Automático ao aceitar | Manual: toca na corrida agendada → active_trip_page |
| "Cheguei no local" | Não funciona (RLS falha) | Funciona (driver_profile_id já setado) |

### Real-time

Subscription em `trip_driver_candidates` filtrado pelo `driver_profile_id` do motorista logado. Quando candidatura é removida (cliente escolheu outro) ou trip vira `scheduled` (cliente escolheu este motorista), atualiza a UI.

### Arquivos afetados

- `lib/features/trip/presentation/pages/home_page.dart` — remover navegação direta, adicionar banner + seção "Corridas Agendadas"
- `lib/core/services/trip_service.dart` — adicionar subscription em `trip_driver_candidates`
- `lib/features/trip/presentation/pages/active_trip_page.dart` — sem mudança (fix é no ponto de entrada)

---

## Seção 4: App Cliente (kz-servicos-app-cliente)

### Fluxo novo

1. Cliente cria corrida → `searching_drivers`
2. Banner na home: *"Aguardando motoristas — sua corrida está sendo processada"*
3. Real-time subscription em `trip_driver_candidates` por `trip_id`
4. Cards de motorista aparecem automaticamente conforme admin aprova
5. Cliente seleciona → `acceptDriverCandidate()` (já existe) → `driver_profile_id` setado, status `scheduled`, outros candidatos deletados
6. Banner muda para: *"Motorista confirmado — aguardando motorista iniciar a corrida"*
7. Quando trip vira `started`, cliente entra na tela de corrida em andamento

### Arquivos afetados

- `lib/features/trip/presentation/widgets/driver_selection_panel.dart` — substituir mock por query real:
  ```
  trip_driver_candidates 
    WHERE trip_id = X AND admin_approved = true
    JOIN driver_profiles → provider_profiles → users
  ```
- `lib/features/trip/data/repositories/trip_repository_impl.dart` — adicionar subscription em `trip_driver_candidates`
- `lib/features/trip/presentation/cubit/pending_confirmations_cubit.dart` — integrar stream de candidatos aprovados

**Nenhum novo Cubit** — `PendingConfirmationsCubit` já existe e já consulta corridas em `searching_drivers`.

---

## Fix: "Cheguei no local" não funciona

**Causa raiz:** O motorista entrava na `active_trip_page` logo após aceitar a candidatura, antes do cliente confirmar. Nesse momento, `trips.driver_profile_id` é null, então a RLS UPDATE policy rejeita a escrita de `driver_arrived_at`.

**Fix:** Consequência direta do novo fluxo — motorista só acessa `active_trip_page` depois que o cliente seleciona, momento em que `driver_profile_id` já está setado. Nenhuma mudança extra necessária.

---

## Ordem de implementação

1. Migration (`admin_approved` em `trip_driver_candidates`)
2. Painel admin — botão de aprovação
3. App motorista — remover navegação direta, banner + corridas agendadas + real-time
4. App cliente — conectar `DriverSelectionPanel` a dados reais + real-time
