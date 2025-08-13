// app/qr/[user]/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./Countdown";

type Params = { user: string };
type MaybePromise<T> = T | Promise<T>;
type PageInput =
  | { params: Params }
  | { params: Promise<Params> }
  | { params: MaybePromise<Params> };

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  );
}

export default async function QRPage(input: PageInput) {
  // Normalizamos params (puede venir como objeto o como Promise en Next 15)
  const params = "then" in input.params ? await input.params : input.params;
  const userId = params?.user;

  if (!userId || !isUUID(userId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
          <p className="opacity-80">
            El parámetro <code>user</code> no es un UUID válido.
          </p>
          <div className="mt-4">
            <a
              href="?r=1"
              className="px-4 py-2 inline-block rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Reintentar
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Configuración
  const expMinutes = 5;
  const base = process.env.BASE_URL || "";
  const secretStr = process.env.JWT_SECRET;

  // Guardas + generación
  try {
    if (!secretStr) {
      throw new Error("Falta JWT_SECRET en variables de entorno");
    }

    const secret = new TextEncoder().encode(secretStr);

    // 1) Firmar token
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    // 2) URL de verificación
    const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;

    // 3) Generar QR (data URL)
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

    // 4) Calcular expiry para el contador
    const expiresAt = new Date(Date.now() + expMinutes * 60_000).toISOString();

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
          <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

          <div className="bg-white p-3 rounded-xl inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR de verificación"
              className="w-full h-auto rounded"
            />
          </div>

          <div className="mt-4 text-xs opacity-80 break-words">
            Apunta a: <code className="opacity-90">{verifyUrl}</code>
          </div>

          <Countdown expiresAt={expiresAt} />

          <div className="mt-5 flex gap-2 justify-center">
            <a
              href={`?regen=${Date.now()}`}
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
            El QR expira en {expMinutes} minutos. Regeneralo si el comercio lo pide.
          </p>
        </div>
      </div>
    );
  } catch (err: any) {
    // Render amigable (sin handlers de eventos desde el Server Component)
    const digest = err?.digest || "";
    const msg =
      err?.message && typeof err.message === "string"
        ? err.message
        : "Ocurrió un error renderizando esta página.";

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
          <p className="opacity-80">{msg}</p>
          {digest ? (
            <p className="mt-2 text-xs opacity-50">Digest: {digest}</p>
          ) : null}
          <div className="mt-4">
            <a
              href={`?retry=${Date.now()}`}
              className="px-4 py-2 inline-block rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Reintentar
            </a>
          </div>
        </div>
      </div>
    );
  }
}
