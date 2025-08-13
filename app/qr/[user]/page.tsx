export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import ClientQR from "./client-qr";
import { issueQR } from "./actions";

type Params = { user: string };

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

// Next 15 a veces pasa params como Promise<Params>
async function resolveParams(p: Params | Promise<Params>): Promise<Params> {
  return (p && typeof (p as any)?.then === "function") ? (p as Promise<Params>) : (p as Params);
}

export default async function QRPage(input: { params: Params | Promise<Params> }) {
  const { user } = await resolveParams(input.params);
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

  // Primer QR (servidor)
  const first = await issueQR(userId);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <ClientQR
        userId={userId}
        initialSrc={first.src}
        initialVerifyUrl={first.verifyUrl}
        initialExpiresAt={first.expiresAt}
      />
    </div>
  );
}
