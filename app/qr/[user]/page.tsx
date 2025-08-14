export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as jose from "jose";
import QRCode from "qrcode";
import ClientQR from "./client-qr";

type Params = { user: string };

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export default async function QRPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const p = await params; // Next 15: params puede venir como Promise
  const userId = p.user;

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

  // Configuración inicial del QR
  const expMinutes = 5;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

  // Generamos token inicial (server) para primera renderización
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${expMinutes}m`)
    .sign(secret);

  const base = process.env.BASE_URL || "";
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

  const expiresAtISO = new Date(Date.now() + expMinutes * 60_000).toISOString();

  // ⚠️ IMPORTANTE: NO pasar funciones. Solo datos serializables.
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
        <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

        <ClientQR
          userId={userId}
          initialVerifyUrl={verifyUrl}
          initialQrDataUrl={qrDataUrl}
          initialExpiresAtISO={expiresAtISO}
          // tip: si querés micro‑delay anti‑spam, pasalo como número
          minRegenerateDelayMs={800}
        />

        <div className="mt-5 flex gap-2 justify-center">
          <a
            href="/"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
          >
            Inicio
          </a>
        </div>

        <p className="mt-3 text-[11px] opacity-60">
          El QR expira en 5 minutos. Podés regenerarlo cuando quieras.
        </p>
      </div>
    </div>
  );
}
