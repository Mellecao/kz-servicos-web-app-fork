"use client";

import { useEffect, useState, useCallback } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, { type KanbanListColumn } from "@/components/KanbanListView";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import NovaSolicitacaoForm from "@/components/forms/NovaSolicitacaoForm";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { fetchServiceRequests, updateServiceRequestStatus } from "@/lib/api";
import { isServiceAdminActionRequired } from "@/lib/service-status";
import type { ServiceRequest, ServiceRequestStatus } from "@/types/database";
import { formatDateTime } from "@/lib/format";
import { SERVICE_STATUS_COLORS } from "@/lib/service-request-colors";
import {
  SERVICE_STATUSES,
  SERVICE_STATUS_LABELS,
  serviceMoveBlockReason,
} from "@/lib/service-requests";

const serviceColumnConfig = SERVICE_STATUSES.map((id) => ({
  id,
  title: SERVICE_STATUS_LABELS[id],
  color: SERVICE_STATUS_COLORS[id],
}));

export default function OutrosServicosPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'board'
  );

  // Recarregamento silencioso: `loading` só vale para a primeira carga.
  const loadRequests = useCallback(() => {
    fetchServiceRequests()
      .then(setRequests)
      .catch((error) => {
        console.error("[outros-servicos] fetchServiceRequests error:", error);
        toast("danger", "Não foi possível carregar os serviços.");
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const channel = supabase
      .channel("outros-servicos-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests" },
        () => loadRequests(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  const handleCardMove = useCallback(
    async (cardId: string, _fromColumnId: string, toColumnId: string) => {
      const newStatus = toColumnId as ServiceRequestStatus;
      const current = requests.find((r) => r.id === cardId);
      const blocked = current ? serviceMoveBlockReason(current, newStatus) : null;
      if (blocked) {
        toast("warning", blocked);
        return;
      }
      // Optimistic update
      setRequests((prev) =>
        prev.map((r) => (r.id === cardId ? { ...r, status: newStatus } : r))
      );
      try {
        await updateServiceRequestStatus(cardId, newStatus);
        toast("success", "Estado do serviço atualizado");
        loadRequests(); // o banco pode ajustar o estado (ex.: atribuído → a aguardar prestador)
      } catch {
        toast("danger", "Erro ao atualizar o estado");
        loadRequests(); // Rollback
      }
    },
    [requests, toast, loadRequests]
  );

  // O serviço aberto vem sempre da lista, para o detalhe refletir o estado mais recente.
  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null;

  const columns = serviceColumnConfig.map((col) => {
    const colRequests = requests.filter((r) => r.status === col.id);
    return {
      ...col,
      cards: colRequests.map((r) => ({
        id: r.id,
        title: r.description.length > 50 ? r.description.slice(0, 50) + "…" : r.description,
        subtitle: r.users?.full_name ?? "—",
        date: formatDateTime(r.service_date),
        ...(r.freeform_profession
          ? { tag: `👤 ${r.freeform_profession}`, tagColor: "#8B5CF6" }
          : r.service_categories
          ? { tag: r.service_categories.name, tagColor: "#2261FE" }
          : {}),
        ...(r.is_paid ? { tag: "Pago", tagColor: "#22c55e" } : {}),
        requiresAttention: isServiceAdminActionRequired(r.status),
      })),
    };
  });

  const listActionConfig: Record<string, { actionLabel: string; nextColumnId: string }> = {
    open: { actionLabel: "Analisar", nextColumnId: "under_review" },
    under_review: { actionLabel: "Procurar Prestador", nextColumnId: "searching_provider" },
    searching_provider: { actionLabel: "Atribuir", nextColumnId: "assigned" },
    assigned: { actionLabel: "Iniciar", nextColumnId: "in_progress" },
    in_progress: { actionLabel: "Finalizar", nextColumnId: "finished" },
  };

  const listColumns: KanbanListColumn[] = columns.map((col) => ({
    ...col,
    ...(listActionConfig[col.id] ?? {}),
  }));

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Outros Serviços
          </h1>
          <p className="text-contrast text-sm mt-1">
            Faça a gestão das solicitações de serviços gerais
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer"
        >
          + Nova Solicitação
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'list' ? 'bg-primary text-on-primary' : 'bg-surface border border-border text-dark'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Lista
        </button>
        <button
          onClick={() => setViewMode('board')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'board' ? 'bg-primary text-on-primary' : 'bg-surface border border-border text-dark'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          Board
        </button>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="text-center py-16 text-contrast text-sm">A carregar serviços...</div>
      ) : viewMode === 'list' ? (
        <KanbanListView
          columns={listColumns}
          onMoveCard={(cardId, fromCol, toCol) => handleCardMove(cardId, fromCol, toCol)}
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

      <NovaSolicitacaoForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadRequests}
      />

      <ServiceDetailModal
        request={selectedRequest}
        open={!!selectedRequest}
        onClose={() => setSelectedId(null)}
        onUpdate={loadRequests}
      />
    </div>
  );
}
