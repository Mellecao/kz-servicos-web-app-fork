import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UserPatchBody = {
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  cpf?: unknown;
  date_of_birth?: unknown;
  is_active?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID do usuário é obrigatório" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as UserPatchBody;
    const fullName = asRequiredString(body.full_name);
    const email = asRequiredString(body.email);

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Nome e e-mail são obrigatórios" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { data, error } = await admin
      .from("users")
      .update({
        full_name: fullName,
        email,
        phone: asNullableString(body.phone),
        cpf: asNullableString(body.cpf),
        date_of_birth: asNullableString(body.date_of_birth),
        is_active: typeof body.is_active === "boolean" ? body.is_active : true,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID do usuário é obrigatório" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function asRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
