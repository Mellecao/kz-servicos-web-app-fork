"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { fetchServiceStatusHistory, type ServiceStatusChange } from "@/lib/service-flow-api";
import { SERVICE_STATUS_LABELS } from "@/lib/service-requests";
import type { ServiceRequestStatus } from "@/types/database";

const label = (status: string | null) =>
  status ? (SERVICE_STATUS_LABELS[status as ServiceRequestStatus] ?? status) : "—";

/**
 * Histórico de estados do serviço (só leitura). `status` é dependência para o
 * histórico se atualizar quando o admin muda o estado com o detalhe aberto.
 */
export default function ServiceHistory({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const [changes, setChanges] = useState<ServiceStatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServiceStatusHistory(requestId)
      .then((rows) => {
        if (!cancelled) {
          setChanges(rows);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, status]);

  return (
    <section aria-label="Histórico do serviço" className="mt-5">
      <p className="text-xs font-heading font-bold text-contrast uppercase tracking-wider mb-2">
        Histórico
      </p>
      {loading ? (
        <p className="text-xs text-contrast">A carregar histórico...</p>
      ) : failed ? (
        <p className="text-xs text-danger">Não foi possível carregar o histórico.</p>
      ) : changes.length === 0 ? (
        <p className="text-xs text-contrast">Ainda sem mudanças de estado.</p>
      ) : (
        <ol className="flex flex-col">
          {changes.map((c) => (
            <li key={c.id} className="py-2 border-b border-border last:border-0 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-dark">
                  {label(c.from_status)} → <strong>{label(c.to_status)}</strong>
                </span>
                <span className="text-contrast shrink-0">{formatDateTime(c.created_at)}</span>
              </div>
              {c.observations && <p className="mt-1 text-contrast">{c.observations}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
