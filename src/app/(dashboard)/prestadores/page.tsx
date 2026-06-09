"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchProviderProfiles } from "@/lib/api";
import type { ProviderProfile, ProviderStatus } from "@/types/database";
import NovoPrestadorForm from "@/components/forms/NovoPrestadorForm";

const statusLabels: Record<ProviderStatus, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  rejected: "Rejeitado",
  suspended: "Suspenso",
};

const statusColors: Record<ProviderStatus, string> = {
  approved: "#22c55e",
  pending: "#FEBF22",
  rejected: "#ef4444",
  suspended: "#5C5956",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function PrestadoresPage() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table"
  );

  const loadProviders = useCallback(() => {
    setLoading(true);
    fetchProviderProfiles()
      .then(setProviders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const filtered = providers.filter((p) => {
    const name = p.users?.full_name ?? "";
    const phone = p.users?.phone ?? "";
    const q = search.toLowerCase();
    const matchSearch = name.toLowerCase().includes(q) || phone.toLowerCase().includes(q);
    const matchStatus = statusFilter ? p.status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Prestadores
          </h1>
          <p className="text-contrast text-sm mt-1">
            Gerencie os prestadores de serviço da plataforma
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors cursor-pointer duration-200"
        >
          + Novo Prestador
        </button>
      </div>

      {/* Search & Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar prestador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-auto max-w-md px-4 py-2.5 rounded-lg border border-border bg-background text-dark placeholder:text-contrast/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-contrast">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-border bg-background text-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="approved">Aprovados</option>
            <option value="pending">Pendentes</option>
            <option value="suspended">Suspensos</option>
          </select>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode("cards")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === "cards"
              ? "bg-primary text-background"
              : "bg-surface border border-border text-dark"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Cards
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === "table"
              ? "bg-primary text-background"
              : "bg-surface border border-border text-dark"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
          Tabela
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-contrast text-sm">
          Nenhum prestador encontrado.
        </div>
      ) : viewMode === "cards" ? (
        <div className="flex flex-col gap-2">
          {filtered.map((provider) => {
            const name = provider.users?.full_name ?? "Sem nome";
            const phone = provider.users?.phone ?? "—";

            return (
              <div
                key={provider.id}
                className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3 cursor-pointer hover:border-primary transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background text-sm font-semibold flex-shrink-0">
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-dark text-sm truncate">{name}</p>
                  <p className="text-muted text-xs truncate">{phone}</p>
                </div>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `${statusColors[provider.status]}15`,
                    color: statusColors[provider.status],
                  }}
                >
                  {statusLabels[provider.status]}
                </span>
                <svg
                  className="w-4 h-4 text-muted flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Avaliação
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((provider) => {
                  const name = provider.users?.full_name ?? "Sem nome";
                  const phone = provider.users?.phone ?? "—";
                  const category = provider.service_categories?.name ?? "—";

                  return (
                    <tr
                      key={provider.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {getInitials(name)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-dark">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">
                        {phone}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">
                        {category}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">
                        {provider.average_rating > 0
                          ? `⭐ ${provider.average_rating.toFixed(1)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: `${statusColors[provider.status]}15`,
                            color: statusColors[provider.status],
                          }}
                        >
                          {statusLabels[provider.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoPrestadorForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadProviders}
      />
    </div>
  );
}
