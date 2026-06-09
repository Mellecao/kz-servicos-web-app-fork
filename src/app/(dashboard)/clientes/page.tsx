"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchClients, deleteUserById } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { User } from "@/types/database";
import NovoClienteForm from "@/components/forms/NovoClienteForm";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ClientesPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table"
  );

  const loadClients = useCallback(() => {
    setLoading(true);
    fetchClients()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function handleDeleteClient(client: User) {
    const name = client.full_name || client.email;
    const confirmed = window.confirm(
      `Excluir ${name}? Essa ação apaga o cliente e o acesso ao app.`
    );
    if (!confirmed) return;

    setDeletingUserId(client.id);
    try {
      await deleteUserById(client.id);
      toast("success", "Cliente excluído com sucesso.");
      await loadClients();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast("danger", message || "Erro ao excluir cliente.");
    } finally {
      setDeletingUserId(null);
    }
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Clientes
          </h1>
          <p className="text-contrast text-sm mt-1">
            Gerencie os clientes da plataforma
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors cursor-pointer duration-200"
        >
          + Novo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-auto max-w-md px-4 py-2.5 rounded-lg border border-border bg-background text-dark placeholder:text-contrast/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        />
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
          Nenhum cliente encontrado.
        </div>
      ) : viewMode === "cards" ? (
        <div className="flex flex-col gap-2">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background text-sm font-semibold flex-shrink-0">
                {getInitials(client.full_name || client.email)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dark text-sm truncate">
                  {client.full_name || "—"}
                </p>
                <p className="text-muted text-xs truncate">{client.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteClient(client)}
                disabled={deletingUserId === client.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Excluir ${client.full_name || client.email}`}
                title="Excluir cliente"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6h18M8 6V4h8v2m-7 0h6m-8 0 1 14h8l1-14"
                  />
                </svg>
              </button>
            </div>
          ))}
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
                    E-mail
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-surface-hover/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {client.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-dark">
                          {client.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-contrast">
                      {client.email}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-contrast">
                      {client.phone ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          client.is_active
                            ? "text-success"
                            : "text-contrast/50"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            client.is_active ? "bg-success" : "bg-contrast/30"
                          }`}
                        />
                        {client.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-contrast">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteClient(client)}
                        disabled={deletingUserId === client.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 6h18M8 6V4h8v2m-7 0h6m-8 0 1 14h8l1-14"
                          />
                        </svg>
                        {deletingUserId === client.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoClienteForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadClients}
      />
    </div>
  );
}
