"use client";

import { useState } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import { formatDateTime, formatKz, formatPhoneAO } from "@/lib/format";
import { formatPaymentMethod } from "@/lib/payment";
import { ORDER_STATUS_COLORS } from "@/lib/product-order-colors";
import {
  NEXT_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  canCancel,
  mapsUrl,
  nextStatus,
  shortOrderCode,
  validateCancelReason,
} from "@/lib/product-orders";
import { updateProductOrderStatus } from "@/lib/products-api";
import type { ProductOrder } from "@/types/database";

interface ProductOrderDetailModalProps {
  order: ProductOrder | null;
  onClose: () => void;
  /** Chamado depois de uma alteração, para a página recarregar a lista. */
  onUpdated: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-heading font-bold text-contrast uppercase tracking-wider mb-2 mt-5 first:mt-0">
      {children}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border last:border-0">
      <span className="text-xs text-contrast font-body shrink-0 mr-4">{label}</span>
      <span className="text-xs text-dark font-body text-right break-words min-w-0">{value}</span>
    </div>
  );
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/**
 * Painel de detalhe de um pedido de produtos. O estado interno (motivo de
 * cancelamento, "a guardar") reinicia-se porque a página monta este componente
 * com `key` = id do pedido aberto.
 */
export default function ProductOrderDetailModal({
  order,
  onClose,
  onUpdated,
}: ProductOrderDetailModalProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const next = order ? nextStatus(order.status) : null;
  const color = order ? ORDER_STATUS_COLORS[order.status] : "";

  async function handleAdvance() {
    if (!order || !next) return;
    setBusy(true);
    try {
      await updateProductOrderStatus(order.id, order.status, next);
      toast("success", `Pedido ${shortOrderCode(order.id)}: ${ORDER_STATUS_LABELS[next]}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Erro ao atualizar o pedido.");
    } finally {
      setBusy(false);
      onUpdated();
    }
  }

  async function handleConfirmCancel() {
    if (!order) return;
    const error = validateCancelReason(reason);
    if (error) {
      setReasonError(error);
      return;
    }
    setBusy(true);
    try {
      await updateProductOrderStatus(order.id, order.status, "cancelled", reason);
      toast("success", `Pedido ${shortOrderCode(order.id)} cancelado`);
      onUpdated();
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Erro ao cancelar o pedido.");
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  const footer = order && (next || canCancel(order.status)) && (
    <div className="flex flex-col gap-3">
      {cancelling && (
        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-body text-contrast mb-1">
            Motivo do cancelamento *
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError("");
            }}
            rows={3}
            placeholder="Ex.: sem stock, morada fora da zona de entrega…"
            className={`w-full rounded-lg bg-background border text-dark placeholder:text-contrast/40 focus:outline-none focus:ring-1 px-3 py-2 text-sm font-body resize-none ${
              reasonError ? "border-danger focus:ring-danger" : "border-border focus:ring-primary"
            }`}
          />
          {reasonError ? (
            <p className="mt-1 text-xs text-danger font-body">{reasonError}</p>
          ) : (
            <p className="mt-1 text-xs text-contrast font-body">
              O cliente recebe este motivo na notificação.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {canCancel(order.status) && !cancelling && (
          <button
            type="button"
            onClick={() => setCancelling(true)}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-danger/40 text-danger text-sm font-body hover:bg-danger/10 transition-colors duration-200 cursor-pointer disabled:opacity-50"
          >
            Cancelar pedido
          </button>
        )}
        {cancelling && (
          <>
            <button
              type="button"
              onClick={() => {
                setCancelling(false);
                setReason("");
                setReasonError("");
              }}
              disabled={busy}
              className="px-4 py-2 text-sm font-body text-contrast hover:text-dark transition-colors duration-200 cursor-pointer disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={busy}
              className="px-5 py-2 rounded-lg bg-danger text-white font-heading font-bold text-sm hover:opacity-90 transition-opacity duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "A cancelar..." : "Confirmar cancelamento"}
            </button>
          </>
        )}
        {next && !cancelling && (
          <button
            type="button"
            onClick={handleAdvance}
            disabled={busy}
            className="px-5 py-2 rounded-lg bg-primary text-on-primary font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "A atualizar..." : NEXT_ACTION_LABELS[order.status]}
          </button>
        )}
      </div>
    </div>
  );

  const items = order?.product_order_items ?? [];
  const accountPhone = order?.users?.phone ?? null;
  const showAccountPhone =
    accountPhone && digits(accountPhone) !== digits(order?.contact_phone);

  return (
    <SlidePanel
      open={!!order}
      onClose={onClose}
      title={order ? `Pedido ${shortOrderCode(order.id)}` : "Pedido"}
      footer={footer || undefined}
    >
      {order && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs px-2.5 py-1 rounded-md font-semibold"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span className="text-xs text-contrast font-body">
              Feito em {formatDateTime(order.created_at)}
            </span>
          </div>

          {order.status === "cancelled" && order.cancel_reason && (
            <div className="mt-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-dark font-body">
              <span className="font-semibold text-danger">Motivo do cancelamento: </span>
              {order.cancel_reason}
            </div>
          )}

          <SectionTitle>Cliente</SectionTitle>
          <InfoRow label="Nome" value={order.users?.full_name ?? "—"} />
          <InfoRow label="E-mail" value={order.users?.email ?? "—"} />
          <InfoRow
            label="Telemóvel de contacto"
            value={
              order.contact_phone ? (
                <a
                  href={`tel:${order.contact_phone.replace(/\s/g, "")}`}
                  className="text-primary-dark hover:underline"
                >
                  {formatPhoneAO(order.contact_phone)}
                </a>
              ) : (
                "—"
              )
            }
          />
          {showAccountPhone && (
            <InfoRow label="Telemóvel da conta" value={formatPhoneAO(accountPhone)} />
          )}

          <SectionTitle>Entrega</SectionTitle>
          <InfoRow label="Morada" value={order.delivery_address} />
          {order.delivery_reference && (
            <InfoRow label="Referência" value={order.delivery_reference} />
          )}
          <div className="pt-2">
            <a
              href={mapsUrl(order)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-dark hover:underline"
            >
              Abrir no Google Maps
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

          <SectionTitle>Itens</SectionTitle>
          {items.length === 0 ? (
            <p className="text-xs text-contrast font-body">Sem itens registados.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between items-start gap-4 py-2 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-dark font-body">
                      {item.quantity}× {item.product_name}
                    </p>
                    <p className="text-[11px] text-contrast font-body">
                      {formatKz(item.unit_price)} cada
                    </p>
                  </div>
                  <span className="text-xs text-dark font-medium shrink-0">
                    {formatKz(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 rounded-lg bg-background border border-border px-3 py-1">
            <InfoRow label="Subtotal" value={formatKz(order.subtotal)} />
            <InfoRow label="Taxa de entrega" value={formatKz(order.delivery_fee)} />
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-heading font-bold text-dark">Total</span>
              <span className="text-sm font-heading font-bold text-dark">
                {formatKz(order.total)}
              </span>
            </div>
          </div>

          <SectionTitle>Pagamento</SectionTitle>
          <InfoRow label="Forma de pagamento" value={formatPaymentMethod(order.payment_method)} />

          {order.notes && (
            <>
              <SectionTitle>Notas do cliente</SectionTitle>
              <p className="text-xs text-dark font-body leading-relaxed whitespace-pre-wrap">
                {order.notes}
              </p>
            </>
          )}

          <SectionTitle>Histórico</SectionTitle>
          <InfoRow label="Pedido feito" value={formatDateTime(order.created_at)} />
          {order.confirmed_at && (
            <InfoRow label="Confirmado" value={formatDateTime(order.confirmed_at)} />
          )}
          {order.delivered_at && (
            <InfoRow label="Entregue" value={formatDateTime(order.delivered_at)} />
          )}
          {order.cancelled_at && (
            <InfoRow label="Cancelado" value={formatDateTime(order.cancelled_at)} />
          )}
        </div>
      )}
    </SlidePanel>
  );
}
