"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAdminNotification,
  deleteAllAdminNotifications,
  fetchAdminNotifications,
  fetchTrips,
} from "@/lib/api";
import { buildAdminNotificationHref } from "@/lib/admin-notification-navigation";
import { useAuth } from "@/lib/auth-context";
import { formatBrazilDateTime } from "@/lib/brazil-time";
import { labelForTripStatus } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import type { Notification as AdminNotification, Trip } from "@/types/database";

function formatNotificationTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortenAddress(address?: string | null) {
  if (!address) return "Endereco nao informado";
  return address.split(",")[0]?.trim() || address;
}

export default function AdminNotificationsButton() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [tripDetails, setTripDetails] = useState<Record<string, Trip>>({});
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [clearingNotifications, setClearingNotifications] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  const loadTripDetails = useCallback(async (items: AdminNotification[]) => {
    const tripIds = new Set(
      items
        .filter(
          (item) => item.reference_type === "trip" && Boolean(item.reference_id),
        )
        .map((item) => item.reference_id as string),
    );

    if (tripIds.size === 0) return;

    try {
      const trips = await fetchTrips();
      setTripDetails((current) => {
        const next = { ...current };
        trips
          .filter((trip) => tripIds.has(trip.id))
          .forEach((trip) => {
            next[trip.id] = trip;
          });
        return next;
      });
    } catch (error) {
      console.error("Erro ao carregar detalhes das corridas:", error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (userProfile?.role !== "admin") return;
    setLoadingNotifications(true);
    try {
      const items = await fetchAdminNotifications();
      setNotifications(items);
      void loadTripDetails(items);
    } catch (error) {
      console.error("Erro ao carregar notificações admin:", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, [loadTripDetails, userProfile?.role]);

  useEffect(() => {
    if (!loading) void loadNotifications();
  }, [loadNotifications, loading]);

  useEffect(() => {
    if (userProfile?.role !== "admin" || !userProfile.id) return;
    const channel = supabase
      .channel(`admin-notifications-${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          const next = payload.new as AdminNotification;
          setNotifications((current) => [next, ...current].slice(0, 20));
          void loadTripDetails([next]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTripDetails, userProfile?.id, userProfile?.role]);

  async function handleOpenNotification(item: AdminNotification) {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== item.id),
    );
    try {
      await deleteAdminNotification(item.id);
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
    }

    const href = buildAdminNotificationHref(item);
    if (href) {
      router.push(href);
      setOpen(false);
    }
  }

  async function handleDeleteNotification(item: AdminNotification) {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== item.id),
    );
    try {
      await deleteAdminNotification(item.id);
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      void loadNotifications();
    }
  }

  async function handleClearAll() {
    setClearingNotifications(true);
    const previous = notifications;
    setNotifications([]);
    setTripDetails({});
    try {
      await deleteAllAdminNotifications();
    } catch (error) {
      console.error("Erro ao limpar notificações:", error);
      setNotifications(previous);
    } finally {
      setClearingNotifications(false);
    }
  }

  if (loading || userProfile?.role !== "admin") return null;

  return (
    <div className="fixed bottom-20 right-24 z-40 md:bottom-8 md:right-28">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-dark shadow-lg transition-colors hover:bg-surface-hover"
        aria-label="Abrir notificações do admin"
        aria-expanded={open}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a2.25 2.25 0 0 1-4.714 0M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-36 w-auto overflow-hidden rounded-xl border border-border bg-background shadow-xl md:absolute md:bottom-full md:right-0 md:inset-x-auto md:mb-3 md:w-[min(400px,calc(100vw-2rem))]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-sm font-heading font-bold text-dark">
              Notificações
            </h2>
            <div className="flex items-center gap-3">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={clearingNotifications}
                  className="text-xs font-medium text-danger hover:opacity-80 disabled:opacity-50"
                >
                  Limpar todas
                </button>
              )}
              <button
                type="button"
                onClick={loadNotifications}
                className="text-xs font-medium text-primary hover:text-primary-dark"
              >
                Atualizar
              </button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loadingNotifications ? (
              <p className="px-4 py-6 text-sm text-contrast">
                Carregando notificações...
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-contrast">
                Nenhuma atualização recente.
              </p>
            ) : (
              notifications.map((item) => {
                const trip =
                  item.reference_type === "trip" && item.reference_id
                    ? tripDetails[item.reference_id]
                    : null;

                return (
                  <div
                    key={item.id}
                    className={`relative border-b border-border transition-colors last:border-b-0 hover:bg-surface-hover ${
                      item.is_read ? "bg-background" : "bg-primary/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(item)}
                      className="block w-full px-4 py-3 pr-11 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-heading font-bold text-dark">
                          {item.title}
                        </p>
                        {!item.is_read && (
                          <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-contrast">
                        {item.body}
                      </p>
                      {trip && (
                        <div className="mt-3 rounded-md border border-danger/30 bg-danger/5 p-2 text-xs leading-5 text-dark">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-bold text-danger">
                              Corrida em atenção
                            </span>
                            <span className="text-contrast">
                              {labelForTripStatus(trip.status)}
                            </span>
                          </div>
                          <p className="mt-1 font-medium">
                            {shortenAddress(trip.pickup_address?.formatted_address)} →{" "}
                            {shortenAddress(trip.dropoff_address?.formatted_address)}
                          </p>
                          <p className="mt-1 text-contrast">
                            {trip.users?.full_name ?? "Cliente nao identificado"} ·{" "}
                            {formatBrazilDateTime(trip.scheduled_datetime)}
                          </p>
                        </div>
                      )}
                      <p className="mt-2 text-[11px] text-contrast/70">
                        {formatNotificationTime(item.created_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(item)}
                      className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-contrast transition-colors hover:bg-background hover:text-danger"
                      aria-label="Excluir notificação"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
