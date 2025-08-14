import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin"; // ojo: 5 niveles

const BodySchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().optional(),       // Opcional: cambiar el correo a uno tuyo
  password: z.string().min(6).max(72).optional(), // Opcional: setear nueva contraseña
  confirm_email: z.boolean().optional(),      // default: true -> deja el email como “confirmado”
});

export async function POST(req: NextRequest) {
  try {
    // Seguridad: header con token interno
    const internal = req.headers.get("x-internal-token");
    const expected = process.env.ADMIN_INTERNAL_TOKEN;
    if (!expected || internal !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const body = BodySchema.parse(json);

    if (!body.email && !body.password) {
      return NextResponse.json(
        { ok: false, error: "Nada para actualizar: proveé email y/o password" },
        { status: 400 }
      );
    }

    const attrs: Record<string, any> = {};
    if (body.email) attrs.email = body.email;
    if (body.password) attrs.password = body.password;

    // Por defecto marcamos el email como confirmado (evita bloqueo por confirmación)
    const confirm = body.confirm_email ?? true;
    if (confirm) attrs.email_confirm = true;

    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.admin.updateUserById(body.user_id, attrs);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      user: { id: data.user?.id, email: data.user?.email },
      note: confirm ? "email_confirm=true aplicado" : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unexpected" }, { status: 500 });
  }
}
