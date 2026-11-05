"use client";

import { useCallback, useEffect, useState } from "react";
import EditarProdutoForm from "@/components/forms/EditarProdutoForm";
import { useToast } from "@/components/Toast";
import { formatKz } from "@/lib/format";
import { parseKzInput } from "@/lib/product-orders";
import {
  fetchDeliveryFee,
  fetchProducts,
  updateDeliveryFee,
  updateProduct,
} from "@/lib/products-api";
import type { Product } from "@/types/database";

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/** Valor para o campo de texto (sem o sufixo Kz). */
const feeToInput = (fee: number | null) =>
  fee === null ? "" : formatKz(fee).replace(" Kz", "");

export default function ProdutosPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [fee, setFee] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchProducts(), fetchDeliveryFee()])
      .then(([list, currentFee]) => {
        setProducts(list);
        setFee(currentFee);
        setFeeInput(feeToInput(currentFee));
        setError(null);
      })
      .catch((err: unknown) =>
        setError(errorMessage(err, "Não foi possível carregar o catálogo."))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive(product: Product) {
    const next = !product.is_active;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: next } : p)));
    try {
      await updateProduct(product.id, { is_active: next });
      toast("success", next ? `${product.name} ativado` : `${product.name} desativado`);
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: product.is_active } : p))
      );
      toast("danger", errorMessage(err, "Erro ao atualizar o produto."));
    }
  }

  async function handleSaveFee() {
    const value = parseKzInput(feeInput);
    if (value === null) {
      toast("warning", "Taxa inválida. Use um valor em Kz, por exemplo 1.000,00.");
      return;
    }
    setSavingFee(true);
    try {
      await updateDeliveryFee(value);
      setFee(value);
      setFeeInput(feeToInput(value));
      toast("success", "Taxa de entrega atualizada");
    } catch (err) {
      toast("danger", errorMessage(err, "Erro ao guardar a taxa de entrega."));
    } finally {
      setSavingFee(false);
    }
  }

  const parsedFee = parseKzInput(feeInput);
  const feeUnchanged = parsedFee !== null && parsedFee === fee;
  const editingProduct = products.find((p) => p.id === editingId) ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Produtos</h1>
        <p className="text-contrast text-sm mt-1">
          Edite nomes, preços e disponibilidade. Os produtos não se eliminam: desative os que
          não quer mostrar aos clientes.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">A carregar catálogo...</div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
          <p className="text-sm text-danger font-medium">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-3 px-4 py-2 rounded-lg bg-surface border border-border text-dark text-sm hover:bg-background transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {/* Taxa de entrega */}
          <section className="bg-surface rounded-xl border border-border p-5 mb-6">
            <h2 className="text-sm font-heading font-bold text-dark">Taxa de entrega</h2>
            <p className="text-xs text-contrast mt-0.5">
              Somada a cada pedido de produtos.{" "}
              {fee === null ? "Ainda não está definida." : `Atual: ${formatKz(fee)}.`}
            </p>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Taxa de entrega em Kz"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  placeholder="1.000,00"
                  className="w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none pl-3 pr-10 py-2 text-base md:text-sm font-body"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-contrast pointer-events-none">
                  Kz
                </span>
              </div>
              <button
                type="button"
                onClick={handleSaveFee}
                disabled={savingFee || feeUnchanged || feeInput.trim() === ""}
                className="px-5 py-2 rounded-lg bg-primary text-on-primary font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingFee ? "A guardar..." : "Guardar taxa"}
              </button>
            </div>
          </section>

          {/* Catálogo */}
          {products.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center">
              <p className="text-dark font-heading font-bold">O catálogo está vazio</p>
              <p className="text-contrast text-sm mt-1">
                Quando existirem produtos, aparecem aqui para edição.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {products.map((product) => (
                <li
                  key={product.id}
                  className={`bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center gap-x-4 gap-y-3 transition-opacity ${
                    product.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-[12rem]">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-dark">{product.name}</p>
                      {!product.is_active && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-hover text-contrast font-medium">
                          Inativo
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-contrast mt-0.5">{product.description}</p>
                    )}
                    <p className="text-[11px] text-contrast/70 mt-1">
                      por {product.unit_label} · ordem {product.sort_order}
                    </p>
                  </div>

                  <p className="font-heading font-bold text-dark text-sm shrink-0">
                    {formatKz(product.price)}
                  </p>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={product.is_active}
                      aria-label={`${product.is_active ? "Desativar" : "Ativar"} ${product.name}`}
                      onClick={() => handleToggleActive(product)}
                      className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${
                        product.is_active ? "bg-accent" : "bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          product.is_active ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(product.id)}
                      className="px-3 py-1.5 rounded-lg bg-surface border border-border text-dark text-xs font-medium hover:bg-background transition-colors cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <EditarProdutoForm
        key={editingId ?? "none"}
        product={editingProduct}
        onClose={() => setEditingId(null)}
        onSaved={load}
      />
    </div>
  );
}
