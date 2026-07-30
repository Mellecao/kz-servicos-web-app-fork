"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  addServiceRequestPhoto,
  createAddress,
  createServiceRequest,
  fetchServiceCategories,
  fetchUsers,
} from "@/lib/api";
import type { ServiceCategory, User } from "@/types/database";
import NovaCategoriaServicoModal from "@/components/forms/NovaCategoriaServicoModal";

interface NovaSolicitacaoFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

const NEW_CATEGORY_VALUE = "__new_category__";

export default function NovaSolicitacaoForm({
  open,
  onClose,
  onSuccess,
}: NovaSolicitacaoFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [clients, setClients] = useState<User[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const [clientId, setClientId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextPreviews = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(nextPreviews);
    return () => nextPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [photoFiles]);

  useEffect(() => {
    if (!open) return;
    fetchUsers()
      .then((users) => setClients(users.filter((u) => u.role === "client")))
      .catch(() => toast("danger", "Erro ao carregar clientes"));
    fetchServiceCategories()
      .then((cats) =>
        setCategories(cats.filter((c) => c.service_type === "other_service")),
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
    setPhotoFiles([]);
  }

  async function uploadRequestPhotos(requestId: string) {
    await Promise.all(
      photoFiles.map(async (file, index) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${requestId}/${Date.now()}-${index}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("Service_Request_Photos")
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;

        const publicUrl = supabase.storage
          .from("Service_Request_Photos")
          .getPublicUrl(path).data.publicUrl;
        await addServiceRequestPhoto({
          service_request_id: requestId,
          photo_url: publicUrl,
          sort_order: index,
        });
      }),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !categoryId || !serviceDate || !description.trim()) {
      toast("warning", "Preencha os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    try {
      let addressId: string | null = null;
      if (address.trim()) {
        const createdAddress = await createAddress({
          formatted_address: address.trim(),
        });
        addressId = createdAddress.id;
      }

      const created = await createServiceRequest({
        client_id: clientId,
        service_category_id: categoryId,
        service_date: new Date(serviceDate).toISOString(),
        description: description.trim(),
        address_id: addressId,
        observations: observations.trim() || null,
      });

      if (photoFiles.length > 0) {
        await uploadRequestPhotos(created.id);
      }

      toast("success", "Solicitação criada com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast("danger", "Erro ao criar solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-heading font-bold text-dark">
                  Dados principais
                </h3>
                <p className="text-xs text-contrast mt-1">
                  Escolha o cliente, a categoria e a data antes de avançar.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

              <div>
                <label htmlFor="category" className={labelClass}>
                  Categoria de serviço *
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === NEW_CATEGORY_VALUE) {
                      setCategoryId("");
                      setCategoryModalOpen(true);
                      return;
                    }
                    setCategoryId(value);
                  }}
                  className={inputClass}
                >
                  <option value="">Selecione uma categoria</option>
                  <option value={NEW_CATEGORY_VALUE}>Adicionar nova categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
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
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-heading font-bold text-dark mb-4">
              Detalhes e local
            </h3>

            <div className="grid gap-4">
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

              <div>
                <label htmlFor="description" className={labelClass}>
                  Descrição *
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Descreva o serviço solicitado"
                  className={`${inputClass} resize-none`}
                />
              </div>

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
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-heading font-bold text-dark">
                  Fotos da solicitação
                </h3>
                <p className="text-xs text-contrast mt-1">
                  Anexe imagens do problema para o prestador receber o contexto completo.
                </p>
              </div>
              <span className="text-xs text-contrast">
                {photoFiles.length > 0 ? `${photoFiles.length} anexos` : "Sem anexos"}
              </span>
            </div>

            <input
              ref={photoInputRef}
              id="request-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhotoFiles((current) => [...current, file]);
                }
                if (photoInputRef.current) {
                  photoInputRef.current.value = "";
                }
              }}
            />

            <div className="mt-2 grid grid-cols-3 gap-3 md:grid-cols-4">
              {photoPreviews.map((preview, index) => (
                <div
                  key={`${preview}-${index}`}
                  className="group relative overflow-hidden rounded-lg border border-border bg-background"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={`Prévia da foto ${index + 1}`}
                    className="h-28 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white text-xs opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Remover foto ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex h-28 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-background text-3xl text-contrast hover:border-primary hover:text-primary transition-colors"
                aria-label="Adicionar foto"
              >
                +
              </button>
            </div>
          </section>
        </form>
      </SlidePanel>

      <NovaCategoriaServicoModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onCreated={(category) => {
          setCategories((current) =>
            current.some((item) => item.id === category.id)
              ? current
              : [category, ...current],
          );
          setCategoryId(category.id);
        }}
      />
    </>
  );
}
