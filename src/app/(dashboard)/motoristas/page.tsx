"use client";

import { useEffect, useState, useCallback } from "react";
import {
  deleteUserById,
  fetchDriverProfiles,
  fetchRatingsForUser,
  fetchVehiclesByDriver,
  isPublicRating,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { DriverProfile, Rating, Vehicle, ProviderStatus } from "@/types/database";
import NovoMotoristaForm from "@/components/forms/NovoMotoristaForm";

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
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

interface DriverWithVehicle extends DriverProfile {
  vehicle?: Vehicle;
}

function DriverPublicPhotos({ driver }: { driver: DriverWithVehicle }) {
  const photos = [...(driver.driver_profile_photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 3);

  if (photos.length === 0) {
    return <span className="text-xs text-contrast/60">Sem fotos públicas</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {photos.map((photo) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={photo.id}
          src={photo.photo_url}
          alt="Foto pública do motorista"
          className="h-8 w-8 rounded-lg object-cover border border-border bg-background"
        />
      ))}
      {(driver.driver_profile_photos?.length ?? 0) > photos.length && (
        <span className="text-xs text-contrast">
          +{(driver.driver_profile_photos?.length ?? 0) - photos.length}
        </span>
      )}
    </div>
  );
}

export default function MotoristasPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverWithVehicle | null>(null);
  const [ratingsDriverName, setRatingsDriverName] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table"
  );

  const loadDrivers = useCallback(() => {
    setLoading(true);
    fetchDriverProfiles()
      .then(async (driversList) => {
        const withVehicles = await Promise.all(
          driversList.map(async (d) => {
            try {
              const vehicles = await fetchVehiclesByDriver(d.id);
              const activeVehicle = vehicles.find((v) => v.is_active) ?? vehicles[0];
              return { ...d, vehicle: activeVehicle } as DriverWithVehicle;
            } catch {
              return { ...d } as DriverWithVehicle;
            }
          })
        );
        setDrivers(withVehicles);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  async function handleDeleteDriver(driver: DriverWithVehicle) {
    const userId = driver.provider_profiles?.users?.id;
    const name = driver.provider_profiles?.users?.full_name ?? "este motorista";
    if (!userId) {
      toast("danger", "Não foi possível localizar o usuário do motorista.");
      return;
    }

    const confirmed = window.confirm(
      `Excluir ${name}? Essa ação apaga o motorista, veículo e perfil de acesso.`
    );
    if (!confirmed) return;

    setDeletingUserId(userId);
    try {
      await deleteUserById(userId);
      toast("success", "Motorista excluído com sucesso.");
      await loadDrivers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast("danger", message || "Erro ao excluir motorista.");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleOpenRatings(driver: DriverWithVehicle) {
    const user = driver.provider_profiles?.users;
    if (!user?.id) {
      toast("danger", "Não foi possível localizar o usuário do motorista.");
      return;
    }

    setRatingsDriverName(user.full_name ?? "Motorista");
    setRatings([]);
    setRatingsLoading(true);
    try {
      setRatings(await fetchRatingsForUser(user.id));
    } catch {
      toast("danger", "Erro ao carregar avaliações.");
    } finally {
      setRatingsLoading(false);
    }
  }

  const filtered = drivers.filter((d) => {
    const name = d.provider_profiles?.users?.full_name ?? "";
    const phone = d.provider_profiles?.users?.phone ?? "";
    const q = search.toLowerCase();
    const matchSearch = name.toLowerCase().includes(q) || phone.toLowerCase().includes(q);
    const status = d.provider_profiles?.status ?? "";
    const matchStatus = statusFilter ? status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">Motoristas</h1>
          <p className="text-contrast text-sm mt-1">
            Gerencie os motoristas cadastrados na plataforma
          </p>
        </div>
        <button
          onClick={() => {
            setEditingDriver(null);
            setShowForm(true);
          }}
          className="bg-primary text-background px-5 py-2.5 rounded-lg font-heading font-bold text-sm hover:bg-primary-dark transition-colors cursor-pointer duration-200"
        >
          + Novo Motorista
        </button>
      </div>

      {/* Search & Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar motorista..."
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
            <option value="rejected">Rejeitados</option>
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
          Nenhum motorista encontrado.
        </div>
      ) : viewMode === "cards" ? (
        /* Cards view */
        <div className="flex flex-col gap-2">
          {filtered.map((driver) => {
            const name = driver.provider_profiles?.users?.full_name ?? "Sem nome";
            const phone = driver.provider_profiles?.users?.phone ?? "—";
            const status = (driver.provider_profiles?.status ?? "pending") as ProviderStatus;
            const userId = driver.provider_profiles?.users?.id;

            return (
              <div
                key={driver.id}
                className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background text-sm font-semibold flex-shrink-0">
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-dark text-sm truncate">{name}</p>
                  <p className="text-muted text-xs truncate">{phone}</p>
                  <div className="mt-2">
                    <DriverPublicPhotos driver={driver} />
                  </div>
                </div>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `${statusColors[status]}15`,
                    color: statusColors[status],
                  }}
                >
                  {statusLabels[status]}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenRatings(driver)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-dark hover:bg-surface-hover transition-colors"
                  aria-label={`Ver avaliações de ${name}`}
                  title="Avaliações"
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDriver(driver);
                    setShowForm(true);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-dark hover:bg-surface-hover transition-colors"
                  aria-label={`Editar ${name}`}
                  title="Editar motorista"
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
                      d="m16.862 4.487 1.651-1.651a1.875 1.875 0 1 1 2.651 2.651L8.625 18.026 4.5 19.5l1.474-4.125L16.862 4.487Z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDriver(driver)}
                  disabled={!userId || deletingUserId === userId}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Excluir ${name}`}
                  title="Excluir motorista"
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
            );
          })}
        </div>
      ) : (
        /* Table view */
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
                    Fotos
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    CNH
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Disponibilidade
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Avaliação
                  </th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-contrast uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((driver) => {
                  const name = driver.provider_profiles?.users?.full_name ?? "Sem nome";
                  const phone = driver.provider_profiles?.users?.phone ?? "—";
                  const status = (driver.provider_profiles?.status ?? "pending") as ProviderStatus;
                  const rating = driver.provider_profiles?.average_rating ?? 0;
                  const userId = driver.provider_profiles?.users?.id;

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {getInitials(name)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-dark">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">{phone}</td>
                      <td className="px-5 py-3.5">
                        <DriverPublicPhotos driver={driver} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: `${statusColors[status]}15`,
                            color: statusColors[status],
                          }}
                        >
                          {statusLabels[status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">
                        {driver.cnh_category ? `Cat. ${driver.cnh_category}` : "—"}
                        {driver.cnh_expiration_date
                          ? ` • Venc. ${formatDate(driver.cnh_expiration_date)}`
                          : ""}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            driver.is_available ? "text-success" : "text-contrast/50"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              driver.is_available ? "bg-success" : "bg-contrast/30"
                            }`}
                          />
                          {driver.is_available ? "Disponível" : "Indisponível"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">
                        {rating > 0 ? `⭐ ${rating.toFixed(1)}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenRatings(driver)}
                          className="mr-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-dark hover:bg-surface-hover transition-colors"
                        >
                          ★ Avaliações
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDriver(driver);
                            setShowForm(true);
                          }}
                          className="mr-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-dark hover:bg-surface-hover transition-colors"
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
                              d="m16.862 4.487 1.651-1.651a1.875 1.875 0 1 1 2.651 2.651L8.625 18.026 4.5 19.5l1.474-4.125L16.862 4.487Z"
                            />
                          </svg>
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDriver(driver)}
                          disabled={!userId || deletingUserId === userId}
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
                          {deletingUserId === userId ? "Excluindo..." : "Excluir"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoMotoristaForm
        open={showForm}
        driver={editingDriver}
        onClose={() => {
          setShowForm(false);
          setEditingDriver(null);
        }}
        onSuccess={loadDrivers}
      />

      {ratingsDriverName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-dark">
                  Avaliações de {ratingsDriverName}
                </h2>
                <p className="mt-1 text-xs text-contrast">
                  Avaliações negativas são anônimas e serão analisadas pela equipe KZ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRatingsDriverName(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-dark hover:bg-surface-hover"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {ratingsLoading ? (
                <p className="text-sm text-contrast">Carregando avaliações...</p>
              ) : ratings.length === 0 ? (
                <p className="text-sm text-contrast">Nenhuma avaliação encontrada.</p>
              ) : (
                <div className="space-y-3">
                  {ratings.map((item) => {
                    const publicRating = isPublicRating(item);
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-surface p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-heading font-bold text-dark">
                            ★ {Number(item.rating).toFixed(1)}
                          </span>
                          <span className="text-xs text-contrast">
                            {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-contrast">
                          {publicRating
                            ? `Avaliador: ${item.rater?.full_name ?? item.rater?.email ?? "Cliente"}`
                            : "Avaliador: anônimo para avaliação negativa"}
                        </p>
                        {item.comment && (
                          <p className="mt-2 text-sm text-dark">{item.comment}</p>
                        )}
                        {!publicRating && (
                          <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                            Comentário restrito ao painel admin para análise da equipe KZ.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
