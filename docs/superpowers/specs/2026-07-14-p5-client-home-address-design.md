# P5 — Salvar endereço Casa e Trabalho no perfil do cliente

**Data:** 2026-07-14
**Autor:** Claude (kz-dev)
**Status:** Aprovado para implementação

## Problema

Na tela de Clientes, o admin não consegue registrar um endereço fixo do cliente (Casa/Trabalho). Isso é pré-requisito para P6, que precisa mostrar esses endereços como primeiras sugestões no autocomplete de Nova Viagem.

## Estado atual

A infraestrutura **já existe**:

- Migração `supabase/migrations/20260618170000_create_user_saved_addresses.sql` criou a tabela `user_saved_addresses(user_id, address_id, label CHECK IN ('home','work','custom'), custom_label)` com índice único parcial em `(user_id, label) WHERE label IN ('home','work')` (garante um só Home e um só Work por usuário).
- Tabela `addresses` já existe e é compartilhada com trips.
- RLS permite admin escrever em `users`, `addresses` e `user_saved_addresses`.
- `fetchClients` já traz `user_saved_addresses(*, addresses(*))` embutido.
- Componente `SavedAddressesSummary` já exibe Home/Work no card do cliente.
- Hook `useGooglePlacesAutocomplete()` e componente `SearchableSelect` já são reutilizados em `NovaViagemForm`.

**O que falta:** UI de edição e funções para persistir.

## Design

### Componente novo: `AddressAutocompleteField`

**Arquivo:** `src/components/AddressAutocompleteField.tsx`

Client component reutilizável. Props:

```ts
interface AddressAutocompleteFieldProps {
  label: string;
  placeholder?: string;
  value: GooglePlaceAddress | null;
  onChange: (value: GooglePlaceAddress | null) => void;
  disabled?: boolean;
}
```

Comportamento:
- Usa `useGooglePlacesAutocomplete()` internamente.
- Renderiza `SearchableSelect` com `options` do hook.
- Quando `value` é não-nulo, exibe o `formatted_address` como valor selecionado.
- Botão "Limpar" (X) ao lado do campo. Clique → chama `onChange(null)`.
- Ao selecionar uma opção do dropdown → chama `fetchGooglePlaceDetails(placeId, label)` e propaga o `GooglePlaceAddress` completo via `onChange`.

Este componente será reutilizado em P6 (com uma variante para pré-sugestões).

### Novas funções em `src/lib/api.ts`

Adicionar em uma nova seção logo após `createAddress` (linha 1428):

```ts
// ─── User Saved Addresses ─────────────────────────────────
export async function fetchUserSavedAddresses(userId: string): Promise<UserSavedAddress[]>;
export async function saveUserSavedAddress(
  userId: string,
  label: "home" | "work",
  address: GooglePlaceAddress,
): Promise<void>;
export async function removeUserSavedAddress(
  userId: string,
  label: "home" | "work",
): Promise<void>;
```

**`saveUserSavedAddress` implementação:**
1. `INSERT` novo row em `addresses` com todos os campos do `GooglePlaceAddress`.
2. `UPSERT` em `user_saved_addresses` por `(user_id, label)`:
   - Usa o índice único `idx_user_saved_addresses_unique_fixed_label`.
   - Se existir → atualiza `address_id` para o novo.
   - Se não → insere novo row.
3. Não deleta o `addresses` row antigo (pode estar em uso por trips ou outros).

Implementação usa duas queries: (a) SELECT do existente, (b) INSERT/UPDATE apropriado. Mais previsível que UPSERT com ON CONFLICT em cima do índice único parcial.

**`removeUserSavedAddress` implementação:**
- `DELETE FROM user_saved_addresses WHERE user_id = ? AND label = ?`. Não toca `addresses`.

**`fetchUserSavedAddresses` implementação:**
- `SELECT * FROM user_saved_addresses WHERE user_id = ? WITH JOIN addresses`.
- Usada apenas por completude — o `NovoClienteForm` lê direto de `client.user_saved_addresses` que já vem no prop.

### Alterações em `src/components/forms/NovoClienteForm.tsx`

**Novos estados:**
```ts
const [homeAddress, setHomeAddress] = useState<GooglePlaceAddress | null>(null);
const [workAddress, setWorkAddress] = useState<GooglePlaceAddress | null>(null);
const [originalHomeAddress, setOriginalHomeAddress] = useState<GooglePlaceAddress | null>(null);
const [originalWorkAddress, setOriginalWorkAddress] = useState<GooglePlaceAddress | null>(null);
```

**Helper para extrair endereço do `client.user_saved_addresses`:**
```ts
function extractSavedAddress(
  client: User | null | undefined,
  label: "home" | "work",
): GooglePlaceAddress | null {
  const saved = client?.user_saved_addresses?.find((sa) => sa.label === label);
  if (!saved?.addresses) return null;
  return {
    formatted_address: saved.addresses.formatted_address,
    // ...outros campos opcionais mapeados
  };
}
```

**No `useEffect(open, client)`:** popular `homeAddress`, `workAddress`, `originalHomeAddress`, `originalWorkAddress`.

**No `resetForm()`:** zerar os 4 estados.

**No JSX:** adicionar duas seções (uma para Casa, outra para Trabalho) usando `<AddressAutocompleteField>`.

**No `handleSubmit`, depois de `updateUserById`/`createUser`:**
```ts
if (client) {
  // Diff Home
  if (!isSameAddress(homeAddress, originalHomeAddress)) {
    if (homeAddress) {
      await saveUserSavedAddress(client.id, "home", homeAddress);
    } else {
      await removeUserSavedAddress(client.id, "home");
    }
  }
  // Diff Work (mesmo padrão)
  if (!isSameAddress(workAddress, originalWorkAddress)) {
    if (workAddress) {
      await saveUserSavedAddress(client.id, "work", workAddress);
    } else {
      await removeUserSavedAddress(client.id, "work");
    }
  }
}
```

**`isSameAddress`:** compara `formatted_address` e `google_place_id` (se ambos existem). Simples e suficiente — se o usuário selecionar o mesmo endereço, o `google_place_id` bate.

Para criação (`!isEditing`, sem `client.id` ainda), os endereços salvos são ignorados nesta iteração — usuário pode reabrir e editar. Alternativa (fazer INSERT em cadeia após createUser) fica fora do escopo pra manter simplicidade.

### Sem alterações

- Nenhum SQL / migration nova.
- Nenhuma alteração em `SavedAddressesSummary` (já lê `user_saved_addresses` corretamente).
- Nenhuma alteração no API route `/api/users/[id]` — o save de endereços vai pelo Supabase client direto (RLS já permite admin).

## Data flow

**Carregar:**
```
Modal abre → useEffect(open, client) →
  extractSavedAddress(client, 'home') → homeAddress + originalHomeAddress
  extractSavedAddress(client, 'work') → workAddress + originalWorkAddress
```

**Salvar:**
```
handleSubmit →
  1. updateUserById(id, dadosBase)  [já existente]
  2. Diff home: se mudou → save/remove
  3. Diff work: se mudou → save/remove
  4. Toast success + onSuccess (refetch de clientes)
```

## Edge cases cobertos

- Cliente novo (create) → homes/works ignorados (documentado; usuário abre depois para editar).
- Cliente sem home/work → campos vazios, sem operação.
- Alterou só nome → nenhum save/remove em endereços (diff detecta).
- Trocou Home A → Home B → cria novo `addresses`, atualiza `user_saved_addresses.address_id`. Row antigo em `addresses` permanece (pode estar em uso por trips).
- Removeu Home → DELETE em `user_saved_addresses`, `addresses` intocado.
- Erro em save de endereço após save de dados base → toast erro, dados base já persistidos. Admin pode reabrir e tentar de novo.
- Google Places falha → `fetchGooglePlaceDetails` já retorna fallback com apenas `formatted_address` e `google_place_id`. Salvamos assim mesmo.

## Testes

**Automatizados:** nenhum novo (decisão do usuário).

### Checklist manual

1. Abrir Clientes, editar um cliente sem endereços salvos.
2. Digitar em "Endereço Casa" → dropdown aparece com sugestões Google.
3. Selecionar uma → aparece o `formatted_address` no campo, botão "Limpar" visível.
4. Digitar em "Endereço Trabalho" e selecionar outro endereço.
5. Salvar → toast success, modal fecha.
6. Reabrir o mesmo cliente → Home e Work aparecem populados corretamente.
7. Trocar o endereço da Casa por outro → salvar → reabrir → confirma que atualizou.
8. Clicar "Limpar" na Casa → salvar → reabrir → Casa vazio, Trabalho intacto.
9. Editar só o nome → salvar → confirma no console/network que não teve INSERT/UPDATE em `user_saved_addresses`.
10. `SavedAddressesSummary` no card do cliente deve refletir os endereços salvos (era pra já funcionar sozinho).

## SQL

**Nenhum.**

## Fora do escopo

- Salvar endereços no fluxo de criação de cliente (só edição por enquanto).
- Suporte a `label = 'custom'` (a UI só expõe Home e Work).
- Deletar `addresses` órfãs (limpeza pode ser feita em rotina separada; RESTRICT no FK impede deleção acidental).
- API server-side dedicada — usamos Supabase client direto (RLS cobre).
- P6 (autocomplete inteligente em Nova Viagem) — spec separado, este é pré-requisito.
