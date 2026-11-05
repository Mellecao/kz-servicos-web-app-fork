"use client";

import { useCallback, useEffect, useState } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, { type KanbanListColumn } from "@/components/KanbanListView";
import ProductOrderDetailModal from "@/components/ProductOrderDetailModal";
import ViewToggle, { type ViewMode } from "@/components/ViewToggle";
import { useToast } from "@/components/Toast";
import { formatDateTime, formatKz } from "@/lib/format";
import { requestNotificationPermission, showNotification } from "@/lib/notifications";
import { formatPaymentMethod } from "@/lib/payment";
import { ORDER_STATUS_COLORS } from "@/lib/product-order-colors";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  isAllowedMove,
  shortOrderCode,
  summarizeItems,
} from "@/lib/product-orders";
import { fetchProductOrders, updateProductOrderStatus } from "@/lib/products-api";
import { supabase } from "@/lib/supabase";
import type { ProductOrder, ProductOrderStatus } from "@/types/database";

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export default function PedidosProdutosPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "board"
  );

  const loadOrders = useCallback(() => {
    fetchProductOrders()
      .then((data) => {
        setOrders(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(errorMessage(err, "Não foi possível carregar os pedidos."))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Tempo real: novo pedido ou mudança de estado (outro admin, ou o cliente a cancelar).
  // O INSERT e o UPDATE dos totais chegam quase juntos, por isso recarrega com debounce.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadOrders, 300);
    };

    const channel = supabase
      .channel("product-orders-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "product_orders" },
        (payload) => {
          const id = (payload.new as Partial<ProductOrder>).id;
          const code = id ? shortOrderCode(id) : "";
          showNotification(
            "Novo pedido de produtos",
            code ? `Pedido ${code}` : "Chegou um novo pedido para entrega."
          );
          toast("info", code ? `Novo pedido de produtos ${code}` : "Novo pedido de produtos");
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "product_orders" },
        refresh
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [loadOrders, toast]);

  const handleCardMove = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string) => {
      const from = fromColumnId as ProductOrderStatus;
      const to = toColumnId as ProductOrderStatus;
      if (!isAllowedMove(from, to)) {
        toast(
          "warning",
          "Só pode avançar um pedido para o estado seguinte. Para cancelar, abra o pedido."
        );
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === cardId ? { ...o, status: to } : o)));
      try {
        await updateProductOrderStatus(cardId, from, to);
        toast("success", `Pedido ${shortOrderCode(cardId)}: ${ORDER_STATUS_LABELS[to]}`);
      } catch (err) {
        toast("danger", errorMessage(err, "Erro ao atualizar o pedido."));
        loadOrders(); // reverte para o estado real
      }
    },
    [toast, loadOrders]
  );

  const columns: KanbanListColumn[] = ORDER_STATUSES.map((status) => ({
    id: status,
    title: ORDER_STATUS_LABELS[status],
    color: ORDER_STATUS_COLORS[status],
    cards: orders
      .filter((o) => o.status === status)
      .map((o) => ({
        id: o.id,
        title: `${shortOrderCode(o.id)} · ${summarizeItems(o.product_order_items)}`,
        subtitle: `${o.users?.full_name ?? "—"} • ${formatKz(o.total)}`,
        date: formatDateTime(o.created_at),
        tag: formatPaymentMethod(o.payment_method),
        tagColor: "#2261FE",
      })),
  }));

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Pedidos de produtos
          </h1>
          <p className="text-contrast text-sm mt-1">
            Acompanhe os pedidos de entrega ao domicílio em tempo real
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="flex items-center gap-2 shrink-0 rounded-full bg-primary/15 text-dark px-3 py-1.5 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            {pendingCount} por confirmar
          </span>
        )}
      </div>

      <ViewToggle value={viewMode} onChange={setViewMode} />

      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">A carregar pedidos...</div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
          <p className="text-sm text-danger font-medium">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadOrders();
            }}
            className="mt-3 px-4 py-2 rounded-lg bg-surface border border-border text-dark text-sm hover:bg-background transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-dark font-heading font-bold">Ainda não há pedidos de produtos</p>
          <p className="text-contrast text-sm mt-1">
            Quando um cliente fizer um pedido na app, ele aparece aqui automaticamente.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <KanbanListView
          columns={columns}
          onMoveCard={handleCardMove}
          onCardClick={(card) => setSelectedId(card.id)}
        />
      ) : (
        <div className="overflow-x-auto">
          <KanbanBoard
            columns={columns}
            onCardMove={handleCardMove}
            onCardClick={(cardId) => setSelectedId(cardId)}
          />
        </div>
      )}

      <ProductOrderDetailModal
        key={selectedId ?? "none"}
        order={selectedOrder}
        onClose={() => setSelectedId(null)}
        onUpdated={loadOrders}
      />
    </div>
  );
}
