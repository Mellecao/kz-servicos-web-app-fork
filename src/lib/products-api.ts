import { supabase } from "@/lib/supabase";
import { logAdminAction } from "@/lib/api";
import { ORDER_STATUS_LABELS, parseDeliveryFee } from "@/lib/product-orders";
import type { Product, ProductOrder, ProductOrderStatus } from "@/types/database";

// O admin tem RLS de escrita em products, product_orders e system_settings
// (migration 20261105120000_products_module e system_settings_admin), por isso
// tudo vai direto pelo cliente autenticado. Não existe eliminação de produtos nem de pedidos.

const DELIVERY_FEE_KEY = "product_delivery_fee";

// ─── Pedidos ───────────────────────────────────────────────

export async function fetchProductOrders(): Promise<ProductOrder[]> {
  const { data, error } = await supabase
    .from("product_orders")
    .select("*, users!client_id(id, full_name, email, phone), product_order_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductOrder[];
}

/**
 * Muda o estado de um pedido. `from` é o estado que o admin está a ver: se outro
 * admin já mexeu entretanto, não se sobrescreve (lança erro em vez de gravar por cima).
 * As datas (confirmed_at, delivered_at, cancelled_at) e a notificação ao cliente
 * são tratadas pelo trigger da base.
 */
export async function updateProductOrderStatus(
  id: string,
  from: ProductOrderStatus,
  to: ProductOrderStatus,
  cancelReason?: string
): Promise<void> {
  const patch: { status: ProductOrderStatus; cancel_reason?: string } = { status: to };
  if (to === "cancelled") patch.cancel_reason = (cancelReason ?? "").trim();

  const { data, error } = await supabase
    .from("product_orders")
    .update(patch)
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("O pedido mudou de estado entretanto. Atualize a lista e tente novamente.");
  }

  logAdminAction(
    `Pedido de produtos: ${ORDER_STATUS_LABELS[to]}`,
    id,
    { from, to, ...(to === "cancelled" ? { reason: patch.cancel_reason } : {}) },
    "product_order"
  );
}

// ─── Catálogo ──────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Product[];
}

export type ProductPatch = Partial<
  Pick<Product, "name" | "description" | "unit_label" | "price" | "sort_order" | "is_active">
>;

export async function updateProduct(id: string, patch: ProductPatch): Promise<void> {
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Não foi possível guardar o produto (sem permissão ou já não existe).");
  }
  logAdminAction("Produto atualizado", id, { ...patch }, "product");
}

// ─── Taxa de entrega ───────────────────────────────────────

/** Taxa de entrega em Kz; null se ainda não estiver definida. */
export async function fetchDeliveryFee(): Promise<number | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", DELIVERY_FEE_KEY)
    .maybeSingle();
  if (error) throw error;
  return parseDeliveryFee(data?.value);
}

export async function updateDeliveryFee(fee: number): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: DELIVERY_FEE_KEY, value: fee }, { onConflict: "key" });
  if (error) throw error;
  logAdminAction("Taxa de entrega atualizada", null, { key: DELIVERY_FEE_KEY, fee }, "setting");
}
