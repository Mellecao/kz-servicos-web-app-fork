# P5 — Client Home/Work Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin pode salvar endereço "Casa" e "Trabalho" de cada cliente na tela de Clientes, com autocomplete Google Places, botão limpar por campo, e persistência em `user_saved_addresses`.

**Architecture:** Novo componente reutilizável `AddressAutocompleteField` (SearchableSelect + Google Places + botão limpar). Três funções novas em `api.ts` para persistir. `NovoClienteForm` adiciona 2 campos e faz diff no submit para chamar `save`/`remove` apenas quando mudou.

**Tech Stack:** Next.js, TypeScript, Supabase JS client, Google Places API (via `/api/places/*`).

**Spec:** `docs/superpowers/specs/2026-07-14-p5-client-home-address-design.md`

**Testes automatizados:** nenhum novo. `npm run lint` + `npm run build` no fim.

**SQL:** nenhum — schema já existe.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/AddressAutocompleteField.tsx` | criar | Campo reutilizável de endereço com autocomplete + botão limpar |
| `src/lib/api.ts` | modificar | Adicionar `fetchUserSavedAddresses`, `saveUserSavedAddress`, `removeUserSavedAddress` |
| `src/components/forms/NovoClienteForm.tsx` | modificar | Estados de home/work, integração do novo campo, diff no submit |

---

### Task 1: Criar `AddressAutocompleteField`

**Files:**
- Create: `src/components/AddressAutocompleteField.tsx`

- [ ] **Step 1: Criar o arquivo completo**

Conteúdo exato:

```tsx
"use client";

import { useMemo, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import {
  fetchGooglePlaceDetails,
  useGooglePlacesAutocomplete,
  type GooglePlaceAddress,
} from "@/lib/google-places";

interface AddressAutocompleteFieldProps {
  label: string;
  placeholder?: string;
  value: GooglePlaceAddress | null;
  onChange: (value: GooglePlaceAddress | null) => void;
  disabled?: boolean;
}

const labelClass = "block text-sm font-body text-contrast mb-1";

export default function AddressAutocompleteField({
  label,
  placeholder = "Digite o endereco",
  value,
  onChange,
  disabled = false,
}: AddressAutocompleteFieldProps) {
  const places = useGooglePlacesAutocomplete();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(
    value?.google_place_id ?? "",
  );

  const options = useMemo(() => {
    if (
      value?.google_place_id &&
      !places.options.some((opt) => opt.value === value.google_place_id)
    ) {
      return [
        { value: value.google_place_id, label: value.formatted_address },
        ...places.options,
      ];
    }
    return places.options;
  }, [places.options, value]);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <SearchableSelect
            options={options}
            value={selectedPlaceId}
            loading={places.loading}
            disabled={disabled}
            placeholder={placeholder}
            onSearchChange={(query) => places.search(query)}
            onChange={async (placeId, optionLabel) => {
              setSelectedPlaceId(placeId);
              const detailed = await fetchGooglePlaceDetails(
                placeId,
                optionLabel,
              );
              onChange(detailed);
            }}
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              setSelectedPlaceId("");
              places.clear();
              onChange(null);
            }}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-body text-contrast hover:bg-surface-hover disabled:opacity-50"
            aria-label={`Limpar ${label}`}
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint -- src/components/AddressAutocompleteField.tsx`
Expected: sem erros.

---

### Task 2: Adicionar funções em `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts` (adicionar após linha 1428, logo após `createAddress`)

- [ ] **Step 1: Verificar imports existentes**

Confirmar que `UserSavedAddress`, `Address` e `GooglePlaceAddress` são importáveis. Já são:
- `import type { ..., Address, ... } from "@/types/database";` — verificar.
- `import type { GooglePlaceAddress } from "@/lib/google-places";` — provavelmente não importado ainda.

Se `GooglePlaceAddress` não está importado no topo do `api.ts`, adicionar ao final do bloco de imports.

Se `UserSavedAddress` não está importado, adicionar ao bloco `import type { ... } from "@/types/database";`.

- [ ] **Step 2: Adicionar as três funções**

Localizar a linha 1428 (final da função `createAddress`, com `return data as Address; }`).

Adicionar logo depois, antes da seção `// ─── Admin Create Trip ...`:

```ts

// ─── User Saved Addresses ─────────────────────────────────
export async function fetchUserSavedAddresses(
  userId: string,
): Promise<UserSavedAddress[]> {
  const { data, error } = await supabase
    .from("user_saved_addresses")
    .select("*, addresses(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as UserSavedAddress[];
}

export async function saveUserSavedAddress(
  userId: string,
  label: "home" | "work",
  address: GooglePlaceAddress,
): Promise<void> {
  const { data: newAddress, error: addressError } = await supabase
    .from("addresses")
    .insert({
      formatted_address: address.formatted_address,
      google_place_id: address.google_place_id ?? null,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      street: address.street ?? null,
      number: address.number ?? null,
      neighborhood: address.neighborhood ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      zip_code: address.zip_code ?? null,
    })
    .select("id")
    .single();
  if (addressError || !newAddress) throw addressError ?? new Error("addresses insert failed");

  const { data: existing, error: existingError } = await supabase
    .from("user_saved_addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("label", label)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error: updateError } = await supabase
      .from("user_saved_addresses")
      .update({ address_id: newAddress.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from("user_saved_addresses")
      .insert({
        user_id: userId,
        address_id: newAddress.id,
        label,
      });
    if (insertError) throw insertError;
  }
}

export async function removeUserSavedAddress(
  userId: string,
  label: "home" | "work",
): Promise<void> {
  const { error } = await supabase
    .from("user_saved_addresses")
    .delete()
    .eq("user_id", userId)
    .eq("label", label);
  if (error) throw error;
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/lib/api.ts`
Expected: sem erros novos. (Se o arquivo tiver warnings preexistentes, ignorar — só verificar que nenhum NOVO foi introduzido pelas 3 funções.)

---

### Task 3: Integrar campos no `NovoClienteForm.tsx`

**Files:**
- Modify: `src/components/forms/NovoClienteForm.tsx`

- [ ] **Step 1: Adicionar imports**

Trecho atual (linhas 1-8):

```tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createUser, updateUserById } from "@/lib/api";
import type { User } from "@/types/database";
```

Substituir por:

```tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import {
  createUser,
  removeUserSavedAddress,
  saveUserSavedAddress,
  updateUserById,
} from "@/lib/api";
import type { GooglePlaceAddress } from "@/lib/google-places";
import type { User, UserSavedAddress } from "@/types/database";
```

- [ ] **Step 2: Adicionar helpers antes do componente**

Logo antes de `export default function NovoClienteForm(...)`:

```tsx
function extractSavedAddress(
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

function isSameAddress(
  a: GooglePlaceAddress | null,
  b: GooglePlaceAddress | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.google_place_id && b.google_place_id) {
    return a.google_place_id === b.google_place_id;
  }
  return a.formatted_address === b.formatted_address;
}
```

- [ ] **Step 3: Adicionar estados e populá-los no useEffect**

Localizar o bloco de useState (linhas 36-42):

```tsx
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isActive, setIsActive] = useState(true);
```

Adicionar logo depois (mantendo os existentes):

```tsx
  const [homeAddress, setHomeAddress] = useState<GooglePlaceAddress | null>(null);
  const [workAddress, setWorkAddress] = useState<GooglePlaceAddress | null>(null);
  const [originalHomeAddress, setOriginalHomeAddress] =
    useState<GooglePlaceAddress | null>(null);
  const [originalWorkAddress, setOriginalWorkAddress] =
    useState<GooglePlaceAddress | null>(null);
```

Localizar o useEffect (linhas 46-62). Após o `if (!client) { resetForm(); return; }` (fica em linhas 48-51), o conjunto de `setX(client.Y)` roda. Adicionar depois de `setCpfError("")` e `setEmailError("")`:

```tsx
    const home = extractSavedAddress(client, "home");
    const work = extractSavedAddress(client, "work");
    setHomeAddress(home);
    setWorkAddress(work);
    setOriginalHomeAddress(home);
    setOriginalWorkAddress(work);
```

Localizar `resetForm()` (linhas 64-74). Adicionar as 4 chamadas de reset ao final:

```tsx
    setHomeAddress(null);
    setWorkAddress(null);
    setOriginalHomeAddress(null);
    setOriginalWorkAddress(null);
```

- [ ] **Step 4: Persistir endereços no handleSubmit**

Localizar o `handleSubmit` (linhas 76-133). Dentro do bloco `try { ... }`, após o `if/else` que faz `updateUserById` ou `createUser` (termina na linha 111 com `});`), adicionar antes do `toast("success", ...)`:

Trecho atual (linhas 91-113):

```tsx
    setSubmitting(true);
    try {
      if (client) {
        await updateUserById(client.id, {
          full_name: fullName,
          email,
          phone: phone || null,
          cpf: cpf || null,
          date_of_birth: dateOfBirth || null,
          is_active: isActive,
        });
      } else {
        await createUser({
          full_name: fullName,
          email,
          password,
          phone: phone || null,
          cpf: cpf || null,
          role: "client",
          date_of_birth: dateOfBirth || null,
        });
      }

      toast("success", client ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!");
```

Substituir por:

```tsx
    setSubmitting(true);
    try {
      if (client) {
        await updateUserById(client.id, {
          full_name: fullName,
          email,
          phone: phone || null,
          cpf: cpf || null,
          date_of_birth: dateOfBirth || null,
          is_active: isActive,
        });

        if (!isSameAddress(homeAddress, originalHomeAddress)) {
          if (homeAddress) {
            await saveUserSavedAddress(client.id, "home", homeAddress);
          } else {
            await removeUserSavedAddress(client.id, "home");
          }
        }
        if (!isSameAddress(workAddress, originalWorkAddress)) {
          if (workAddress) {
            await saveUserSavedAddress(client.id, "work", workAddress);
          } else {
            await removeUserSavedAddress(client.id, "work");
          }
        }
      } else {
        await createUser({
          full_name: fullName,
          email,
          password,
          phone: phone || null,
          cpf: cpf || null,
          role: "client",
          date_of_birth: dateOfBirth || null,
        });
      }

      toast("success", client ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!");
```

- [ ] **Step 5: Adicionar os campos no JSX**

Localizar o final do formulário (linha 271, antes de `</form>`). O bloco `{isEditing && ( <label>Cliente ativo</label> )}` fica nas linhas 260-270.

Após esse bloco, adicionar (dentro do form, antes do fechamento `</form>`):

```tsx
      {isEditing && (
        <>
          <AddressAutocompleteField
            label="Endereço Casa"
            placeholder="Buscar endereço"
            value={homeAddress}
            onChange={setHomeAddress}
          />
          <AddressAutocompleteField
            label="Endereço Trabalho"
            placeholder="Buscar endereço"
            value={workAddress}
            onChange={setWorkAddress}
          />
        </>
      )}
```

O `isEditing` garante que campos aparecem só ao editar (na criação são ignorados, conforme spec).

- [ ] **Step 6: Lint**

Run: `npm run lint -- src/components/forms/NovoClienteForm.tsx`
Expected: sem erros.

---

### Task 4: Build de produção

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build passa sem erros.

- [ ] **Step 2: Diff**

Run: `git diff --stat -- src/components/AddressAutocompleteField.tsx src/lib/api.ts src/components/forms/NovoClienteForm.tsx`
Expected: os 3 arquivos aparecem com alterações.

---

### Task 5: Checklist manual (backlog)

Adicionar ao backlog:

1. Abrir Clientes → editar um cliente sem endereços salvos.
2. Digitar em "Endereço Casa" → dropdown mostra sugestões.
3. Selecionar uma → campo mostra `formatted_address`, botão "Limpar" aparece.
4. Repetir para "Endereço Trabalho".
5. Salvar → toast success, modal fecha.
6. Reabrir mesmo cliente → Home e Work populados.
7. Trocar Home por outro endereço → salvar → reabrir → confirmar mudança.
8. Clicar Limpar em Home → salvar → reabrir → Home vazio, Work intacto.
9. Editar só o nome (sem tocar endereços) → salvar → nenhuma request extra (checar Network).
10. `SavedAddressesSummary` no card do cliente reflete os endereços.

---

## Notas para o executor

- **Cliente novo (create):** os campos de Home/Work só aparecem em modo edição (`isEditing`). É intencional (spec). Se o admin quiser salvar endereços num cliente novo, cria primeiro, reabre para editar.
- **`addresses` órfãs:** substituir um endereço não deleta o antigo (pode estar em uso). Limpeza pode ser rotina separada, fora deste plano.
- **RLS:** admin pode escrever em `users`, `addresses` e `user_saved_addresses` — políticas já existem (`20260410120024_create_rls_policies.sql` + `20260618170000_create_user_saved_addresses.sql`).
- Se `SearchableSelect` mostrar "Nenhum resultado encontrado" ao clicar num campo com valor pré-populado, o `useMemo` do `AddressAutocompleteField` que injeta o `value.google_place_id` como primeira opção deve resolver.
