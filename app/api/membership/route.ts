import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function isUUID(v: string) {
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

// GET /api/membership?user=<uuid>
// (versión de prueba: luego lo cambiamos a usuario logueado)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get("user");

  if (!user || !isUUID(user)) {
    return NextResponse.json({ error: "Falta ?user=<UUID> válido" }, { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("memberships")
      .select("status, valid_until, last_payment_at")
      .eq("user_id", user)
      .maybeSingle();

    // Si la tabla todavía no existe, igual confirmamos que hay conexión
    if (error) {
      if ((error as any).code === "42P01") {
        return NextResponse.json({
          status: "past_due",
          valid_until: null,
          note: "Tabla 'memberships' no creada todavía",
        });
      }
      throw error;
    }

    if (!data) {
      // Sin registro: devolvemos un estado por defecto amigable
      return NextResponse.json({
        status: "past_due",
        valid_until: null,
        note: "Sin membresía cargada para ese usuario",
      });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
