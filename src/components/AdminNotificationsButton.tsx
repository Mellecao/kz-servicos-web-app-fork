"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAdminNotifications,
  markNotificationRead,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { Notification as AdminNotification } from "@/types/database";

function formatNotificationTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminNotificationsButton() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    if (userProfile?.role !== "admin") return;
    setLoadingNotifications(true);
    try {
      setNotifications(await fetchAdminNotifications());
    } catch (error) {
      console.error("Erro ao carregar notificações admin:", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, [userProfile?.role]);

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
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userProfile?.id, userProfile?.role]);

  async function handleOpenNotification(item: AdminNotification) {
    if (!item.is_read) {
      await markNotificationRead(item.id);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? {
                ...notification,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : notification,
        ),
      );
    }
    if (item.link) {
      router.push(item.link);
      setOpen(false);
    }
  }

  if (loading || userProfile?.role !== "admin") return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-8 md:right-8">
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
        <div className="absolute bottom-full right-0 mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-heading font-bold text-dark">
              Notificações
            </h2>
            <button
              type="button"
              onClick={loadNotifications}
              className="text-xs font-medium text-primary hover:text-primary-dark"
            >
              Atualizar
            </button>
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
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenNotification(item)}
                  className={`block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-hover ${
                    item.is_read ? "bg-background" : "bg-primary/5"
                  }`}
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
                  <p className="mt-2 text-[11px] text-contrast/70">
                    {formatNotificationTime(item.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
