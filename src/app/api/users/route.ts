import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const INVITE_WEBHOOK_URL =
  "https://black-elephant.app.n8n.cloud/webhook/kz-new-customer-invite";

function generateTemporaryPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { full_name, email, password, phone, cpf, role, date_of_birth } = body;

    if (!full_name || !email || !role) {
      return NextResponse.json(
        { error: "Campos obrigatórios: full_name, email, role" },
        { status: 400 }
      );
    }

    if (password !== undefined && typeof password !== "string") {
      return NextResponse.json(
        { error: "A senha deve ser um texto" },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    if (role === "client" && !password) {
      return NextResponse.json(
        { error: "Clientes exigem senha" },
        { status: 400 }
      );
    }

    const senha_temporaria = password || generateTemporaryPassword();
    const hasCustomPassword = Boolean(password);

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha_temporaria,
        email_confirm: true,
        user_metadata: { full_name, password_temporary: !hasCustomPassword },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // 2. Upsert profile into public.users.
    // The auth.users trigger may already have created this row.
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert({
        id: authData.user.id,
        full_name,
        email,
        phone: phone || null,
        cpf: cpf || null,
        role,
        date_of_birth: date_of_birth || null,
        is_active: true,
      }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      // Rollback: delete auth user if public.users insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Send invite email only when the system generated a temporary password.
    if (!hasCustomPassword) {
      fetch(INVITE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: full_name, email, senha_temporaria }),
      }).catch(() => {});
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
