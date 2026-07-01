"use client";

import { useEffect, useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import { createServiceCategory } from "@/lib/api";
import { buildServiceCategorySlug } from "@/lib/service-category-utils";
import type { ServiceCategory } from "@/types/database";

interface NovaCategoriaServicoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (category: ServiceCategory) => void;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

export default function NovaCategoriaServicoModal({
  open,
  onClose,
  onCreated,
}: NovaCategoriaServicoModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast("warning", "Informe o nome da categoria");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createServiceCategory({
        name: trimmed,
        description: description.trim() || null,
        icon_url: null,
        service_type: "other_service",
      });
      onCreated(created);
      toast("success", "Categoria criada com sucesso!");
      onClose();
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao criar categoria. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Nova Categoria"
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
            form="nova-categoria-servico-form"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Criando..." : "Criar Categoria"}
          </button>
        </div>
      }
    >
      <form
        id="nova-categoria-servico-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-6 overflow-y-auto flex-1"
      >
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-heading font-bold text-dark mb-3">
            Dados da categoria
          </h3>
          <div>
            <label htmlFor="service-category-name" className={labelClass}>
              Nome *
            </label>
            <input
              id="service-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Instalação elétrica"
              className={inputClass}
            />
            <p className="mt-2 text-xs text-contrast">
              Slug automático: {name.trim() ? buildServiceCategorySlug(name) : "—"}
            </p>
          </div>
          <div className="mt-4">
            <label htmlFor="service-category-description" className={labelClass}>
              Descrição
            </label>
            <textarea
              id="service-category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Explique o tipo de serviço"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </form>
    </SlidePanel>
  );
}
