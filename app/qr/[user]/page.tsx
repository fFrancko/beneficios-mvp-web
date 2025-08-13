export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./Countdown";

type Params = { user: string };

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export default async function QRPage({ params }: { params: Params }) {
  const userId = (params.user || "").trim();

  if (!userId || !isUUID(userId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
          <p className="opacity-80">El parámetro <code>user</code> no es un UUID válido.</p>
        </div>
      </div>
    );
  }

  try {
    // 1) configuración
    const expMinutes = 5;

    const secretStr = process.env.JWT_SECRET;
    if (!secretStr) throw new Error("JWT_SECRET no está definido en el runtime (Vercel Settings → Environment Variables).");
    const secret = new TextEncoder().encode(secretStr);

    // 2) firmar token
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    // 3) armar URL de verificación
    const base = (process.env.BASE_URL || "").trim();
    // si BASE_URL está vacío, usamos ruta relativa (también funciona)
    const verifyUrl = base
      ? `${base.replace(/\/+$/, "")}/verify?t=${encodeURIComponent(token)}`
      : `/verify?t=${encodeURIComponent(token)}`;

    // 4) generar QR (data URL)
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

    // 5) expiración para el contador
    const expiresAt = new Date(Date.now() + expMinutes * 60_000).toISOString();

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
          <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

          <div className="bg-white p-3 rounded-xl inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
          </div>

          <div className="mt-4 text-xs opacity-80 break-words">
            Apunta a: <code className="opacity-90">{verifyUrl}</code>
          </div>

          <Countdown expiresAt={expiresAt} />

          <div className="mt-5 flex gap-2 justify-center">
            <a
              href={`/qr/${encodeURIComponent(userId)}`}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Regenerar
            </a>
            <a
              href="/"
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
            >
              Inicio
            </a>
          </div>

          <p className="mt-3 text-[11px] opacity-60">El QR expira en 5 minutos. Regeneralo si el comercio lo pide.</p>
        </div>
      </div>
    );
  } catch (e: any) {
    // --- Bloque de debug visible en producción ---
    const msg = e?.message || "unknown";
    const stk = e?.stack || "";
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-lg w-full rounded-2xl p-6 border border-amber-500/50 bg-amber-900/20">
          <h1 className="text-xl font-semibold mb-3">QR — Error en runtime</h1>
          <p className="mb-2 opacity-90"><b>Mensaje:</b> {msg}</p>
          <p className="mb-2 opacity-90"><b>JWT_SECRET presente:</b> {String(Boolean(process.env.JWT_SECRET))}</p>
          <p className="mb-2 opacity-90"><b>BASE_URL:</b> {String(process.env.BASE_URL || "(vacío)")}</p>
          <details className="mt-3">
            <summary className="cursor-pointer">Stack</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{stk}</pre>
          </details>
        </div>
      </div>
    );
  }
}
