"use client";

import { useEffect, useState, useCallback } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanListView, { type KanbanListColumn } from "@/components/KanbanListView";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import NovaSolicitacaoForm from "@/components/forms/NovaSolicitacaoForm";
import { useToast } from "@/components/Toast";
import { fetchServiceRequests, updateServiceRequestStatus } from "@/lib/api";
import type { ServiceRequest, ServiceRequestStatus } from "@/types/database";

const serviceColumnConfig: {
  id: ServiceRequestStatus;
  title: string;
  color: string;
}[] = [
  { id: "open", title: "Aberto", color: "#FEBF22" },
  { id: "under_review", title: "Em Análise", color: "#5C5956" },
  { id: "searching_provider", title: "Buscando Prestador", color: "#2261FE" },
  { id: "assigned", title: "Atribuído", color: "#2261FE" },
  { id: "in_progress", title: "Em Andamento", color: "#22c55e" },
  { id: "finished", title: "Finalizado", color: "#22c55e" },
  { id: "cancelled", title: "Cancelado", color: "#ef4444" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OutrosServicosPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'board'
  );

  const loadRequests = useCallback(() => {
    setLoading(true);
    fetchServiceRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleCardMove = useCallback(
    async (cardId: string, _fromColumnId: string, toColumnId: string) => {
      const newStatus = toColumnId as ServiceRequestStatus;
      // Optimistic update
      setRequests((prev) =>
        prev.map((r) => (r.id === cardId ? { ...r, status: newStatus } : r))
      );
      try {
        await updateServiceRequestStatus(cardId, newStatus);
        toast("success", "Status do serviço atualizado");
      } catch {
        toast("danger", "Erro ao atualizar status");
        loadRequests(); // Rollback
      }
    },
    [toast, loadRequests]
  );

  const handleCardClick = useCallback(
    (cardId: string) => {
      const req = requests.find((r) => r.id === cardId);
      if (req) setSelectedRequest(req);
    },
    [requests]
  );

  const columns = serviceColumnConfig.map((col) => {
    const colRequests = requests.filter((r) => r.status === col.id);
    return {
      ...col,
      cards: colRequests.map((r) => ({
        id: r.id,
        title: r.description.length > 50 ? r.description.slice(0, 50) + "…" : r.description,
        subtitle: r.users?.full_name ?? "—",
        date: formatDate(r.service_date),
        ...(r.service_categories
          ? { tag: r.service_categories.name, tagColor: "#2261FE" }
          : {}),
        ...(r.is_paid ? { tag: "Pago", tagColor: "#22c55e" } : {}),
      })),
    };
  });

  const listActionConfig: Record<string, { actionLabel: string; nextColumnId: string }> = {
    open: { actionLabel: "Analisar", nextColumnId: "under_review" },
    under_review: { actionLabel: "Buscar Prestador", nextColumnId: "searching_provider" },
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
            Gerencie as solicitações de serviços gerais
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer"
        >
          + Nova Solicitação
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'list' ? 'bg-primary text-background' : 'bg-surface border border-border text-dark'
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
            viewMode === 'board' ? 'bg-primary text-background' : 'bg-surface border border-border text-dark'
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
        <div className="text-center py-16 text-contrast text-sm">Carregando serviços...</div>
      ) : viewMode === 'list' ? (
        <KanbanListView
          columns={listColumns}
          onMoveCard={(cardId, fromCol, toCol) => handleCardMove(cardId, fromCol, toCol)}
          onCardClick={(card) => handleCardClick(card.id)}
        />
      ) : (
        <div className="overflow-x-auto">
          <KanbanBoard
            columns={columns}
            onCardMove={handleCardMove}
            onCardClick={(cardId) => handleCardClick(cardId)}
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
        onClose={() => setSelectedRequest(null)}
        onUpdate={loadRequests}
      />
    </div>
  );
}
