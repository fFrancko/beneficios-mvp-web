"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type VerifyOk =
  | { ok: true; valid: true; kind: "db_token" | "jwt"; user_id: string; expires_at?: string; now_iso: string }
  | { ok: true; valid: false; reason: string; kind?: "db_token" | "jwt"; user_id?: string; expires_at?: string; now_iso: string };
type VerifyErr = { ok: false; valid: false; reason: string; error?: string };

export default function VerifyPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<VerifyOk | VerifyErr | null>(null);
  const [loading, setLoading] = useState(true);

  const token = useMemo(() => sp.get("token") || sp.get("t") || "", [sp]);

  useEffect(() => {
    (async () => {
      if (!token) {
        setState({ ok: false, valid: false, reason: "missing_token" });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // aceptamos ambos nombres, pero mandamos uno
        const r = await fetch(`/api/verify?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = (await r.json()) as VerifyOk | VerifyErr;
        setState(j);
      } catch (e: any) {
        setState({ ok: false, valid: false, reason: "network_error", error: e?.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const valid = state && "valid" in state && state.valid === true;

  function fmt(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-AR", { hour12: false });
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
        <header className="mb-4">
          <h1 className="text-xl font-semibold">Verificación de acceso</h1>
          <p className="text-sm opacity-70">Escaneá el QR del socio</p>
        </header>

        {/* Resultado grande */}
        <div
          className={
            "rounded-xl p-5 text-center text-2xl font-bold border " +
            (valid
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              : "bg-rose-500/15 text-rose-300 border-rose-500/30")
          }
        >
          {loading ? "Verificando…" : valid ? "VÁLIDO" : "INVÁLIDO"}
        </div>

        {/* Detalles */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Tipo</span>
            <span className="font-medium">
              {state && "kind" in state && state.kind ? state.kind : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Usuario</span>
            <span className="font-mono text-xs">{(state as any)?.user_id ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Expira</span>
            <span className="font-medium">{fmt((state as any)?.expires_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Servidor</span>
            <span className="font-medium">{fmt((state as any)?.now_iso)}</span>
          </div>

          {/* Razón de rechazo */}
          {!valid && !loading && state && "reason" in state && state.reason && (
            <div className="mt-2 p-3 rounded-lg text-rose-200 bg-rose-500/10 border border-rose-500/30">
              Motivo: <span className="font-mono">{state.reason}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => router.refresh()}
              className="flex-1 py-2 rounded-xl border border-white/20"
            >
              Actualizar
            </button>
            <button
              onClick={() => {
                // Volver limpio para escanear otro QR
                window.location.href = "/verify";
              }}
              className="flex-1 py-2 rounded-xl border border-white/20"
            >
              Nuevo escaneo
            </button>
          </div>

          <p className="text-xs opacity-60">
            Este verificador acepta <code>?t=</code> o <code>?token=</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
