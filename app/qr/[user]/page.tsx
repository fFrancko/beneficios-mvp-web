export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./Countdown";

type Params = { user: string };

// UUID simple
function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

// Tarjeta de error segura (no expone secretos)
function ErrorCard({
  title = "QR — Error",
  message,
  hint,
}: {
  title?: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="max-w-lg w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="opacity-90 whitespace-pre-wrap">{message}</p>
        {hint && <p className="opacity-70 mt-3 text-sm">{hint}</p>}
        <div className="mt-5">
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

export default async function QRPage({
  params,
}: {
  // En Next 15 a veces params es un Promise; lo tipamos laxo y resolvemos.
  params: Params | Promise<Params>;
}) {
  try {
    // 1) Resolver params (soporta Promise y objeto directo)
    const p = (await Promise.resolve(params)) as Params | undefined;
    const userId = p?.user;

    if (!userId || !isUUID(userId)) {
      return (
        <ErrorCard
          message={`El parámetro "user" no es un UUID válido.\nRecibido: ${userId ?? "(vacío)"}`}
          hint='Asegurate de visitar /qr/<UUID> por ejemplo: /qr/e36deab3-a184-43c6-9835-235f10e14759'
        />
      );
    }

    // 2) Variables y chequeos de entorno (no exponemos valores)
    const secretStr = process.env.JWT_SECRET;
    const vercelUrl = process.env.VERCEL_URL;
    // BASE_URL preferida; fallback a VERCEL_URL
    const baseFromEnv = process.env.BASE_URL?.trim();
    const base =
      (baseFromEnv && baseFromEnv.replace(/\/$/, "")) ||
      (vercelUrl ? `https://${vercelUrl}` : "");

    if (!secretStr) {
      return (
        <ErrorCard
          message={`Variable JWT_SECRET no configurada en el entorno del servidor.`}
          hint="Definila en Vercel → Project → Settings → Environment Variables (Production + Preview) y redeploy."
        />
      );
    }
    if (!base) {
      return (
        <ErrorCard
          message={`No pude determinar BASE_URL.`}
          hint={`Opciones:
- Define BASE_URL en Vercel (p.ej. https://beneficios-mvp-web.vercel.app) y redeploy
- o asegurate que VERCEL_URL esté presente (Vercel lo injecta en runtime).`}
        />
      );
    }

    // 3) Firmar token JWT (exp 5 min)
    const expMinutes = 5;
    const secret = new TextEncoder().encode(secretStr);

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    // 4) URL de verificación y QR
    const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

    // 5) Expiración para el contador
    const expiresAt = new Date(Date.now() + expMinutes * 60_000).toISOString();

    // 6) UI
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

          <p className="mt-3 text-[11px] opacity-60">El QR expira en 5 minutos. Regeneralo si el comercio lo pide.</p>
        </div>
      </div>
    );
  } catch (e: any) {
    // Log completo al server (Vercel → Functions Logs)
    console.error("QRPage render error:", e);
    const digest = e?.digest || e?.message || "unknown";

    // Diagnóstico útil pero seguro
    const diag = [
      `hasJWT=${Boolean(process.env.JWT_SECRET)}`,
      `hasBASE=${Boolean(process.env.BASE_URL)}`,
      `hasVERCEL_URL=${Boolean(process.env.VERCEL_URL)}`,
      `node=${process.version}`,
    ].join(" • ");

    return (
      <ErrorCard
        message={`Ocurrió un error renderizando esta página.\nDigest/Mensaje: ${digest}`}
        hint={`Chequeos rápidos → ${diag}\nBuscá este digest en Vercel → Project → Deployments → (deployment actual) → Logs → Functions.`}
      />
    );
  }
}
