"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { useAuth } from "@/lib/auth-context";

const ONESIGNAL_APP_ID = "ff1d0837-34b0-4cd1-8a8f-a0f82d8c747d";

let oneSignalInitPromise: Promise<typeof OneSignal> | null = null;

function initOneSignal() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!oneSignalInitPromise) {
    oneSignalInitPromise = OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      autoResubscribe: true,
      notificationClickHandlerMatch: "origin",
      notificationClickHandlerAction: "focus",
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/onesignal/" },
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
                actionMessage: "Receba alertas do painel admin neste navegador.",
                acceptButton: "Permitir",
                cancelButton: "Agora nao",
              },
            },
          ],
        },
      },
    })
      .then(() => OneSignal)
      .catch((error) => {
        oneSignalInitPromise = null;
        throw error;
      });
  }

  return oneSignalInitPromise;
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
