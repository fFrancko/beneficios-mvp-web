import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { supabaseAdmin } from "../../../lib/supabaseAdmin"; // app/api/verify/route.ts → ../../../lib

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const raw = q.get("token") || q.get("t"); // acepta ?token=... / ?t=...

    if (!raw) {
      return NextResponse.json({ ok: false, valid: false, reason: "missing_token" }, { status: 400 });
    }

    const now = new Date();
    const sb = supabaseAdmin();

    // 1) Intentar como TOKEN EFÍMERO (tabla qr_tokens)
    try {
      const { data: row, error } = await sb
        .from("qr_tokens")
        .select("user_id, expires_at, revoked, used_at")
        .eq("token", raw)
        .maybeSingle();

      if (error && (error as any).code !== "42P01") throw error;

      if (row) {
        const notExpired = new Date(row.expires_at).getTime() >= now.getTime();
        const notRevoked = row.revoked !== true;
        const notUsed = row.used_at == null;

        // Traemos datos del socio (perfil + membresía más vigente)
        const [{ data: prof }, { data: memb }] = await Promise.all([
          sb.from("profiles").select("full_name, avatar_url, email").eq("id", row.user_id).maybeSingle(),
          sb
            .from("memberships")
            .select("status, valid_until, last_payment_at, created_at")
            .eq("user_id", row.user_id)
            .order("valid_until", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const active =
          (memb?.status === "active" || memb?.status === "trialing") &&
          memb?.valid_until &&
          new Date(memb.valid_until).getTime() >= now.getTime();

        return NextResponse.json({
          ok: true,
          valid: notExpired && notRevoked && notUsed,
          kind: "db_token",
          user_id: row.user_id,
          expires_at: row.expires_at,
          now_iso: now.toISOString(),
          member: prof ? { full_name: prof.full_name, avatar_url: prof.avatar_url, email: prof.email } : null,
          membership: memb
            ? {
                status: memb.status,
                valid_until: memb.valid_until,
                last_payment_at: memb.last_payment_at,
                active,
              }
            : { status: "past_due", valid_until: null, last_payment_at: null, active: false },
          reason: !notExpired ? "expired" : !notRevoked ? "revoked" : !notUsed ? "already_used" : undefined,
        });
      }
    } catch {
      // si falla seguimos con JWT
    }

    // 2) Fallback: JWT legacy (HS256 con sub = userId)
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const { payload } = await jose.jwtVerify(raw, new TextEncoder().encode(secret));
        const uid = String(payload.sub || "");
        if (!uid) {
          return NextResponse.json({ ok: true, valid: false, kind: "jwt", reason: "missing_sub", now_iso: now.toISOString() });
        }

        // Igual devolvemos datos del socio para la UI
        const [{ data: prof }, { data: memb }] = await Promise.all([
          sb.from("profiles").select("full_name, avatar_url, email").eq("id", uid).maybeSingle(),
          sb
            .from("memberships")
            .select("status, valid_until, last_payment_at, created_at")
            .eq("user_id", uid)
            .order("valid_until", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const active =
          (memb?.status === "active" || memb?.status === "trialing") &&
          memb?.valid_until &&
          new Date(memb.valid_until).getTime() >= now.getTime();

        return NextResponse.json({
          ok: true,
          valid: true,
          kind: "jwt",
          user_id: uid,
          now_iso: now.toISOString(),
          member: prof ? { full_name: prof.full_name, avatar_url: prof.avatar_url, email: prof.email } : null,
          membership: memb
            ? {
                status: memb.status,
                valid_until: memb.valid_until,
                last_payment_at: memb.last_payment_at,
                active,
              }
            : { status: "past_due", valid_until: null, last_payment_at: null, active: false },
        });
      } catch {
        // cae a inválido
      }
    }

    // 3) Nada coincidió
    return NextResponse.json(
      { ok: true, valid: false, reason: "invalid_or_malformed", now_iso: now.toISOString() },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, valid: false, reason: "unexpected", error: e?.message }, { status: 500 });
  }
}
