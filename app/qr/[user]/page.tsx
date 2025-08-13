export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import * as jose from "jose";
import QRCode from "qrcode";
import ClientQR from "./ClientQR";

type Params = { user: string };

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

/** Firma un JWT HS256 expirable en `expMinutes` y devuelve {verifyUrl, expiresAtISO} */
async function signVerifyUrl(userId: string, expMinutes: number) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${expMinutes}m`)
    .sign(secret);

  const base = process.env.BASE_URL || "";
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
  const expiresAt = new Date(Date.now() + expMinutes * 60_000).toISOString();

  return { verifyUrl, expiresAt };
}

export default async function QRPage({
  params,
  searchParams,
}: {
  params: Params | Promise<Params>;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { user } = await params;
  const userId = user;

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

  // minutos de vida del token
  const expMinutes = 5;

  // Primer token (también admitimos r=<timestamp> en la query para forzar token nuevo
  // cuando el usuario toca "Regenerar" en el cliente)
  const _bust = typeof searchParams?.r === "string" ? searchParams.r : undefined;
  const { verifyUrl, expiresAt } = await signVerifyUrl(userId, expMinutes);

  // Generamos el primer QR como DataURL para el primer render
  const initialQr = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });

  return (
    <ClientQR
      userId={userId}
      initialVerifyUrl={verifyUrl}
      initialExpiresAt={expiresAt}
      initialQrDataUrl={initialQr}
      expMinutes={expMinutes}
    />
  );
}
