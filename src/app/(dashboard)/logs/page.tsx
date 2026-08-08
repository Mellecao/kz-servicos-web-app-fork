"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAdminLogs, fetchTripById } from "@/lib/api";
import TripDetailModal from "@/components/TripDetailModal";
import { useToast } from "@/components/Toast";
import { isLogClickable } from "@/lib/admin-log-utils";
import type { AdminLog, Trip } from "@/types/database";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionColor(action: string): { bg: string; text: string } {
  if (action.includes("cancelada") || action.includes("removida") || action.includes("removido")) {
    return { bg: "#ef444420", text: "#ef4444" };
  }
  if (action.includes("aprovada") || action.includes("aprovado") || action.includes("selecionado")) {
    return { bg: "#22c55e20", text: "#22c55e" };
  }
  if (action.includes("recusada")) {
    return { bg: "#f9731620", text: "#f97316" };
  }
  return { bg: "#2261FE20", text: "#2261FE" };
}

function DetailsBadge({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-surface-hover border border-border text-contrast"
        >
          <span className="font-medium text-dark">{key}:</span>
          <span>{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);

  const loadLogs = useCallback(() => {
    setLoading(true);
    fetchAdminLogs()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 30_000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const handleLogClick = useCallback(
    async (log: AdminLog) => {
      if (!isLogClickable(log) || loadingLogId) return;
      setLoadingLogId(log.id);
      try {
        const trip = await fetchTripById(log.entity_id as string);
        setSelectedTrip(trip);
      } catch {
        toast("warning", "Não foi possível encontrar os detalhes desta corrida.");
      } finally {
        setLoadingLogId(null);
      }
    },
    [toast, loadingLogId],
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Logs de Atividade</h1>
          <p className="text-contrast text-sm mt-1">Ações administrativas das últimas 24 horas</p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-contrast hover:text-dark hover:bg-surface-hover transition-colors text-sm font-medium cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9" />
            <polyline points="3 4 3 10 9 10" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">Carregando logs...</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-border">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-contrast text-sm">Nenhuma ação registrada nas últimas 24 horas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const color = actionColor(log.action);
            const clickable = isLogClickable(log);
            const isLoadingRow = loadingLogId === log.id;
            const rowClassName = `bg-surface border border-border rounded-xl px-5 py-4${
              clickable
                ? " w-full text-left transition-colors hover:border-primary/40 hover:bg-background cursor-pointer disabled:cursor-wait disabled:opacity-70"
                : ""
            }`;

            const rowContent = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Action badge */}
                    <span
                      className="flex-shrink-0 mt-0.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {log.action}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <span className="flex-shrink-0 text-xs text-contrast whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </span>
                </div>

                {/* Admin + entity */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-contrast">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="font-medium text-dark">{log.admin?.full_name ?? "Admin"}</span>
                    {log.admin?.email && (
                      <span className="text-xs text-contrast/70">({log.admin.email})</span>
                    )}
                  </div>

                  {log.entity_id && (
                    <div className="flex items-center gap-1.5 text-contrast">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                      <span className="font-mono text-xs text-contrast/70 truncate max-w-[180px]">
                        {isLoadingRow ? "Carregando..." : log.entity_id}
                      </span>
                    </div>
                  )}
                </div>

                <DetailsBadge details={log.details} />
              </>
            );

            if (clickable) {
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => handleLogClick(log)}
                  disabled={isLoadingRow}
                  className={rowClassName}
                >
                  {rowContent}
                </button>
              );
            }

            return (
              <div key={log.id} className={rowClassName}>
                {rowContent}
              </div>
            );
          })}
        </div>
      )}

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        onUpdate={loadLogs}
      />
    </div>
  );
}
