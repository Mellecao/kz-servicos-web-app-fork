"use client";

import { useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import { formatKz } from "@/lib/format";
import { validateProductInput } from "@/lib/product-orders";
import { updateProduct } from "@/lib/products-api";
import type { Product } from "@/types/database";

interface EditarProdutoFormProps {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

/**
 * Edição de um produto do catálogo (não há criação nem eliminação).
 * A página monta este componente com `key` = id do produto, por isso o
 * estado inicial vem sempre do produto aberto.
 */
export default function EditarProdutoForm({ product, onClose, onSaved }: EditarProdutoFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [unitLabel, setUnitLabel] = useState(product?.unit_label ?? "");
  const [price, setPrice] = useState(product ? formatKz(product.price).replace(" Kz", "") : "");
  const [sortOrder, setSortOrder] = useState(product ? String(product.sort_order) : "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;

    const result = validateProductInput({ name, description, unitLabel, price, sortOrder });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError("");
    setSaving(true);
    try {
      await updateProduct(product.id, result.value);
      toast("success", "Produto atualizado com sucesso!");
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast("danger", message || "Erro ao guardar o produto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="px-4 py-2 text-sm font-body text-contrast hover:text-dark transition-colors duration-200 cursor-pointer disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form="editar-produto-form"
        disabled={saving}
        className="px-5 py-2 rounded-lg bg-primary text-on-primary font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "A guardar..." : "Guardar produto"}
      </button>
    </div>
  );

  return (
    <SlidePanel open={!!product} onClose={onClose} title="Editar produto" footer={footer}>
      <form id="editar-produto-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="produto-nome" className={labelClass}>
            Nome *
          </label>
          <input
            id="produto-nome"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Água 20 L"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="produto-descricao" className={labelClass}>
            Descrição
          </label>
          <textarea
            id="produto-descricao"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Texto que o cliente vê no catálogo"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="produto-unidade" className={labelClass}>
              Unidade *
            </label>
            <input
              id="produto-unidade"
              type="text"
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value)}
              placeholder="garrafão, saco, botija…"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="produto-preco" className={labelClass}>
              Preço (Kz) *
            </label>
            <input
              id="produto-preco"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1.500,00"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="produto-ordem" className={labelClass}>
            Ordem no catálogo *
          </label>
          <input
            id="produto-ordem"
            type="text"
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="10"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-contrast font-body">
            Números mais baixos aparecem primeiro.
          </p>
        </div>

        {error && <p className="text-sm text-danger font-body">{error}</p>}
      </form>
    </SlidePanel>
  );
}
