"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMobilePushPlatform,
  getNotificationSettingsHref,
  isMobileUserAgent,
} from "@/lib/push-permission-guidance";
import { promptOneSignalPushPermission } from "@/components/OneSignalInitializer";

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
  const [message, setMessage] = useState<string | null>(null);

  const userAgent =
    typeof window === "undefined" ? "" : window.navigator.userAgent;

  const isMobile = useMemo(() => isMobileUserAgent(userAgent), [userAgent]);
  const platform = useMemo(() => getMobilePushPlatform(userAgent), [userAgent]);
  const settingsHref = useMemo(
    () => getNotificationSettingsHref(userAgent),
    [userAgent],
  );

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)));

  useEffect(() => {
    void Promise.resolve().then(() => {
      setDismissed(false);
      setPermission(getBrowserPermission());
    });
  }, []);

  const refreshPermission = useCallback(() => {
    setPermission(getBrowserPermission());
  }, []);

  async function handlePrompt() {
    setMessage(null);

    if (platform === "ios" && !isStandalone) {
      setMessage(
        "No iPhone, instale o painel na Tela de Inicio: toque em Compartilhar e depois em Adicionar a Tela de Inicio. Abra pelo icone instalado e toque em Permitir notificacoes.",
      );
      return;
    }

    try {
      await promptOneSignalPushPermission();
      refreshPermission();
      setMessage(
        getBrowserPermission() === "granted"
          ? "Notificacoes ativadas neste dispositivo."
          : "Se o aviso nao apareceu, confirme se este site pode enviar notificacoes nas configuracoes do navegador.",
      );
    } catch (error) {
      console.error("Erro ao solicitar permissao de push:", error);
      setMessage(
        platform === "ios"
          ? "No iPhone, abra o painel pelo icone instalado na Tela de Inicio e tente novamente."
          : "Nao foi possivel abrir a permissao. Verifique as configuracoes de notificacao do navegador.",
      );
    }
  }

  function handleDismiss() {
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
          {platform === "ios" && !isStandalone && (
            <p className="mt-2 text-xs leading-5 text-warning">
              No iPhone, notificações web só funcionam depois de adicionar o
              painel à Tela de Início e abrir pelo ícone instalado.
            </p>
          )}
          {permission === "denied" && (
            <p className="mt-2 text-xs leading-5 text-danger">
              A permissão está bloqueada. Abra as configurações do navegador ou
              do app e libere notificações para este site.
            </p>
          )}
          {message && (
            <p className="mt-2 text-xs leading-5 text-contrast">{message}</p>
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
          {platform === "ios" && !isStandalone
            ? "Ver como ativar"
            : "Permitir notificações"}
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
