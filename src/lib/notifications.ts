// Browser Notification helpers for the admin panel.

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: title,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignored — browsers can throw if invoked from a non-user gesture / SW
  }
}

const tripStatusLabels: Record<string, string> = {
  open: "Aberta",
  under_review: "Em análise",
  review_rejected: "Análise rejeitada",
  searching_drivers: "Buscando motorista",
  awaiting_client_confirmation: "Aguardando cliente",
  awaiting_driver_confirmation: "Aguardando validação do motorista",
  scheduled: "Agendada",
  started: "Em andamento",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

export function labelForTripStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return tripStatusLabels[status] ?? status;
}
