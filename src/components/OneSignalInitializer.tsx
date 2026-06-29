"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const ONESIGNAL_APP_ID = "ff1d0837-34b0-4cd1-8a8f-a0f82d8c747d";
const ONESIGNAL_SAFARI_WEB_ID =
  "web.onesignal.auto.34f3144b-3497-4c5c-a43c-a5d9eb9bdd56";

type OneSignalSDK = {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void> | void;
  logout: () => Promise<void> | void;
  Slidedown?: {
    promptPush?: () => Promise<void> | void;
  };
  Notifications?: {
    requestPermission?: () => Promise<boolean> | boolean;
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<
      (oneSignal: OneSignalSDK) => Promise<void> | void
    >;
  }
}

let oneSignalInitPromise: Promise<OneSignalSDK | null> | null = null;

export function initOneSignal() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!oneSignalInitPromise) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    oneSignalInitPromise = new Promise((resolve, reject) => {
      window.OneSignalDeferred?.push(async (OneSignal) => {
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: ONESIGNAL_SAFARI_WEB_ID,
            allowLocalhostAsSecureOrigin: true,
            autoResubscribe: true,
            notificationClickHandlerMatch: "origin",
            notificationClickHandlerAction: "focus",
            notifyButton: {
              enable: true,
            },
            welcomeNotification: {
              disable: true,
              message: "",
            },
            promptOptions: {
              slidedown: {
                prompts: [
                  {
                    type: "push",
                    autoPrompt: true,
                    delay: {
                      pageViews: 1,
                      timeDelay: 3,
                    },
                    text: {
                      actionMessage:
                        "Receba alertas do painel admin neste navegador.",
                      acceptButton: "Permitir",
                      cancelButton: "Agora nao",
                    },
                  },
                ],
              },
            },
          });
          resolve(OneSignal);
        } catch (error) {
          oneSignalInitPromise = null;
          reject(error);
        }
      });
    });
  }

  return oneSignalInitPromise;
}

export async function promptOneSignalPushPermission() {
  const oneSignal = await initOneSignal();
  if (!oneSignal) return;

  if (oneSignal.Notifications?.requestPermission) {
    await oneSignal.Notifications.requestPermission();
    return;
  }

  await oneSignal.Slidedown?.promptPush?.();
}

export default function OneSignalInitializer() {
  const { loading, session } = useAuth();

  useEffect(() => {
    void initOneSignal().catch((error) => {
      console.error("Erro ao inicializar OneSignal:", error);
    });
  }, []);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    void initOneSignal()
      .then(async (oneSignal) => {
        if (!oneSignal || cancelled) return;

        const userId = session?.user.id;
        if (userId) {
          await oneSignal.login(userId);
        } else {
          await oneSignal.logout();
        }
      })
      .catch((error) => {
        console.error("Erro ao sincronizar usuario OneSignal:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, session?.user.id]);

  return null;
}
