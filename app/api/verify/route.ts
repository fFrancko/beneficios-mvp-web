// app/api/verify/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const t = url.searchParams.get("t");
    if (!t) {
      return NextResponse.json({ error: "missing_token", message: "Falta parámetro ?t=" }, { status: 400 });
    }

    // 1) Verificar JWT
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    let sub: string | undefined;
    let tokenExp: number | undefined;

    try {
      const { payload } = await jose.jwtVerify(t, secret);
      sub = payload.sub as string | undefined;
      tokenExp = typeof payload.exp === "number" ? payload.exp : undefined;
    } catch {
      return NextResponse.json({ result: "invalid_token" }, { status: 200 });
    }

    if (!sub || !isUUID(sub)) {
      return NextResponse.json({ result: "invalid_token_sub" }, { status: 200 });
    }

    // 2) Supabase (service role)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3) Leer membresía
    const { data: membership, error: memErr } = await admin
      .from("memberships")
      .select("status, valid_until, user_id")
      .eq("user_id", sub)
      .maybeSingle();

    // Si la tabla no existe aún, devolvemos estado controlado
    if (memErr && (memErr as any).code === "42P01") {
      return NextResponse.json({
        result: "expired",
        member: { id: sub, full_name: null },
        membership: { status: "unknown", valid_until: null },
        token: { expires_at: tokenExp ? new Date(tokenExp * 1000).toISOString() : null },
        now_iso: new Date().toISOString(),
        note: "Tabla 'memberships' no creada todavía",
      });
    }
    if (memErr) throw memErr;

    // 4) Leer perfil (nombre)
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", sub)
      .maybeSingle();

    if (profErr && (profErr as any).code !== "42P01") throw profErr;

    // 5) Determinar estado (activo/expirado)
    const now = new Date();
    const validUntil = membership?.valid_until ? new Date(membership.valid_until) : null;

    const isActive =
      membership &&
      membership.status === "active" &&
      validUntil &&
      validUntil > now;

    const result = isActive ? "active" : "expired";

    // 6) Registrar verificación (no bloqueante si falla)
    try {
      await admin.from("verifications").insert({
        member_id: sub,
        result,
        verifier_ip: (req.headers.get("x-forwarded-for") || "").split(",")[0],
        user_agent: req.headers.get("user-agent") || "",
      });
    } catch {
      // ignoramos errores de logging
    }

    // 7) Respuesta enriquecida
    return NextResponse.json({
      result, // "active" | "expired" | "invalid_token" | ...
      member: {
        id: sub,
        full_name: profile?.full_name ?? null,
      },
      membership: {
        status: membership?.status ?? "unknown",
        valid_until: membership?.valid_until ?? null,
      },
      token: {
        expires_at: tokenExp ? new Date(tokenExp * 1000).toISOString() : null,
      },
      now_iso: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server_error", message: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
