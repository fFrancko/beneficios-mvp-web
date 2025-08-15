import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { supabaseAdmin } from "../../../lib/supabaseAdmin"; // sube 3 niveles

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const raw = q.get("token") || q.get("t"); // acepta ?token=... y ?t=...

    if (!raw) {
      return NextResponse.json(
        { ok: false, valid: false, reason: "missing_token" },
        { status: 400 }
      );
    }

    const now = new Date();

    // 1) Intentar validar como TOKEN EFÍMERO (tabla qr_tokens)
    //    Usamos service role para evitar RLS (público no autenticado)
    try {
      const sb = supabaseAdmin();
      const { data: row, error } = await sb
        .from("qr_tokens")
        .select("user_id, expires_at, revoked, used_at")
        .eq("token", raw)
        .maybeSingle();

      if (error && (error as any).code !== "42P01") throw error;

      if (row) {
        const expOk = new Date(row.expires_at).getTime() >= now.getTime();
        const notRevoked = row.revoked !== true;
        const notUsed = row.used_at == null; // si más adelante querés uso-único

        if (expOk && notRevoked && notUsed) {
          return NextResponse.json({
            ok: true,
            valid: true,
            kind: "db_token",
            user_id: row.user_id,
            expires_at: row.expires_at,
            now_iso: now.toISOString(),
          });
        } else {
          return NextResponse.json({
            ok: true,
            valid: false,
            kind: "db_token",
            user_id: row.user_id,
            expires_at: row.expires_at,
            reason: !expOk
              ? "expired"
              : !notRevoked
              ? "revoked"
              : "already_used",
            now_iso: now.toISOString(),
          });
        }
      }
    } catch (e) {
      // seguimos al paso 2 (JWT), pero si querés loguear, podés hacerlo aquí
    }

    // 2) Fallback: intentar como JWT legado (HS256 con subject=userId)
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const { payload } = await jose.jwtVerify(raw, new TextEncoder().encode(secret));
        const uid = String(payload.sub || "");
        if (!uid) {
          return NextResponse.json({
            ok: true,
            valid: false,
            kind: "jwt",
            reason: "missing_sub",
            now_iso: now.toISOString(),
          });
        }
        return NextResponse.json({
          ok: true,
          valid: true,
          kind: "jwt",
          user_id: uid,
          // Nota: el exp del JWT ya fue validado por jose.jwtVerify
          now_iso: now.toISOString(),
        });
      } catch (e) {
        // cae a inválido definitivo
      }
    }

    // 3) Nada coincidió
    return NextResponse.json(
      { ok: true, valid: false, reason: "invalid_or_malformed", now_iso: now.toISOString() },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, valid: false, reason: "unexpected", error: e?.message },
      { status: 500 }
    );
  }
}
