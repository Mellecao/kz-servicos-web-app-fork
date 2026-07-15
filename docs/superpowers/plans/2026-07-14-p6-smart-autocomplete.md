# P6 — Smart Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em Nova Viagem, quando o admin foca em Embarque ou Destino sem digitar, mostrar sugestões (Casa, Trabalho, últimos 4 endereços do respectivo histórico) e alternar para Google Places assim que digitar.

**Architecture:** (a) Novo helper `src/lib/user-saved-addresses.ts` com `extractSavedAddress` compartilhado. (b) Novo componente `AddressAutocompleteWithSuggestions` que envolve `SearchableSelect` e injeta options pré-carregadas quando search vazio. (c) Nova função `fetchClientAddressHistory` em `api.ts` que retorna até N `GooglePlaceAddress` deduplicados de `trips` do cliente. (d) `NovaViagemForm` consome tudo e substitui os 2 SearchableSelect atuais.

**Tech Stack:** Next.js, TypeScript, Supabase JS client, Google Places API.

**Spec:** `docs/superpowers/specs/2026-07-14-p6-smart-autocomplete-design.md`

**Testes automatizados:** nenhum novo. `npm run lint` por arquivo + `npm run build` no fim.

**SQL:** nenhum.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/user-saved-addresses.ts` | criar | Helper `extractSavedAddress` compartilhado |
| `src/components/forms/NovoClienteForm.tsx` | modificar | Importar `extractSavedAddress` do novo módulo (remover duplicata local) |
| `src/lib/api.ts` | modificar | Nova função `fetchClientAddressHistory` |
| `src/components/AddressAutocompleteWithSuggestions.tsx` | criar | Autocomplete com sugestões pré-carregadas |
| `src/components/forms/NovaViagemForm.tsx` | modificar | Estado de históricos + trocar SearchableSelect por novo componente |

---

### Task 1: Extrair `extractSavedAddress` para módulo compartilhado

**Files:**
- Create: `src/lib/user-saved-addresses.ts`
- Modify: `src/components/forms/NovoClienteForm.tsx`

- [ ] **Step 1: Criar `src/lib/user-saved-addresses.ts`**

Conteúdo exato:

```ts
import type { GooglePlaceAddress } from "@/lib/google-places";
import type { User, UserSavedAddress } from "@/types/database";

export function extractSavedAddress(
  client: User | null | undefined,
  label: "home" | "work",
): GooglePlaceAddress | null {
  const saved: UserSavedAddress | undefined = client?.user_saved_addresses?.find(
    (item) => item.label === label,
  );
  if (!saved?.addresses) return null;
  const addr = saved.addresses;
  return {
    formatted_address: addr.formatted_address,
    google_place_id: addr.google_place_id,
    latitude: addr.latitude,
    longitude: addr.longitude,
    street: addr.street,
    number: addr.number,
    neighborhood: addr.neighborhood,
    city: addr.city,
    state: addr.state,
    zip_code: addr.zip_code,
  };
}
```

- [ ] **Step 2: Refatorar `NovoClienteForm.tsx` para importar do módulo**

Localizar o bloco de imports (linhas 1-14 aproximadamente, após P5).

Adicionar:
```tsx
import { extractSavedAddress } from "@/lib/user-saved-addresses";
```

Remover a função `extractSavedAddress` local (foi adicionada em P5, deve estar antes do `export default function NovoClienteForm`).

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/lib/user-saved-addresses.ts src/components/forms/NovoClienteForm.tsx`
Expected: sem erros.

---

### Task 2: Adicionar `fetchClientAddressHistory` em `api.ts`

**Files:**
- Modify: `src/lib/api.ts` (adicionar após `removeUserSavedAddress`)

- [ ] **Step 1: Adicionar função**

Localizar `export async function removeUserSavedAddress` (adicionada em P5). Logo após o fechamento dessa função e antes de `// ─── Admin Create Trip`, adicionar:

```ts
export async function fetchClientAddressHistory(
  clientId: string,
  field: "pickup" | "dropoff",
  limit = 4,
): Promise<GooglePlaceAddress[]> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, created_at, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*)",
    )
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const addresses: GooglePlaceAddress[] = [];
  const seen = new Set<string>();

  for (const row of data ?? []) {
    const raw = field === "pickup" ? row.pickup_address : row.dropoff_address;
    if (!raw) continue;
    const key = raw.google_place_id ?? raw.formatted_address;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    addresses.push({
      formatted_address: raw.formatted_address,
      google_place_id: raw.google_place_id,
      latitude: raw.latitude,
      longitude: raw.longitude,
      street: raw.street,
      number: raw.number,
      neighborhood: raw.neighborhood,
      city: raw.city,
      state: raw.state,
      zip_code: raw.zip_code,
    });
    if (addresses.length >= limit) break;
  }

  return addresses;
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint -- src/lib/api.ts`
Expected: sem erros novos.

---

### Task 3: Criar `AddressAutocompleteWithSuggestions`

**Files:**
- Create: `src/components/AddressAutocompleteWithSuggestions.tsx`

- [ ] **Step 1: Criar o arquivo completo**

Conteúdo exato:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/SearchableSelect";
import {
  fetchGooglePlaceDetails,
  useGooglePlacesAutocomplete,
  type GooglePlaceAddress,
} from "@/lib/google-places";

interface Props {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (address: GooglePlaceAddress | null, rawText: string) => void;
  error?: boolean;
  homeAddress: GooglePlaceAddress | null;
  workAddress: GooglePlaceAddress | null;
  historyAddresses: GooglePlaceAddress[];
}

const labelClass = "block text-sm font-body text-contrast mb-1";

const HOME_KEY = "__home__";
const WORK_KEY = "__work__";
const HISTORY_KEY_PREFIX = "__hist_";

export default function AddressAutocompleteWithSuggestions({
  label,
  placeholder,
  value,
  onChange,
  error,
  homeAddress,
  workAddress,
  historyAddresses,
}: Props) {
  const places = useGooglePlacesAutocomplete();
  const [searchQuery, setSearchQuery] = useState("");
  const detailsSeqRef = useRef(0);

  const suggestionAddresses = useMemo(() => {
    const map = new Map<string, GooglePlaceAddress>();
    const dedupeKey = (a: GooglePlaceAddress) =>
      a.google_place_id ?? a.formatted_address;

    if (homeAddress) map.set(HOME_KEY, homeAddress);
    if (workAddress) map.set(WORK_KEY, workAddress);

    const takenKeys = new Set<string>();
    if (homeAddress) takenKeys.add(dedupeKey(homeAddress));
    if (workAddress) takenKeys.add(dedupeKey(workAddress));

    historyAddresses.forEach((addr, idx) => {
      const key = dedupeKey(addr);
      if (!key || takenKeys.has(key)) return;
      takenKeys.add(key);
      map.set(`${HISTORY_KEY_PREFIX}${idx}__`, addr);
    });

    return map;
  }, [homeAddress, workAddress, historyAddresses]);

  const options: SearchableSelectOption[] = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return places.options;
    }
    const list: SearchableSelectOption[] = [];
    for (const [key, addr] of suggestionAddresses.entries()) {
      let display = addr.formatted_address;
      if (key === HOME_KEY) display = `🏠 Casa · ${addr.formatted_address}`;
      else if (key === WORK_KEY) display = `💼 Trabalho · ${addr.formatted_address}`;
      list.push({ value: key, label: display });
    }
    return list;
  }, [searchQuery, places.options, suggestionAddresses]);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <SearchableSelect
        options={options}
        value={value}
        loading={places.loading}
        error={error}
        placeholder={placeholder}
        onSearchChange={(query) => {
          detailsSeqRef.current++;
          setSearchQuery(query);
          onChange(null, query);
          if (query.trim().length > 0) {
            places.search(query);
          } else {
            places.clear();
          }
        }}
        onChange={(optionValue, optionLabel) => {
          const preset = suggestionAddresses.get(optionValue);
          if (preset) {
            setSearchQuery("");
            places.clear();
            onChange(preset, preset.formatted_address);
            return;
          }
          const requestSeq = ++detailsSeqRef.current;
          onChange(
            {
              formatted_address: optionLabel,
              google_place_id: optionValue,
            },
            optionLabel,
          );
          setSearchQuery("");
          places.clear();
          fetchGooglePlaceDetails(optionValue, optionLabel).then((detailed) => {
            if (requestSeq !== detailsSeqRef.current) return;
            onChange(detailed, detailed.formatted_address);
          });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint -- src/components/AddressAutocompleteWithSuggestions.tsx`
Expected: sem erros.

---

### Task 4: Integrar em `NovaViagemForm.tsx`

**Files:**
- Modify: `src/components/forms/NovaViagemForm.tsx`

- [ ] **Step 1: Ajustar imports**

Trecho atual (linhas 1-19):

```tsx
"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import SearchableSelect from "@/components/SearchableSelect";
import NovoClienteForm from "@/components/forms/NovoClienteForm";
import { useToast } from "@/components/Toast";
import {
  adminCreateTrip,
  fetchUsers,
  fetchServiceCategories,
} from "@/lib/api";
import {
  fetchGooglePlaceDetails,
  type GooglePlaceAddress,
  useGooglePlacesAutocomplete,
} from "@/lib/google-places";
import type { User, ServiceCategory, PaymentMethod } from "@/types/database";
import type { SearchableSelectOption } from "@/components/SearchableSelect";
```

Substituir por:

```tsx
"use client";

import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import SearchableSelect from "@/components/SearchableSelect";
import AddressAutocompleteWithSuggestions from "@/components/AddressAutocompleteWithSuggestions";
import NovoClienteForm from "@/components/forms/NovoClienteForm";
import { useToast } from "@/components/Toast";
import {
  adminCreateTrip,
  fetchClientAddressHistory,
  fetchUsers,
  fetchServiceCategories,
} from "@/lib/api";
import {
  fetchGooglePlaceDetails,
  type GooglePlaceAddress,
  useGooglePlacesAutocomplete,
} from "@/lib/google-places";
import { extractSavedAddress } from "@/lib/user-saved-addresses";
import type { User, ServiceCategory, PaymentMethod } from "@/types/database";
import type { SearchableSelectOption } from "@/components/SearchableSelect";
```

- [ ] **Step 2: Adicionar estados de histórico dentro do componente**

Localizar `const [observations, setObservations] = useState("");` (linha 138). Adicionar logo após:

```tsx
  const [pickupHistory, setPickupHistory] = useState<GooglePlaceAddress[]>([]);
  const [dropoffHistory, setDropoffHistory] = useState<GooglePlaceAddress[]>([]);
```

- [ ] **Step 3: Adicionar useMemos e useEffect para históricos**

Localizar `const pickupPlaces = useGooglePlacesAutocomplete();` (linha 140) e `const pickupDetailsSeqRef = useRef(0);` (linha 142). Deixar como está (ainda podem ser usados pelas stops).

Depois do bloco de `useGooglePlacesAutocomplete` (linha 143), adicionar:

```tsx
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
    return () => {
      cancelled = true;
    };
  }, [clientId]);
```

- [ ] **Step 4: Resetar históricos no resetForm**

Localizar `function resetForm() { ... }` (aprox. linha 163). Adicionar antes do `pickupPlaces.clear();`:

```tsx
    setPickupHistory([]);
    setDropoffHistory([]);
```

- [ ] **Step 5: Substituir SearchableSelect de embarque**

Localizar o bloco `{/* Endereço de embarque */}` (linhas ~307-337).

Trecho atual:

```tsx
          <div>
            <label className={labelClass}>Endereço de embarque</label>
            <SearchableSelect
              options={pickupPlaces.options}
              value={pickupAddress}
              onChange={(placeId, label) => {
                setPickupAddress(label);
                const requestSeq = ++pickupDetailsSeqRef.current;
                setPickupPlaceAddress({
                  formatted_address: label,
                  google_place_id: placeId,
                });
                pickupPlaces.clear();
                fetchGooglePlaceDetails(placeId, label).then((address) => {
                  if (requestSeq !== pickupDetailsSeqRef.current) return;
                  setPickupAddress(address.formatted_address);
                  setPickupPlaceAddress(address);
                });
              }}
              onSearchChange={(q) => {
                pickupDetailsSeqRef.current++;
                setPickupAddress(q);
                setPickupPlaceAddress(null);
                pickupPlaces.search(q);
              }}
              placeholder="Ex: Rua das Flores, 123 - Centro"
              error={isFieldInvalid(pickupAddress)}
              loading={pickupPlaces.loading}
            />
          </div>
```

Substituir por:

```tsx
          <AddressAutocompleteWithSuggestions
            label="Endereço de embarque"
            placeholder="Ex: Rua das Flores, 123 - Centro"
            value={pickupAddress}
            error={isFieldInvalid(pickupAddress)}
            homeAddress={homeAddress}
            workAddress={workAddress}
            historyAddresses={pickupHistory}
            onChange={(address, rawText) => {
              setPickupAddress(address?.formatted_address ?? rawText);
              setPickupPlaceAddress(address);
            }}
          />
```

- [ ] **Step 6: Substituir SearchableSelect de destino**

Localizar o bloco `{/* Endereço de desembarque */}` (linhas ~379-409).

Trecho atual (analogamente ao embarque, usando dropoffPlaces, dropoffAddress, dropoffPlaceAddress, dropoffDetailsSeqRef).

Substituir por:

```tsx
          <AddressAutocompleteWithSuggestions
            label="Endereço de desembarque"
            placeholder="Ex: Aeroporto Internacional"
            value={dropoffAddress}
            error={isFieldInvalid(dropoffAddress)}
            homeAddress={homeAddress}
            workAddress={workAddress}
            historyAddresses={dropoffHistory}
            onChange={(address, rawText) => {
              setDropoffAddress(address?.formatted_address ?? rawText);
              setDropoffPlaceAddress(address);
            }}
          />
```

- [ ] **Step 7: Remover código morto**

Após as substituições dos passos 5 e 6, `pickupPlaces`, `dropoffPlaces`, `pickupDetailsSeqRef`, `dropoffDetailsSeqRef` **ainda são usados**? Verificar:
- `pickupPlaces` e `dropoffPlaces` só eram consumidos nos SearchableSelect substituídos.
- `pickupDetailsSeqRef` e `dropoffDetailsSeqRef` idem.

Remover as 4 declarações (linhas 140-143 aprox.) e a chamada `pickupPlaces.clear()` / `dropoffPlaces.clear()` no `resetForm`.

Se lint reclamar de import não usado (`useGooglePlacesAutocomplete`, `fetchGooglePlaceDetails`, `useRef`), verificar se ainda são usados pelo `StopAddressField` (subcomponente no mesmo arquivo). Provavelmente sim — nesse caso mantê-los.

- [ ] **Step 8: Lint**

Run: `npm run lint -- src/components/forms/NovaViagemForm.tsx`
Expected: sem erros.

---

### Task 5: Build de produção

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build passa sem erros.

- [ ] **Step 2: Diff**

Run: `git diff --stat -- src/lib/user-saved-addresses.ts src/lib/api.ts src/components/AddressAutocompleteWithSuggestions.tsx src/components/forms/NovaViagemForm.tsx src/components/forms/NovoClienteForm.tsx`
Expected: os 5 arquivos aparecem no diff.

---

### Task 6: Checklist manual (backlog)

1. Cliente A com Casa + Trabalho salvos (P5) e sem histórico.
2. Cliente B sem Casa/Trabalho mas com 5+ viagens em endereços distintos.
3. Nova Viagem → selecionar A → clicar Embarque sem digitar → dropdown mostra Casa e Trabalho apenas.
4. Selecionar Cliente B → dropdown embarque mostra até 4 endereços do histórico.
5. Digitar "R" no campo → sugestões somem, Google mostra resultados.
6. Apagar tudo → sugestões voltam.
7. Trocar cliente com dropdown aberto → sugestões atualizam.
8. Cliente com Casa que aparece em várias trips → dedupe garante Casa aparece 1x, histórico traz os outros distintos.

---

## Notas para o executor

- **`StopAddressField` continua usando `useGooglePlacesAutocomplete`** — não mexer nele. Se optar por unificar em iteração futura, cuidado com regressão.
- Se o Task 7 (remover código morto) causar erro de lint por import não usado, restaurar apenas o import necessário.
- O componente `AddressAutocompleteField` (P5) permanece. Ele é usado só na edição de cliente. `AddressAutocompleteWithSuggestions` (P6) é para Nova Viagem. Nomes distintos, propósitos distintos.
