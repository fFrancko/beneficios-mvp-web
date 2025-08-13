export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import ClientQR from "./client-qr";

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

// Nota: evitamos tipos de Next 15 para no romper el build.
// params puede venir como objeto o Promise; lo manejamos defensivo.
export default async function Page(input: any) {
  const rawParams = input?.params;
  const params = (rawParams && typeof rawParams.then === "function") ? await rawParams : rawParams;
  const userId = params?.user as string | undefined;

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

  // Configuración inicial (5 minutos)
  const expMinutes = 5;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

  // Generar token inicial en el servidor
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${expMinutes}m`)
    .sign(secret);

  // URL /verify
  const base = process.env.BASE_URL || "";
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;

  // PNG del QR (server)
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

  // Expiración ISO
  const expiresAt = new Date(Date.now() + expMinutes * 60_000).toISOString();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <ClientQR initial={{ verifyUrl, qrDataUrl, expiresAt }} />
    </div>
  );
}
