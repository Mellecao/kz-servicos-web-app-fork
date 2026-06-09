"use client";

import { useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import { createUser } from "@/lib/api";

interface NovoUsuarioFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

export default function NovoUsuarioForm({
  open,
  onClose,
  onSuccess,
}: NovoUsuarioFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setCpf("");
    setDateOfBirth("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !email) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        full_name: fullName,
        email,
        phone: phone || null,
        cpf: cpf || null,
        role: "admin",
        date_of_birth: dateOfBirth || null,
      });

      toast("success", "Usuário criado com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch {
      toast("danger", "Erro ao criar usuário. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Novo Usuário"
      footer={
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
            form="novo-usuario-form"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Criando..." : "Criar Usuário"}
          </button>
        </div>
      }
    >
      <form
        id="novo-usuario-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="user-name" className={labelClass}>
            Nome completo *
          </label>
          <input
            id="user-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome do usuário"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="user-email" className={labelClass}>
            E-mail *
          </label>
          <input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="user-phone" className={labelClass}>
            Telefone
          </label>
          <input
            id="user-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="user-cpf" className={labelClass}>
            CPF
          </label>
          <input
            id="user-cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="user-dob" className={labelClass}>
            Data de nascimento
          </label>
          <input
            id="user-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className={inputClass}
          />
        </div>
      </form>
    </SlidePanel>
  );
}
