"use client";

import { useState, useEffect, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import {
  createUser,
  createProviderProfile,
  fetchServiceCategories,
} from "@/lib/api";
import type { ServiceCategory } from "@/types/database";

interface NovoPrestadorFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";
const sectionClass = "text-sm font-heading font-bold text-dark mb-3 mt-2";

export default function NovoPrestadorForm({
  open,
  onClose,
  onSuccess,
}: NovoPrestadorFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  // Dados do prestador
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");

  // Perfil de serviço
  const [categoryId, setCategoryId] = useState("");
  const [bio, setBio] = useState("");
  const [hasCardMachine, setHasCardMachine] = useState(false);
  const [issuesInvoice, setIssuesInvoice] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchServiceCategories()
      .then((cats: ServiceCategory[]) =>
        setCategories(cats.filter((c) => c.service_type === "other_service"))
      )
      .catch(() => toast("danger", "Erro ao carregar categorias"));
  }, [open, toast]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setCpf("");
    setCategoryId("");
    setBio("");
    setHasCardMachine(false);
    setIssuesInvoice(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !email) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }

    if (!categoryId) {
      toast("warning", "Selecione uma categoria de serviço");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create user
      const user = await createUser({
        full_name: fullName,
        email,
        phone: phone || null,
        cpf: cpf || null,
        role: "provider",
      });

      // 2. Create provider profile
      await createProviderProfile({
        user_id: user.id,
        service_category_id: categoryId,
        bio: bio || null,
        has_card_machine: hasCardMachine,
        issues_invoice: issuesInvoice,
      });

      toast("success", "Prestador criado com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch {
      toast("danger", "Erro ao criar prestador. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Novo Prestador"
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
            form="novo-prestador-form"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Criando..." : "Criar Prestador"}
          </button>
        </div>
      }
    >
      <form
        id="novo-prestador-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {/* Section: Dados do Prestador */}
        <h3 className={sectionClass}>Dados do Prestador</h3>

        <div>
          <label htmlFor="provider-name" className={labelClass}>
            Nome completo *
          </label>
          <input
            id="provider-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome do prestador"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="provider-email" className={labelClass}>
            E-mail *
          </label>
          <input
            id="provider-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="provider-phone" className={labelClass}>
            Telefone
          </label>
          <input
            id="provider-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="provider-cpf" className={labelClass}>
            CPF
          </label>
          <input
            id="provider-cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>

        {/* Section: Perfil de Serviço */}
        <div className="border-t border-border pt-4 mt-2" />
        <h3 className={sectionClass}>Perfil de Serviço</h3>

        <div>
          <label htmlFor="provider-category" className={labelClass}>
            Categoria de Serviço *
          </label>
          <select
            id="provider-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="provider-bio" className={labelClass}>
            Bio/Descrição
          </label>
          <textarea
            id="provider-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Descreva os serviços oferecidos..."
            rows={3}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="provider-card"
            type="checkbox"
            checked={hasCardMachine}
            onChange={(e) => setHasCardMachine(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="provider-card" className="text-sm font-body text-dark cursor-pointer">
            Máquina de cartão
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="provider-invoice"
            type="checkbox"
            checked={issuesInvoice}
            onChange={(e) => setIssuesInvoice(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="provider-invoice" className="text-sm font-body text-dark cursor-pointer">
            Emite nota fiscal
          </label>
        </div>
      </form>
    </SlidePanel>
  );
}
