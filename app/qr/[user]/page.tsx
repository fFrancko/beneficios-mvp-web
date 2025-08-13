// app/qr/[user]/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./Countdown";

type Params = { user: string };

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  );
}


export default async function QRPage(props: { params: Params | Promise<Params> }) {
  // Soportar params como objeto o Promise (Next 15)
  const raw = props?.params ?? {};
  const p: Params =
    typeof (raw as any)?.then === "function" ? await (raw as Promise<Params>) : (raw as Params);

  const userId = p?.user;

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

  // Variables de entorno
  const base = process.env.BASE_URL || "";
  const secretEnv = process.env.JWT_SECRET || "";

  if (!base || !secretEnv) {
    // Falta configuración: mostrar error claro
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-amber-500/50 bg-amber-900/30">
          <h1 className="text-xl font-semibold mb-2">QR — Configuración faltante</h1>
          {!base && <p className="opacity-80 mb-1">Falta <code>BASE_URL</code> en Vercel.</p>}
          {!secretEnv && <p className="opacity-80">Falta <code>JWT_SECRET</code> en Vercel.</p>}
        </div>
      </div>
    );
  }

  try {
    // Config
    const expMinutes = 5;
    const secret = new TextEncoder().encode(secretEnv);

    // Token
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    // URL de verificación
    const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;

    // QR (Data URL)
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

    // Expiración (para el contador)
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
            {/* Regenerar: solo recarga; NO onClick desde Server → evita error de Client handlers */}
            <a
              href={`/qr/${userId}?r=${Date.now()}`}
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

          <p className="mt-3 text-[11px] opacity-60">
            El QR expira en 5 minutos. Regeneralo si el comercio lo pide.
          </p>
        </div>
      </div>
    );
  } catch (err: any) {
    // Guard para cualquier excepción del server (firma, QR, etc.)
    const digest =
      typeof err?.digest === "string"
        ? err.digest
        : Math.random().toString().slice(2).padEnd(9, "0");

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
          <p className="opacity-80">Ocurrió un error renderizando esta página. Digest:</p>
          <p className="mt-1 font-mono text-sm">{digest}</p>
          <div className="mt-4">
            <a
              href={`/qr/${userId}?retry=${Date.now()}`}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Reintentar
            </a>
          </div>
        </div>
      </div>
    );
  }
}
