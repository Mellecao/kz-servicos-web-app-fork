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
import { extractSavedAddress } from "@/lib/user-saved-addresses";
import type { User } from "@/types/database";
import { documentError, documentToSave, formatPhoneAO, maskPhoneAO, phoneError, phoneToSave } from "@/lib/format";

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

interface NovoClienteFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variant?: "slide" | "modal";
  client?: User | null;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const inputErrorClass =
  "w-full rounded-lg bg-background border border-danger text-danger placeholder:text-contrast/40 focus:ring-danger focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

export default function NovoClienteForm({
  open,
  onClose,
  onSuccess,
  variant = "slide",
  client = null,
}: NovoClienteFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [emailError, setEmailError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [homeAddress, setHomeAddress] = useState<GooglePlaceAddress | null>(null);
  const [workAddress, setWorkAddress] = useState<GooglePlaceAddress | null>(null);
  const [originalHomeAddress, setOriginalHomeAddress] =
    useState<GooglePlaceAddress | null>(null);
  const [originalWorkAddress, setOriginalWorkAddress] =
    useState<GooglePlaceAddress | null>(null);

  const isEditing = Boolean(client);

  useEffect(() => {
    if (!open) return;
    if (!client) {
      resetForm();
      return;
    }

    setFullName(client.full_name ?? "");
    setEmail(client.email ?? "");
    setPassword("");
    setPhone(client.phone ? formatPhoneAO(client.phone) : "");
    setCpf(client.cpf ?? "");
    setDateOfBirth(client.date_of_birth ?? "");
    setIsActive(client.is_active);
    setCpfError("");
    setEmailError("");

    const home = extractSavedAddress(client, "home");
    const work = extractSavedAddress(client, "work");
    setHomeAddress(home);
    setWorkAddress(work);
    setOriginalHomeAddress(home);
    setOriginalWorkAddress(work);
  }, [open, client]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setCpf("");
    setDateOfBirth("");
    setIsActive(true);
    setCpfError("");
    setEmailError("");
    setHomeAddress(null);
    setWorkAddress(null);
    setOriginalHomeAddress(null);
    setOriginalWorkAddress(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !email || (!isEditing && !password)) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }

    if (!isEditing && password.length < 6) {
      toast("warning", "A palavra-passe deve ter pelo menos 6 caracteres");
      return;
    }

    const phoneMsg = phoneError(phone, client?.phone);
    if (phoneMsg) {
      toast("warning", phoneMsg);
      return;
    }

    const documentMsg = documentError(cpf, client?.cpf);
    if (documentMsg) {
      setCpfError(documentMsg);
      toast("warning", documentMsg);
      return;
    }

    setCpfError("");
    setEmailError("");
    setSubmitting(true);
    try {
      if (client) {
        await updateUserById(client.id, {
          full_name: fullName,
          email,
          phone: phoneToSave(phone, client.phone),
          cpf: documentToSave(cpf, client.cpf),
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
          phone: phoneToSave(phone, null),
          cpf: documentToSave(cpf, null),
          role: "client",
          date_of_birth: dateOfBirth || null,
        });
      }

      toast("success", client ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("users_cpf_key")) {
        const errorMsg = "Este BI / NIF já está registado.";
        setCpfError(errorMsg);
        toast("danger", errorMsg);
      } else if (message.includes("already been registered")) {
        const errorMsg = "Este e-mail já está registado.";
        setEmailError(errorMsg);
        toast("danger", errorMsg);
      } else {
        toast("danger", client ? "Erro ao atualizar cliente. Tente novamente." : "Erro ao criar cliente. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm font-body text-contrast hover:text-dark transition-colors duration-200 cursor-pointer"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form="novo-cliente-form"
        disabled={submitting}
        className="px-5 py-2 rounded-lg bg-primary text-on-primary font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting
          ? isEditing ? "A guardar..." : "A criar..."
          : isEditing ? "Guardar Cliente" : "Criar Cliente"}
      </button>
    </div>
  );

  const formContent = (
    <form
      id="novo-cliente-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="client-name" className={labelClass}>
          Nome completo *
        </label>
        <input
          id="client-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nome do cliente"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="client-email" className={labelClass}>
          E-mail *
        </label>
        <input
          id="client-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          placeholder="email@exemplo.com"
          className={emailError ? inputErrorClass : inputClass}
        />
        {emailError && (
          <p className="mt-1 text-xs text-danger font-body">{emailError}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-password" className={labelClass}>
          Palavra-passe {!isEditing && "*"}
        </label>
        <input
          id="client-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEditing ? "Não alterada na edição" : "Mínimo 6 caracteres"}
          className={inputClass}
          autoComplete="new-password"
          disabled={isEditing}
        />
      </div>

      <div>
        <label htmlFor="client-phone" className={labelClass}>
          Telefone
        </label>
        <input
          id="client-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(maskPhoneAO(e.target.value))}
          placeholder="+244 9XX XXX XXX"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="client-cpf" className={labelClass}>
          BI / NIF
        </label>
        <input
          id="client-cpf"
          type="text"
          value={cpf}
          onChange={(e) => {
            setCpf(e.target.value);
            if (cpfError) setCpfError("");
          }}
          placeholder="Nº do BI ou NIF"
          className={cpfError ? inputErrorClass : inputClass}
        />
        {cpfError && (
          <p className="mt-1 text-xs text-danger font-body">{cpfError}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-dob" className={labelClass}>
          Data de nascimento
        </label>
        <input
          id="client-dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className={inputClass}
        />
      </div>

      {isEditing && (
        <label className="flex items-center gap-2 text-sm font-body text-dark">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
          />
          Cliente ativo
        </label>
      )}

      {isEditing && (
        <>
          <AddressAutocompleteField
            label="Morada Casa"
            placeholder="Procurar morada"
            value={homeAddress}
            onChange={setHomeAddress}
          />
          <AddressAutocompleteField
            label="Morada Trabalho"
            placeholder="Procurar morada"
            value={workAddress}
            onChange={setWorkAddress}
          />
        </>
      )}
    </form>
  );

  if (variant === "modal") {
    return (
      <Modal open={open} onClose={onClose} title={isEditing ? "Editar Cliente" : "Novo Cliente"} footer={footer}>
        {formContent}
      </Modal>
    );
  }

  return (
    <SlidePanel open={open} onClose={onClose} title={isEditing ? "Editar Cliente" : "Novo Cliente"} footer={footer}>
      {formContent}
    </SlidePanel>
  );
}
