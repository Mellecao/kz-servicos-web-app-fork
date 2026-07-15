import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildAdminNotificationHref } from "@/lib/admin-notification-navigation";

const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID ?? "ff1d0837-34b0-4cd1-8a8f-a0f82d8c747d";

type RequestBody = {
  notificationId?: unknown;
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const notificationId =
    typeof body.notificationId === "string" ? body.notificationId : null;
  if (!notificationId) {
    return NextResponse.json(
      { error: "notificationId é obrigatório" },
      { status: 400 },
    );
  }

  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .single();
  if (notificationError || !notification) {
    return NextResponse.json(
      { error: "Notificação não encontrada" },
      { status: 404 },
    );
  }

  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { skipped: true, reason: "ONESIGNAL_REST_API_KEY não configurada" },
      { status: 202 },
    );
  }

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [user.id] },
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
    const details = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "Erro ao enviar OneSignal", details },
      { status: 502 },
    );
  }

  await admin
    .from("notifications")
    .update({ is_pushed: true, pushed_at: new Date().toISOString() })
    .eq("id", notification.id);

  return NextResponse.json({ ok: true });
}
