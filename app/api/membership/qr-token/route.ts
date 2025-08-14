import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TTL_SECONDS = 120;            // duración del token (2 minutos)
const REUSE_WINDOW_SECONDS = 60;    // si existe uno reciente, lo reutilizamos

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function originFrom(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL; // opcional, si lo tenés
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  try {
    const bearer = getBearer(req);
    if (!bearer) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    // Client con RLS usando el token del usuario
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    // 1) Validar sesión y obtener user.id
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const uid = userData.user.id;

    // 2) Chequear membresía activa y sin vencer
    const now = new Date();
    const { data: memb, error: membErr } = await supabase
      .from("memberships")
      .select("status, valid_until")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membErr) {
      // 42P01 = tabla no existe
      if ((membErr as any).code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "memberships_missing" },
          { status: 500 }
        );
      }
      throw membErr;
    }

    const active =
      memb?.status === "active" &&
      memb?.valid_until &&
      new Date(memb.valid_until).getTime() >= now.getTime();

    if (!active) {
      return NextResponse.json(
        { ok: false, error: "membership_inactive_or_expired" },
        { status: 403 }
      );
    }

    // 3) Reutilizar token reciente si existe
    const reuseCutoff = new Date(now.getTime() - REUSE_WINDOW_SECONDS * 1000).toISOString();
    const { data: existing, error: exErr } = await supabase
      .from("qr_tokens")
      .select("token, expires_at, revoked, used_at")
      .eq("user_id", uid)
      .is("used_at", null)
      .eq("revoked", false)
      .gt("expires_at", now.toISOString())
      .gt("created_at", reuseCutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exErr && (exErr as any).code !== "42P01") throw exErr;

    let token: string;
    let expires_at: string;

    if (existing) {
      token = existing.token as string;
      expires_at = existing.expires_at as string;
    } else {
      // 4) Crear token nuevo
      // Nota: usar UUID + aleatorio hace el token no adivinable.
      const rand = globalThis.crypto?.getRandomValues
        ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
        : Math.random().toString(36).slice(2);

      token = `${crypto.randomUUID()}-${rand}`;
      expires_at = new Date(now.getTime() + TTL_SECONDS * 1000).toISOString();

      // Insert con RLS: user solo puede insertar su propio user_id
      const { error: insErr } = await supabase.from("qr_tokens").insert([
        { user_id: uid, token, expires_at },
      ]);
      if (insErr) {
        if ((insErr as any).code === "42P01") {
          return NextResponse.json(
            { ok: false, error: "qr_tokens_missing" },
            { status: 500 }
          );
        }
        throw insErr;
      }
    }

    const site = originFrom(req);
    const link_for_qr = `${site}/verify?token=${encodeURIComponent(token)}`;

    return NextResponse.json({
      ok: true,
      token,
      expires_at,
      ttl_sec: TTL_SECONDS,
      link_for_qr,
      now_iso: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unexpected" },
      { status: 500 }
    );
  }
}
