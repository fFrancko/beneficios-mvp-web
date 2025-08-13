export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import Countdown from "./countdown";

// Tipá localmente: Next 15 entrega params como Promise
type Params = { user: string };
type PageInput = {
  params: Params | Promise<Params>;
  searchParams: Record<string, string | string[] | undefined>;
};

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

// util de UI simple para tarjeta
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
        <div className="text-sm opacity-70 mb-2">{title}</div>
        {children}
      </div>
    </div>
  );
}

async function mintToken(userId: string, minutes: number) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");

  const key = new TextEncoder().encode(secret);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${minutes}m`)
    .sign(key);

  const base = process.env.BASE_URL || "";
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();

  return { verifyUrl, qrDataUrl, expiresAt };
}

export default async function QRPage(input: PageInput) {
  // 1) resolver params en Next 15
  const { user } = await input.params;
  const userId = user;

  // 2) validar
  if (!userId || !isUUID(userId)) {
    return (
      <Card title="QR — Error">
        <p className="opacity-80">El parámetro <code>user</code> no es un UUID válido.</p>
      </Card>
    );
  }

  // 3) minutos de vida del token
  const expMinutes = 5;

  // 4) permitir refresh suave del QR usando ?r=<timestamp>
  //    (esto hace que el server regenere datos y el client no se recargue completo)
  const _r = input.searchParams?.r; // no lo usamos, solo invalida caché en el server

  // 5) mintear token + QR
  let verifyUrl = "";
  let qrDataUrl = "";
  let expiresAt = "";
  try {
    const minted = await mintToken(userId, expMinutes);
    verifyUrl = minted.verifyUrl;
    qrDataUrl = minted.qrDataUrl;
    expiresAt = minted.expiresAt;
  } catch (e: any) {
    return (
      <Card title="QR — Error">
        <p className="opacity-80">Ocurrió un error generando el QR.</p>
        <p className="opacity-60 text-xs mt-2">{String(e?.message || e)}</p>
      </Card>
    );
  }

  // 6) UI — botón de *soft* refresh (solo regenera el QR)
  return (
    <Card title="MULTICLASICOS — Mi QR">
      <div className="bg-white p-3 rounded-xl inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
      </div>

      <div className="mt-4 text-[11px] opacity-80 break-words px-2 text-left">
        Apunta a: <code className="opacity-90 break-all">{verifyUrl}</code>
      </div>

      {/* Al expirar, forzamos un refresh suave agregando ?r=timestamp */}
      <Countdown
        expiresAt={expiresAt}
        onExpired={() => {
          // degradado: si el navegador no soporta, al menos recarga
          const url = new URL(typeof window !== "undefined" ? window.location.href : "/");
          url.searchParams.set("r", String(Date.now()));
          if (typeof window !== "undefined") window.location.replace(url.toString());
        }}
      />

      <div className="mt-5 flex gap-2 justify-center">
        {/* SOFT REFRESH: regenerar QR sin recargar toda la app, solo esta ruta */}
        <a
          href={`?r=${Date.now()}`}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20 inline-block"
        >
          Regenerar
        </a>
        <a
          href="/"
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20 inline-block"
        >
          Inicio
        </a>
      </div>

      <p className="mt-3 text-[11px] opacity-60">
        El QR expira en {expMinutes} minutos. Regeneralo si el comercio lo pide.
      </p>
    </Card>
  );
}
