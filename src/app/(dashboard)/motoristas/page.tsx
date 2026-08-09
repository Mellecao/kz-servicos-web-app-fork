"use client";

import { useEffect, useState, useCallback } from "react";
import {
  deleteDriverById,
  deleteDriverProfilePhoto,
  deleteVehiclePhoto,
  fetchDriverPerformance,
  fetchDriverProfiles,
  fetchRatingsForUser,
  fetchVehiclesByDriver,
  isPublicRating,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import type {
  DriverProfile,
  DriverTripHistoryEntry,
  Rating,
  Vehicle,
  VehiclePhoto,
  ProviderStatus,
  DriverMetricPeriod,
  DriverMetrics,
} from "@/types/database";
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

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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

const emptyDriverMetrics: DriverMetrics = {
  finishedTrips: 0,
  cancelledTrips: 0,
  refusedTrips: 0,
  averageRating: 0,
};

const metricPeriodLabels: Record<DriverMetricPeriod, string> = {
  today: "Hoje",
  week: "Semana",
  month: "Mês",
  year: "Ano",
};

function DriverAvatar({
  name,
  avatarUrl,
  size = "md",
  onClick,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}) {
  const sizeClass =
    size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const content = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={`Foto de perfil de ${name}`}
      className={`${sizeClass} rounded-full object-cover border border-border bg-background`}
    />
  ) : (
    <span
      className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary`}
    >
      {getInitials(name)}
    </span>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={`Abrir preview do perfil de ${name}`}
      title="Preview do perfil"
    >
      {content}
    </button>
  );
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

function PreviewPhotoGrid({
  title,
  photos,
  emptyText,
  deletingPhotoId,
  onOpen,
  onDelete,
}: {
  title: string;
  photos: Array<{ id: string; photo_url: string }>;
  emptyText: string;
  deletingPhotoId: string | null;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-heading font-bold text-dark">{title}</h3>
      {photos.length === 0 ? (
        <p className="mt-2 text-xs text-contrast">{emptyText}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => onOpen(photo.photo_url)}
                className="h-full w-full"
                aria-label="Abrir foto ampliada"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photo_url}
                  alt={title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
              <button
                type="button"
                onClick={() => onDelete(photo.id)}
                disabled={deletingPhotoId === photo.id}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white shadow disabled:opacity-60"
                aria-label="Remover foto"
                title="Remover foto"
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
  const [editingDriver, setEditingDriver] = useState<DriverWithVehicle | null>(
    null,
  );
  const [ratingsDriverName, setRatingsDriverName] = useState<string | null>(
    null,
  );
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [historyDriverName, setHistoryDriverName] = useState<string | null>(
    null,
  );
  const [tripHistory, setTripHistory] = useState<DriverTripHistoryEntry[]>([]);
  const [tripHistoryLoading, setTripHistoryLoading] = useState(false);
  const [historyDriver, setHistoryDriver] = useState<DriverWithVehicle | null>(
    null,
  );
  const [historyPeriod, setHistoryPeriod] =
    useState<DriverMetricPeriod>("month");
  const [driverMetrics, setDriverMetrics] =
    useState<DriverMetrics>(emptyDriverMetrics);
  const [previewDriver, setPreviewDriver] = useState<DriverWithVehicle | null>(
    null,
  );
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">(() =>
    typeof window !== "undefined" && window.innerWidth < 768
      ? "cards"
      : "table",
  );

  const loadDrivers = useCallback(() => {
    setLoading(true);
    fetchDriverProfiles()
      .then(async (driversList) => {
        const withVehicles = await Promise.all(
          driversList.map(async (d) => {
            try {
              const vehicles = await fetchVehiclesByDriver(d.id);
              const activeVehicle =
                vehicles.find((v) => v.is_active) ?? vehicles[0];
              return { ...d, vehicle: activeVehicle } as DriverWithVehicle;
            } catch {
              return { ...d } as DriverWithVehicle;
            }
          }),
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
      `Excluir ${name}? Essa ação remove o acesso, o perfil do motorista e o veículo. O histórico será preservado de forma anônima.`,
    );
    if (!confirmed) return;

    setDeletingUserId(userId);
    try {
      await deleteDriverById(driver.id);
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

  const loadDriverPerformance = useCallback(
    async (driver: DriverWithVehicle, period: DriverMetricPeriod) => {
      const user = driver.provider_profiles?.users;
      if (!user?.id) {
        toast("danger", "Não foi possível localizar o usuário do motorista.");
        return;
      }

      setTripHistoryLoading(true);
      try {
        const performance = await fetchDriverPerformance(
          driver.id,
          user.id,
          period,
        );
        setTripHistory(performance.history);
        setDriverMetrics(performance.metrics);
      } catch {
        toast("danger", "Erro ao carregar métricas do motorista.");
      } finally {
        setTripHistoryLoading(false);
      }
    },
    [toast],
  );

  async function handleOpenTripHistory(driver: DriverWithVehicle) {
    const name = driver.provider_profiles?.users?.full_name ?? "Motorista";
    setHistoryDriverName(name);
    setHistoryDriver(driver);
    setHistoryPeriod("month");
    setDriverMetrics(emptyDriverMetrics);
    setTripHistory([]);
    await loadDriverPerformance(driver, "month");
  }

  async function handleChangeHistoryPeriod(period: DriverMetricPeriod) {
    if (!historyDriver) return;
    setHistoryPeriod(period);
    await loadDriverPerformance(historyDriver, period);
  }

  async function handleDeleteDriverPhoto(photoId: string) {
    if (!window.confirm("Remover esta foto do perfil do motorista?")) return;
    setDeletingPhotoId(photoId);
    try {
      await deleteDriverProfilePhoto(photoId);
      toast("success", "Foto removida com sucesso.");
      setPreviewDriver((current) =>
        current
          ? {
              ...current,
              driver_profile_photos: current.driver_profile_photos?.filter(
                (photo) => photo.id !== photoId,
              ),
            }
          : current,
      );
      await loadDrivers();
    } catch {
      toast("danger", "Erro ao remover foto do motorista.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function handleDeleteVehiclePhoto(photoId: string) {
    if (!window.confirm("Remover esta foto do veículo?")) return;
    setDeletingPhotoId(photoId);
    try {
      await deleteVehiclePhoto(photoId);
      toast("success", "Foto removida com sucesso.");
      setPreviewDriver((current) =>
        current
          ? {
              ...current,
              vehicle: current.vehicle
                ? {
                    ...current.vehicle,
                    vehicle_photos: current.vehicle.vehicle_photos?.filter(
                      (photo) => photo.id !== photoId,
                    ),
                  }
                : current.vehicle,
            }
          : current,
      );
      await loadDrivers();
    } catch {
      toast("danger", "Erro ao remover foto do veículo.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  const filtered = drivers.filter((d) => {
    const name = d.provider_profiles?.users?.full_name ?? "";
    const phone = d.provider_profiles?.users?.phone ?? "";
    const q = search.toLowerCase();
    const matchSearch =
      name.toLowerCase().includes(q) || phone.toLowerCase().includes(q);
    const status = d.provider_profiles?.status ?? "";
    const matchStatus = statusFilter ? status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-black text-dark">
            Motoristas
          </h1>
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
            const name =
              driver.provider_profiles?.users?.full_name ?? "Sem nome";
            const phone = driver.provider_profiles?.users?.phone ?? "—";
            const status = (driver.provider_profiles?.status ??
              "pending") as ProviderStatus;
            const userId = driver.provider_profiles?.users?.id;

            return (
              <div
                key={driver.id}
                className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary transition-colors"
              >
                <div className="flex-shrink-0">
                  <DriverAvatar
                    name={name}
                    avatarUrl={driver.provider_profiles?.users?.avatar_url}
                    onClick={() => setPreviewDriver(driver)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleOpenTripHistory(driver)}
                    className="block max-w-full font-semibold text-dark text-sm truncate hover:text-primary transition-colors cursor-pointer"
                    title="Histórico de corridas"
                  >
                    {name}
                  </button>
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
                  onClick={() => setPreviewDriver(driver)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-dark hover:bg-surface-hover transition-colors"
                  aria-label={`Preview do perfil de ${name}`}
                  title="Preview do perfil"
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
                      d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                    />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
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
                  const name =
                    driver.provider_profiles?.users?.full_name ?? "Sem nome";
                  const phone = driver.provider_profiles?.users?.phone ?? "—";
                  const status = (driver.provider_profiles?.status ??
                    "pending") as ProviderStatus;
                  const rating = driver.provider_profiles?.average_rating ?? 0;
                  const userId = driver.provider_profiles?.users?.id;

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <DriverAvatar
                            name={name}
                            avatarUrl={driver.provider_profiles?.users?.avatar_url}
                            size="sm"
                            onClick={() => setPreviewDriver(driver)}
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenTripHistory(driver)}
                            className="text-left text-sm font-medium text-dark hover:text-primary transition-colors cursor-pointer"
                            title="Histórico de corridas"
                          >
                            {name}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-contrast">
                        {phone}
                      </td>
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
                        {driver.cnh_category
                          ? `Cat. ${driver.cnh_category}`
                          : "—"}
                        {driver.cnh_expiration_date
                          ? ` • Venc. ${formatDate(driver.cnh_expiration_date)}`
                          : ""}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            driver.is_available
                              ? "text-success"
                              : "text-contrast/50"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              driver.is_available
                                ? "bg-success"
                                : "bg-contrast/30"
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
                          onClick={() => setPreviewDriver(driver)}
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
                              d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                            />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Perfil
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
                          {deletingUserId === userId
                            ? "Excluindo..."
                            : "Excluir"}
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

      {previewDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-center gap-4">
                <DriverAvatar
                  name={
                    previewDriver.provider_profiles?.users?.full_name ??
                    "Motorista"
                  }
                  avatarUrl={
                    previewDriver.provider_profiles?.users?.avatar_url
                  }
                  size="lg"
                />
                <div>
                  <h2 className="text-lg font-heading font-bold text-dark">
                    {previewDriver.provider_profiles?.users?.full_name ??
                      "Motorista"}
                  </h2>
                  <p className="mt-1 text-sm text-contrast">
                    {previewDriver.provider_profiles?.average_rating
                      ? `Avaliação ${Number(
                          previewDriver.provider_profiles.average_rating,
                        ).toFixed(1)}`
                      : "Sem avaliações"}
                    {" • "}
                    {previewDriver.is_available ? "Online" : "Offline"}
                  </p>
                  <p className="mt-1 text-xs text-contrast">
                    {previewDriver.vehicle
                      ? `${previewDriver.vehicle.brand} ${previewDriver.vehicle.model} ${previewDriver.vehicle.year} • ${previewDriver.vehicle.color} • ${previewDriver.vehicle.license_plate}`
                      : "Veículo não cadastrado"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDriver(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-dark hover:bg-surface-hover"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[72vh] space-y-6 overflow-y-auto p-5">
              <PreviewPhotoGrid
                title="Fotos públicas do motorista"
                photos={[...(previewDriver.driver_profile_photos ?? [])].sort(
                  (a, b) => a.sort_order - b.sort_order,
                )}
                emptyText="Nenhuma foto pública enviada."
                deletingPhotoId={deletingPhotoId}
                onOpen={setLightboxPhoto}
                onDelete={handleDeleteDriverPhoto}
              />
              <PreviewPhotoGrid
                title="Fotos do veículo"
                photos={
                  (previewDriver.vehicle?.vehicle_photos ??
                    []) as VehiclePhoto[]
                }
                emptyText="Nenhuma foto do veículo enviada."
                deletingPhotoId={deletingPhotoId}
                onOpen={setLightboxPhoto}
                onDelete={handleDeleteVehiclePhoto}
              />
            </div>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute right-4 top-4 rounded-lg bg-white px-3 py-2 text-sm font-medium text-dark"
          >
            Fechar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto}
            alt="Foto ampliada"
            className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain"
          />
        </div>
      )}

      {ratingsDriverName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-dark">
                  Avaliações de {ratingsDriverName}
                </h2>
                <p className="mt-1 text-xs text-contrast">
                  Avaliações negativas são anônimas e serão analisadas pela
                  equipe KZ.
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
                <p className="text-sm text-contrast">
                  Carregando avaliações...
                </p>
              ) : ratings.length === 0 ? (
                <p className="text-sm text-contrast">
                  Nenhuma avaliação encontrada.
                </p>
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
                            {new Date(item.created_at).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-contrast">
                          {publicRating
                            ? `Avaliador: ${item.rater?.full_name ?? item.rater?.email ?? "Cliente"}`
                            : "Avaliador: anônimo para avaliação negativa"}
                        </p>
                        {item.comment && (
                          <p className="mt-2 text-sm text-dark">
                            {item.comment}
                          </p>
                        )}
                        {!publicRating && (
                          <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                            Comentário restrito ao painel admin para análise da
                            equipe KZ.
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

      {historyDriverName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-dark">
                  Histórico de corridas de {historyDriverName}
                </h2>
                <p className="mt-1 text-xs text-contrast">
                  Corridas finalizadas, detalhes da viagem e avaliações
                  registradas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryDriverName(null);
                  setHistoryDriver(null);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-dark hover:bg-surface-hover"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-5">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {(Object.keys(metricPeriodLabels) as DriverMetricPeriod[]).map(
                  (period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handleChangeHistoryPeriod(period)}
                      className={`rounded-lg px-3 py-2 text-xs font-heading font-bold transition-colors ${
                        historyPeriod === period
                          ? "bg-primary text-background"
                          : "border border-border bg-surface text-dark hover:bg-surface-hover"
                      }`}
                    >
                      {metricPeriodLabels[period]}
                    </button>
                  ),
                )}
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-contrast">Finalizadas</p>
                  <p className="mt-1 text-2xl font-heading font-black text-dark">
                    {driverMetrics.finishedTrips}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-contrast">Canceladas</p>
                  <p className="mt-1 text-2xl font-heading font-black text-dark">
                    {driverMetrics.cancelledTrips}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-contrast">Recusadas</p>
                  <p className="mt-1 text-2xl font-heading font-black text-dark">
                    {driverMetrics.refusedTrips}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-contrast">Média</p>
                  <p className="mt-1 text-2xl font-heading font-black text-dark">
                    {driverMetrics.averageRating > 0
                      ? driverMetrics.averageRating.toFixed(1)
                      : "—"}
                  </p>
                </div>
              </div>

              {tripHistoryLoading ? (
                <p className="text-sm text-contrast">Carregando histórico...</p>
              ) : tripHistory.length === 0 ? (
                <p className="text-sm text-contrast">
                  Nenhuma corrida encontrada para este período.
                </p>
              ) : (
                <div className="space-y-3">
                  {tripHistory.map(({ trip, ratings: tripRatings }) => {
                    const price = trip.final_price ?? trip.estimated_price;
                    return (
                      <div
                        key={trip.id}
                        className="rounded-xl border border-border bg-surface p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-heading font-bold text-dark">
                              {trip.users?.full_name ?? "Cliente"}
                            </p>
                            <p className="mt-1 text-xs text-contrast">
                              Finalizada em{" "}
                              {formatDateTime(
                                trip.finished_at ?? trip.scheduled_datetime,
                              )}
                            </p>
                          </div>
                          <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-heading font-bold text-success">
                            {formatCurrency(price)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                          <p className="text-contrast">
                            Origem:{" "}
                            <span className="text-dark">
                              {trip.pickup_address?.formatted_address ?? "—"}
                            </span>
                          </p>
                          <p className="text-contrast">
                            Destino:{" "}
                            <span className="text-dark">
                              {trip.dropoff_address?.formatted_address ?? "—"}
                            </span>
                          </p>
                          <p className="text-contrast">
                            Passageiros:{" "}
                            <span className="text-dark">
                              {trip.passenger_count}
                            </span>
                          </p>
                          <p className="text-contrast">
                            Pagamento:{" "}
                            <span className="text-dark">
                              {trip.payment_method ?? "—"}
                            </span>
                          </p>
                        </div>

                        <div className="mt-4 border-t border-border pt-3">
                          {tripRatings.length === 0 ? (
                            <p className="text-xs text-contrast">
                              Sem avaliações registradas nessa corrida.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {tripRatings.map((rating) => (
                                <div
                                  key={rating.id}
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                >
                                  <p className="text-xs font-heading font-bold text-dark">
                                    Nota {Number(rating.rating).toFixed(1)}
                                    <span className="ml-2 font-body font-normal text-contrast">
                                      {rating.rater?.full_name ?? "Usuário"}{" "}
                                      avaliou{" "}
                                      {rating.rated?.full_name ?? "usuário"}
                                    </span>
                                  </p>
                                  {rating.comment && (
                                    <p className="mt-1 text-sm text-dark">
                                      {rating.comment}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
