# P6 — Autocomplete inteligente em Nova Viagem (Casa + Trabalho + histórico)

**Data:** 2026-07-14
**Autor:** Claude (kz-dev)
**Status:** Aprovado para implementação

## Problema

Ao criar uma nova viagem, o admin precisa digitar do zero em "Local de embarque" e "Local de destino", mesmo quando o cliente tem endereço fixo salvo e histórico recente. Isso é lento e sujeito a erro.

## Design

### Comportamento desejado por campo

Após o cliente ser selecionado:

- **Search vazio** → dropdown mostra:
  1. 🏠 Casa (se o cliente tem `user_saved_addresses.label='home'`)
  2. 💼 Trabalho (se `label='work'`)
  3. Últimos 4 endereços do histórico do respectivo campo (pickup_address para "Embarque", dropoff_address para "Destino"), de `trips WHERE client_id=? AND status<>'cancelled' ORDER BY created_at DESC`, deduplicados.
- **Search com 1+ caracter** → autocomplete normal do Google Places (sem sugestões pré-carregadas).
- **Apagar tudo** → sugestões pré-carregadas voltam.
- **Clicar fora** → dropdown fecha (comportamento nativo do SearchableSelect).

Sem cliente selecionado → sem sugestões pré-carregadas; comportamento igual ao atual.

### Componente novo: `AddressAutocompleteWithSuggestions`

**Arquivo:** `src/components/AddressAutocompleteWithSuggestions.tsx`

Props:

```ts
interface Props {
  label: string;
  placeholder?: string;
  value: string;                 // formatted_address ou vazio (mesmo formato que hoje)
  placeAddress: GooglePlaceAddress | null;
  onChange: (address: GooglePlaceAddress | null, rawText: string) => void;
  error?: boolean;
  homeAddress: GooglePlaceAddress | null;
  workAddress: GooglePlaceAddress | null;
  historyAddresses: GooglePlaceAddress[];
}
```

Estrutura:
1. Usa `useGooglePlacesAutocomplete()` internamente.
2. Mantém estado local `searchQuery`.
3. **Options dinâmicos:**
   - Se `searchQuery.trim() === ""`: monta lista de sugestões pré-carregadas com chaves sintéticas:
     - `__home__` → homeAddress (label: `🏠 Casa · <formatted_address>`)
     - `__work__` → workAddress (label: `💼 Trabalho · <formatted>`)
     - `__hist_<i>__` → historyAddresses[i] (label: apenas `<formatted_address>`, sem ícone)
   - Se `searchQuery.length >= 1`: options = `places.options`
4. **Dedupe:** endereços de `historyAddresses` cujo `formatted_address` bate com Casa/Trabalho são filtrados.
5. **onChange do SearchableSelect:**
   - Se o `value` é uma chave sintética → recupera o `GooglePlaceAddress` correspondente do dicionário local, chama `onChange(address, address.formatted_address)`.
   - Senão → chama `fetchGooglePlaceDetails(placeId, label)` e `onChange(address, address.formatted_address)`.
6. **onSearchChange:** atualiza `searchQuery`; se query longa o suficiente, chama `places.search(query)`. Também chama `onChange(null, query)` para o parent saber que o valor não é mais um endereço válido enquanto o usuário digita.

### Nova função em `src/lib/api.ts`

Adicionar após as funções de user_saved_addresses (que criamos em P5):

```ts
export async function fetchClientAddressHistory(
  clientId: string,
  field: "pickup" | "dropoff",
  limit = 4,
): Promise<GooglePlaceAddress[]>;
```

Implementação:
1. Query:
   ```ts
   supabase
     .from("trips")
     .select(
       "id, created_at, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*)"
     )
     .eq("client_id", clientId)
     .neq("status", "cancelled")
     .order("created_at", { ascending: false })
     .limit(20)  // pega mais que 4 para permitir dedupe
   ```
2. Extrai o campo (`pickup_address` ou `dropoff_address`) de cada row.
3. Mapeia `Address` → `GooglePlaceAddress` (mesmos campos: formatted_address, google_place_id, latitude, longitude, street, number, neighborhood, city, state, zip_code).
4. Dedupe por `google_place_id` (fallback: `formatted_address`).
5. Retorna os primeiros `limit`.

### Alterações em `src/components/forms/NovaViagemForm.tsx`

**Estados novos:**
```ts
const [pickupHistory, setPickupHistory] = useState<GooglePlaceAddress[]>([]);
const [dropoffHistory, setDropoffHistory] = useState<GooglePlaceAddress[]>([]);
```

**Cliente selecionado** — derivar via `useMemo`:
```ts
const selectedClient = useMemo(
  () => clients.find((c) => c.id === clientId) ?? null,
  [clients, clientId],
);
const homeAddress = useMemo(
  () => extractSavedAddress(selectedClient, "home"),
  [selectedClient],
);
const workAddress = useMemo(
  () => extractSavedAddress(selectedClient, "work"),
  [selectedClient],
);
```

`extractSavedAddress` já existe em `NovoClienteForm.tsx` — vou mover para um helper compartilhado. Melhor: exportar de `src/lib/user-saved-addresses.ts` (novo pequeno módulo utilitário) para ambos consumirem.

**useEffect novo:** ao mudar `clientId`, buscar históricos em paralelo:
```ts
useEffect(() => {
  if (!clientId) {
    setPickupHistory([]);
    setDropoffHistory([]);
    return;
  }
  let cancelled = false;
  Promise.all([
    fetchClientAddressHistory(clientId, "pickup"),
    fetchClientAddressHistory(clientId, "dropoff"),
  ])
    .then(([pickups, dropoffs]) => {
      if (cancelled) return;
      setPickupHistory(pickups);
      setDropoffHistory(dropoffs);
    })
    .catch(() => {
      if (cancelled) return;
      setPickupHistory([]);
      setDropoffHistory([]);
    });
  return () => { cancelled = true; };
}, [clientId]);
```

**Substituir os dois `<SearchableSelect>` de embarque/destino** por `<AddressAutocompleteWithSuggestions>` passando os props apropriados. O `onChange` do novo componente entrega `(GooglePlaceAddress | null, rawText: string)` — a assinatura mapeia direto para os estados existentes `pickupPlaceAddress`, `pickupAddress`, etc.

### Refactor pequeno: extrair `extractSavedAddress`

**Arquivo novo:** `src/lib/user-saved-addresses.ts`

Move a função `extractSavedAddress` que foi criada em P5 (dentro de `NovoClienteForm.tsx`) para um módulo compartilhado. `NovoClienteForm.tsx` passa a importar de lá. `NovaViagemForm.tsx` também importa.

### Sem alterações

- Schema (nenhum SQL).
- API routes.
- `SearchableSelect` (usado como está).
- `AddressAutocompleteField` (P5) — permanece para uso em edição de cliente.

## Data flow

```
Admin abre Nova Viagem →
  fetchUsers + fetchServiceCategories (já existe)
  ↓
Admin seleciona cliente →
  clientId muda → useEffect novo:
    fetchClientAddressHistory(clientId, "pickup") + (..., "dropoff") em paralelo
    pickupHistory, dropoffHistory populados
  ↓
Admin clica em "Embarque" sem digitar:
  searchQuery = "" → options = [Casa, Trabalho, ...pickupHistory (dedupe)]
  Dropdown mostra sugestões pré-carregadas
  ↓
Admin seleciona "Casa":
  onChange(homeAddress, homeAddress.formatted_address)
  pickupPlaceAddress = homeAddress, pickupAddress = homeAddress.formatted_address
  ↓
Admin apaga tudo e digita "R" em "Destino":
  searchQuery = "R" → places.search("R") → options = places.options (Google)
  Dropdown mostra resultados Google
```

## Edge cases cobertos

- **Cliente sem Casa/Trabalho e sem histórico** → dropdown de sugestões vazio (mostra "Nenhum resultado" ou nada até digitar; comportamento aceitável).
- **Cliente sem seleção** → históricos vazios, sem sugestões pré-carregadas; funciona igual hoje.
- **Cliente com muitos endereços únicos no histórico** → limite de 4 aplicado após dedupe.
- **Casa e primeiro endereço do histórico são iguais** → dedupe filtra o histórico, Casa fica.
- **Histórico só tem 2 endereços** → mostra apenas 2 (não força 4).
- **Erro no fetchClientAddressHistory** → históricos ficam vazios (silent fail), autocomplete Google segue funcionando.
- **Trocar de cliente** → históricos resetam e recarregam para o novo.
- **Trocar de cliente enquanto história anterior está carregando** → `cancelled` flag evita race.

## Testes

**Automatizados:** nenhum novo.

### Checklist manual

1. Criar 2 clientes de teste:
   - Cliente A: Casa e Trabalho salvos em P5, sem histórico de viagem.
   - Cliente B: sem Casa/Trabalho, mas com 5 viagens anteriores em endereços distintos.
2. Abrir "Nova Viagem" → selecionar Cliente A.
3. Clicar em "Embarque" → dropdown mostra apenas Casa e Trabalho. Selecionar "Casa" → campo preenchido.
4. Clicar em "Destino" → dropdown mostra Casa e Trabalho. Selecionar "Trabalho" → campo preenchido.
5. Selecionar Cliente B → embarque e destino agora mostram até 4 endereços do histórico. Selecionar um → campo preenchido.
6. Em qualquer campo, digitar "R" → sugestões pré-carregadas somem, Google Places aparece.
7. Apagar tudo → sugestões pré-carregadas voltam.
8. Trocar de cliente A → B com dropdown aberto → sugestões atualizam.
9. Cliente com histórico repetido de Casa (ex: 3 das 4 últimas foram da Casa) → dedupe garante Casa aparece uma vez, e o histórico mostra os 3 outros distintos.

## SQL

**Nenhum.**

## Fora do escopo

- Suporte a endereços custom (`label='custom'`).
- Cache das queries de histórico (feita a cada mudança de cliente; TTL pode ser adicionado depois se performance pedir).
- Persistir preferências de "endereços frequentes" no cliente (métricas separadas).
- Aplicar mesmo padrão em edição de viagem (será considerado em P4 se fizer sentido).
