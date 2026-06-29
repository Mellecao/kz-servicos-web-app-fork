"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getNotificationSettingsHref,
  isMobileUserAgent,
} from "@/lib/push-permission-guidance";
import { promptOneSignalPushPermission } from "@/components/OneSignalInitializer";

const DISMISSED_KEY = "kz-admin-mobile-push-guide-dismissed";

function getBrowserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export default function MobilePushPermissionGuide() {
  const { loading, userProfile } = useAuth();
  const [permission, setPermission] = useState(getBrowserPermission);
  const [dismissed, setDismissed] = useState(true);

  const userAgent =
    typeof window === "undefined" ? "" : window.navigator.userAgent;

  const isMobile = useMemo(() => isMobileUserAgent(userAgent), [userAgent]);
  const settingsHref = useMemo(
    () => getNotificationSettingsHref(userAgent),
    [userAgent],
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
      setPermission(getBrowserPermission());
    });
  }, []);

  const refreshPermission = useCallback(() => {
    setPermission(getBrowserPermission());
  }, []);

  async function handlePrompt() {
    await promptOneSignalPushPermission();
    refreshPermission();
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  if (
    loading ||
    userProfile?.role !== "admin" ||
    !isMobile ||
    dismissed ||
    permission === "granted"
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 rounded-lg border border-primary/30 bg-background p-4 text-sm text-dark shadow-xl md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading font-bold">Ative as notificações</p>
          <p className="mt-1 leading-5 text-contrast">
            Permita notificações deste painel no celular para receber alertas
            quando uma corrida precisar de ação do admin.
          </p>
          {permission === "denied" && (
            <p className="mt-2 text-xs leading-5 text-danger">
              A permissão está bloqueada. Abra as configurações do navegador ou
              do app e libere notificações para este site.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-full px-2 py-1 text-xs text-contrast hover:bg-surface-hover"
          aria-label="Fechar aviso de notificações"
        >
          X
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePrompt}
          className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark"
        >
          Permitir notificações
        </button>
        {settingsHref && (
          <a
            href={settingsHref}
            onClick={refreshPermission}
            className="rounded-md border border-border px-3 py-2 text-xs font-bold text-dark hover:bg-surface-hover"
          >
            Abrir configurações
          </a>
        )}
      </div>
    </div>
  );
}
