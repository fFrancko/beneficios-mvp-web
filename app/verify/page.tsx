export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import VerifyClient from "./VerifyClient";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
          <div className="animate-pulse w-full max-w-sm rounded-2xl p-6 border border-white/10 bg-black/30">
            Cargando verificación…
          </div>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
