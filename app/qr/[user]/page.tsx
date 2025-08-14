export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as jose from "jose";
import QRCode from "qrcode";
import ClientQR from "./client-qr";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

// Valida UUID en runtime
function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

async function originFromHeaders() {
  const h = await headers(); // ✅ si es Promise, lo esperamos; si no, igual funciona
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export default async function QRPage(input: any) {
  // Next 15: params puede venir como Promise
  const supabase = await createSupabaseServerClient(); // ✅ ahora es async
  const raw = input?.params;
  const params = raw && typeof raw?.then === "function" ? await raw : raw;
  const userId = String(params?.user ?? "");

  if (!userId || !isUUID(userId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
          <p className="opacity-80">
            El parámetro <code>user</code> no es un UUID válido.
          </p>
        </div>
      </div>
    );
  }


  const { data: userData, error: authErr } = await supabase.auth.getUser();
  const logged = userData?.user;

  if (authErr || !logged) {
    // Sin sesión -> mandamos a login
    redirect("/login");
  }

  if (logged!.id !== userId) {
    // No puede ver el QR de otro usuario
    redirect("/app/member");
  }

  // --- Chequeo de membresía activa antes de generar el QR ---
  const { data: memb, error: membErr } = await supabase
    .from("memberships")
    .select("status, valid_until")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const active =
    !membErr &&
    memb?.status === "active" &&
    memb?.valid_until &&
    new Date(memb.valid_until).getTime() >= now.getTime();

  if (!active) {
    // Sin membresía activa -> mandamos a ver su estado
    redirect("/app/member");
  }

  // --- Generación del QR (tu flujo original) ---
  const expMinutes = 5;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Config faltante</h1>
          <p className="opacity-80">
            Falta <code>JWT_SECRET</code> en variables de entorno.
          </p>
        </div>
      </div>
    );
  }

  const secret = new TextEncoder().encode(jwtSecret);

  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${expMinutes}m`)
    .sign(secret);

  const base = process.env.BASE_URL || (await originFromHeaders());
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });
  const expiresAtISO = new Date(Date.now() + expMinutes * 60_000).toISOString();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
        <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

        <ClientQR
          userId={userId}
          initialVerifyUrl={verifyUrl}
          initialQrDataUrl={qrDataUrl}
          initialExpiresAtISO={expiresAtISO}
          minRegenerateDelayMs={800}
        />

        <div className="mt-5 flex gap-2 justify-center">
          <a
            href="/"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
          >
            Inicio
          </a>
          <a
            href="/app/member"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
          >
            Mi membresía
          </a>
        </div>

        <p className="mt-3 text-[11px] opacity-60">
          El QR expira en {expMinutes} minutos. Podés regenerarlo cuando quieras.
        </p>
      </div>
    </div>
  );
}
