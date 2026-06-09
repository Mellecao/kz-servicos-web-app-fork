"use client";

import { useState, useEffect, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import {
  createServiceRequest,
  createAddress,
  fetchUsers,
  fetchServiceCategories,
} from "@/lib/api";
import type { User, ServiceCategory } from "@/types/database";

interface NovaSolicitacaoFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

export default function NovaSolicitacaoForm({
  open,
  onClose,
  onSuccess,
}: NovaSolicitacaoFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<User[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const [clientId, setClientId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");

  useEffect(() => {
    if (!open) return;
    fetchUsers()
      .then((users) => setClients(users.filter((u) => u.role === "client")))
      .catch(() => toast("danger", "Erro ao carregar clientes"));
    fetchServiceCategories()
      .then((cats: ServiceCategory[]) =>
        setCategories(cats.filter((c) => c.service_type === "other_service"))
      )
      .catch(() => toast("danger", "Erro ao carregar categorias"));
  }, [open, toast]);

  function resetForm() {
    setClientId("");
    setCategoryId("");
    setServiceDate("");
    setAddress("");
    setDescription("");
    setObservations("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !categoryId || !serviceDate || !description) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    try {
      let addressId: string | null = null;
      if (address.trim()) {
        const created = await createAddress({ formatted_address: address });
        addressId = created.id;
      }

      await createServiceRequest({
        client_id: clientId,
        service_category_id: categoryId,
        service_date: new Date(serviceDate).toISOString(),
        description,
        address_id: addressId,
        observations: observations || null,
      });

      toast("success", "Solicitação criada com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch {
      toast("danger", "Erro ao criar solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Nova Solicitação"
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
            form="nova-solicitacao-form"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Criando..." : "Criar Solicitação"}
          </button>
        </div>
      }
    >
      <form
        id="nova-solicitacao-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-6 overflow-y-auto flex-1"
      >
        {/* Cliente */}
        <div>
          <label htmlFor="client" className={labelClass}>
            Cliente *
          </label>
          <select
            id="client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione um cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Categoria de Serviço */}
        <div>
          <label htmlFor="category" className={labelClass}>
            Categoria de Serviço *
          </label>
          <select
            id="category"
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

        {/* Data do serviço */}
        <div>
          <label htmlFor="service-date" className={labelClass}>
            Data do serviço *
          </label>
          <input
            id="service-date"
            type="datetime-local"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Endereço */}
        <div>
          <label htmlFor="address" className={labelClass}>
            Endereço
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ex: Rua das Flores, 123 - Centro"
            className={inputClass}
          />
        </div>

        {/* Descrição */}
        <div>
          <label htmlFor="description" className={labelClass}>
            Descrição *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Descreva o serviço solicitado"
            className={inputClass + " resize-none"}
          />
        </div>

        {/* Observações */}
        <div>
          <label htmlFor="observations" className={labelClass}>
            Observações
          </label>
          <textarea
            id="observations"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder="Informações adicionais"
            className={inputClass + " resize-none"}
          />
        </div>
      </form>
    </SlidePanel>
  );
}
