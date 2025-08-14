// app/api/membership/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type MembershipRow = {
  status: "active" | "past_due" | "canceled" | "trialing" | string;
  valid_until: string | null; // ISO
  last_payment_at?: string | null; // ISO
};

function isUUID(v: string) {
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  );
}

function getBearerToken(req: Request): string | null {
  const h =
    (req.headers as any).get?.("authorization") ||
    (req.headers as any).get?.("Authorization");
  if (!h) return null;
  const [type, token] = String(h).split(" ");
  if (!type || type.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

// GET /api/membership
// Modos:
//   A) Seguro (recomendado): Header Authorization: Bearer <token>  -> usa RLS y toma el user del token
//   B) Compatible: ?user=<UUID> (para pruebas) -> usa supabaseAdmin()
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userParam = url.searchParams.get("user");
  const bearer = getBearerToken(req);

  // Si viene Bearer token usamos client con RLS (modo seguro)
  if (bearer) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if (!supabaseUrl || !anonKey) {
        return NextResponse.json(
          { error: "Faltan variables de entorno de Supabase" },
          { status: 500 }
        );
      }

      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });

      // Valida token y obtiene user.id
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !userData?.user) {
        return NextResponse.json(
          { error: "Token inválido o sesión expirada" },
          { status: 401 }
        );
      }
      const uid = userData.user.id;

      const { data, error } = await supabase
        .from("memberships")
        .select("status, valid_until, last_payment_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if ((error as any).code === "42P01") {
          return NextResponse.json({
            status: "past_due",
            valid_until: null,
            last_payment_at: null,
            derived: { result: "expired", now_iso: new Date().toISOString(), note: "Tabla 'memberships' no creada todavía" },
          });
        }
        throw error;
      }

      // Sin registro: estado amigable
      if (!data) {
        return NextResponse.json({
          status: "past_due",
          valid_until: null,
          last_payment_at: null,
          derived: { result: "expired", now_iso: new Date().toISOString(), note: "Sin membresía cargada" },
        });
      }

      // Derivar ACTIVE / EXPIRED por fecha y estado
      const now = new Date();
      let result: "active" | "expired" = "expired";
      let note: string | undefined;

      const v = data as MembershipRow;
      if (v.status === "active" && v.valid_until) {
        const vu = new Date(v.valid_until);
        result = vu.getTime() >= now.getTime() ? "active" : "expired";
        if (result === "expired") note = "Vencida por fecha";
      } else {
        note = `Estado actual: ${v.status}`;
      }

      return NextResponse.json({
        ...data,
        derived: { result, now_iso: now.toISOString(), ...(note ? { note } : {}) },
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Error inesperado" },
        { status: 500 }
      );
    }
  }

  // Modo compatible: ?user=<UUID> usando supabaseAdmin() (para pruebas)
  if (!userParam || !isUUID(userParam)) {
    return NextResponse.json(
      { error: "Falta Authorization: Bearer <token> o ?user=<UUID> válido" },
      { status: 400 }
    );
  }

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("memberships")
      .select("status, valid_until, last_payment_at")
      .eq("user_id", userParam)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if ((error as any).code === "42P01") {
        return NextResponse.json({
          status: "past_due",
          valid_until: null,
          last_payment_at: null,
          derived: { result: "expired", now_iso: new Date().toISOString(), note: "Tabla 'memberships' no creada todavía" },
        });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({
        status: "past_due",
        valid_until: null,
        last_payment_at: null,
        derived: { result: "expired", now_iso: new Date().toISOString(), note: "Sin membresía cargada para ese usuario" },
      });
    }

    // Derivar también en modo compatible
    const now = new Date();
    const v = data as MembershipRow;
    let result: "active" | "expired" = "expired";
    let note: string | undefined;

    if (v.status === "active" && v.valid_until) {
      const vu = new Date(v.valid_until);
      result = vu.getTime() >= now.getTime() ? "active" : "expired";
      if (result === "expired") note = "Vencida por fecha";
    } else {
      note = `Estado actual: ${v.status}`;
    }

    return NextResponse.json({
      ...data,
      derived: { result, now_iso: now.toISOString(), ...(note ? { note } : {}) },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
