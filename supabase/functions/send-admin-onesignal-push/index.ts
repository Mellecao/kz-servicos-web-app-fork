interface AdminNotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  link?: string | null;
}

interface RequestPayload {
  table?: string;
  event?: string;
  new_record?: AdminNotificationRecord;
}

// keep in sync with src/lib/admin-notification-navigation.ts
function buildAdminNotificationHref(
  notification: Pick<AdminNotificationRecord, "link" | "reference_type" | "reference_id">,
): string | null {
  if (
    notification.link === "/viagens" &&
    notification.reference_type === "trip" &&
    notification.reference_id
  ) {
    return `/viagens?openTrip=${encodeURIComponent(notification.reference_id)}`;
  }
  return notification.link ?? null;
}

class SupabaseRestClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
  ) {}

  async markPushed(notificationId: string) {
    const url = new URL(`${this.baseUrl}/rest/v1/notifications`);
    url.searchParams.set("id", `eq.${notificationId}`);

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        is_pushed: true,
        pushed_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expectedWebhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
  const providedWebhookSecret = req.headers.get("X-Push-Webhook-Secret") ?? "";
  if (!expectedWebhookSecret || providedWebhookSecret !== expectedWebhookSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const notification = payload.new_record;
  if (
    payload.table !== "notifications" ||
    payload.event !== "INSERT" ||
    !notification?.id ||
    !notification.user_id ||
    !notification.title ||
    !notification.body
  ) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!notification.type?.startsWith("admin_")) {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const oneSignalRestApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
  const oneSignalAppId =
    Deno.env.get("ONESIGNAL_APP_ID") ??
    "ff1d0837-34b0-4cd1-8a8f-a0f82d8c747d";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!oneSignalRestApiKey || !oneSignalAppId || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing environment variables" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${oneSignalRestApiKey}`,
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      include_aliases: { external_id: [notification.user_id] },
      target_channel: "push",
      headings: { pt: notification.title, en: notification.title },
      contents: { pt: notification.body, en: notification.body },
      url: buildAdminNotificationHref(notification) ?? undefined,
      data: {
        notification_id: notification.id,
        reference_type: notification.reference_type,
        reference_id: notification.reference_id,
        type: notification.type,
      },
    }),
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: "OneSignal send failed",
        details: await response.text(),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const supabase = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
  await supabase.markPushed(notification.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
