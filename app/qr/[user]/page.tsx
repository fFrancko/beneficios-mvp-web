export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./Countdown";

// --- helpers UI ---
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
        <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>
        <h1 className="text-xl font-semibold mb-3">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({
  title = "QR — Error",
  message,
  details,
}: {
  title?: string;
  message: string;
  details?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40 text-white">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="opacity-90">{message}</p>
        {details ? (
          <p className="opacity-60 text-xs mt-3 break-words">{details}</p>
        ) : null}
        <div className="mt-4">
          <a
            href="#"
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20 inline-block"
          >
            Reintentar
          </a>
        </div>
      </div>
    </div>
  );
}

// --- validación ---
function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  );
}

// --- PAGE (Server Component) ---
export default async function QRPage({ params }: any) {
  try {
    // En Next 15, params puede ser Promise. Lo resolvemos de forma segura.
    const resolved = await Promise.resolve(params);
    const userId: string | undefined = resolved?.user;

    if (!userId || !isUUID(userId)) {
      return (
        <ErrorBox message={`El parámetro "user" no es un UUID válido.`} />
      );
    }

    // Config
    const expMinutes = 5;
    const JWT_SECRET = process.env.JWT_SECRET;
    const BASE_URL = process.env.BASE_URL || "";

    if (!JWT_SECRET || !BASE_URL) {
      return (
        <ErrorBox
          message="Faltan variables de entorno requeridas."
          details='Verifica JWT_SECRET y BASE_URL en Vercel → Project Settings → Environment Variables (Production).'
        />
      );
    }

    // Generar token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    const verifyUrl = `${BASE_URL}/verify?t=${encodeURIComponent(token)}`;

    // Generar imagen QR
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

    // Expiración
    const expiresAt = new Date(
      Date.now() + expMinutes * 60_000
    ).toISOString();

    return (
      <Card title="Tu código QR">
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
          El QR expira en 5 minutos. Regeneralo si el comercio lo pide.
        </p>
      </Card>
    );
  } catch (err: any) {
    return (
      <ErrorBox
        message="Ocurrió un error renderizando esta página."
        details={err?.message}
      />
    );
  }
}
