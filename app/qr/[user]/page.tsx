// app/qr/[user]/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./Countdown";

/** Helper: valida UUID v4 */
function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  );
}

/** Tarjeta de error amigable (no deja la pantalla en blanco) */
function ErrorCard({
  title = "QR — Error",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <div className="opacity-80">{children}</div>
        <div className="mt-4 text-xs opacity-60">
          Si el error persiste, revisá los Server Logs en Vercel.
        </div>
      </div>
    </div>
  );
}

/**
 * Next 15: `params` llega como Promise.
 * Tipamos sin depender de PageProps para evitar issues de types.
 */
export default async function QRPage(props: {
  params: Promise<{ user: string }>;
}) {
  try {
    // 1) leer params (await porque es Promise en Next 15)
    const { user } = await props.params;
    const userId = user;

    // 2) validar UUID
    if (!userId || !isUUID(userId)) {
      return (
        <ErrorCard>
          El parámetro <code>user</code> no es un UUID válido.
        </ErrorCard>
      );
    }

    // 3) chequear variables de entorno
    const expMinutes = 5;
    const base = process.env.BASE_URL || "";
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || !base) {
      // Log server‑side (visible en Vercel → Functions → Logs)
      console.error("Faltan envs: JWT_SECRET y/o BASE_URL");
      return (
        <ErrorCard>
          Faltan variables de entorno requeridas: <code>JWT_SECRET</code> y/o{" "}
          <code>BASE_URL</code>.
        </ErrorCard>
      );
    }

    const secret = new TextEncoder().encode(jwtSecret);

    // 4) generar token (EXP corto)
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    // 5) URL de verificación
    const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;

    // 6) generar QR (Data URL)
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

    // 7) fecha de expiración (cliente la usa para countdown)
    const expiresAt = new Date(Date.now() + expMinutes * 60_000).toISOString();

    // 8) render
    /* eslint-disable @next/next/no-img-element */
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
          <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

          <div className="bg-white p-3 rounded-xl inline-block">
            <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
          </div>

          <div className="mt-4 text-xs opacity-80 break-words">
            Apunta a: <code className="opacity-90">{verifyUrl}</code>
          </div>

          <Countdown expiresAt={expiresAt} />

          <div className="mt-5 flex gap-2 justify-center">
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Regenerar
            </button>
            <a
              href="/"
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
            >
              Inicio
            </a>
          </div>

          <p className="mt-3 text-[11px] opacity-60">
            El QR expira en {expMinutes} minutos. Regeneralo si el comercio lo pide.
          </p>
        </div>
      </div>
    );
  } catch (err: any) {
    // Cualquier excepción (jose, qrcode, etc.) cae acá y no te deja pantalla en blanco
    console.error("QRPage error:", err?.message || err);
    return (
      <ErrorCard>
        Ocurrió un error inesperado al generar tu QR. Intenta nuevamente en un momento.
      </ErrorCard>
    );
  }
}
