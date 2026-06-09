"use client";

import { useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createUser } from "@/lib/api";

interface NovoClienteFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variant?: "slide" | "modal";
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

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setCpf("");
    setDateOfBirth("");
    setCpfError("");
    setEmailError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }

    if (password.length < 6) {
      toast("warning", "A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setCpfError("");
    setEmailError("");
    setSubmitting(true);
    try {
      await createUser({
        full_name: fullName,
        email,
        password,
        phone: phone || null,
        cpf: cpf || null,
        role: "client",
        date_of_birth: dateOfBirth || null,
      });

      toast("success", "Cliente criado com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("users_cpf_key")) {
        const errorMsg = "Este CPF já está cadastrado.";
        setCpfError(errorMsg);
        toast("danger", errorMsg);
      } else if (message.includes("already been registered")) {
        const errorMsg = "Este e-mail já está cadastrado.";
        setEmailError(errorMsg);
        toast("danger", errorMsg);
      } else {
        toast("danger", "Erro ao criar cliente. Tente novamente.");
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
        className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Criando..." : "Criar Cliente"}
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
          Senha *
        </label>
        <input
          id="client-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className={inputClass}
          autoComplete="new-password"
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
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(00) 00000-0000"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="client-cpf" className={labelClass}>
          CPF
        </label>
        <input
          id="client-cpf"
          type="text"
          value={cpf}
          onChange={(e) => {
            setCpf(e.target.value);
            if (cpfError) setCpfError("");
          }}
          placeholder="000.000.000-00"
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
    </form>
  );

  if (variant === "modal") {
    return (
      <Modal open={open} onClose={onClose} title="Novo Cliente" footer={footer}>
        {formContent}
      </Modal>
    );
  }

  return (
    <SlidePanel open={open} onClose={onClose} title="Novo Cliente" footer={footer}>
      {formContent}
    </SlidePanel>
  );
}
