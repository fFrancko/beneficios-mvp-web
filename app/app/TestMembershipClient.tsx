"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ApiResp = {
  status?: string;
  valid_until?: string | null;
  last_payment_at?: string | null;
  derived?: { result: "active" | "expired"; now_iso: string; note?: string };
  error?: string | { code?: string; message?: string };
};

export default function TestMembershipClient() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);
  const [sessionState, setSessionState] = useState<
    { hasSession: boolean; email?: string } | null
  >(null);
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 1) Ver si hay sesión
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      if (mounted) {
        setSessionState({
          hasSession: !!s,
          email: s?.user?.email ?? undefined,
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const probar = async () => {
    try {
      setLoading(true);
      setResp(null);

      // 2) Tomar el access_token del usuario
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setResp({ error: "No hay sesión: logueate primero" });
        return;
      }

      // 3) Llamar al endpoint SEGURO (sin query ?user=) con Authorization: Bearer
      const r = await fetch("/api/membership", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await r.json()) as ApiResp;
      setResp(json);
    } catch (e: any) {
      setResp({ error: e?.message || "Error inesperado" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4 border rounded-2xl bg-neutral-900/40 text-neutral-100">
      <h2 className="text-lg font-semibold mb-2">Prueba modo seguro /api/membership</h2>

      {!sessionState?.hasSession ? (
        <div className="text-sm text-rose-300 mb-3">
          No estás logueado. Inicia sesión y vuelve a probar.
        </div>
      ) : (
        <div className="text-sm text-emerald-300 mb-3">
          Sesión detectada{sessionState.email ? `: ${sessionState.email}` : ""}.
        </div>
      )}

      <button
        onClick={probar}
        disabled={loading || !sessionState?.hasSession}
        className="w-full py-2 rounded-xl border border-white/20 disabled:opacity-50"
      >
        {loading ? "Consultando..." : "Probar membresía (modo seguro)"}
      </button>

      {resp && (
        <div className="mt-4 space-y-2 text-sm">
          {"error" in resp && resp.error ? (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30">
              <strong>Error: </strong>
              {typeof resp.error === "string"
                ? resp.error
                : resp.error?.message ?? "Error"}
            </div>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-neutral-800/60 border border-white/10">
                <div>
                  <span className="opacity-70">Status: </span>
                  <span className="font-semibold">{resp.status ?? "—"}</span>
                </div>
                <div>
                  <span className="opacity-70">Válido hasta: </span>
                  <span className="font-semibold">{resp.valid_until ?? "—"}</span>
                </div>
                <div>
                  <span className="opacity-70">Último pago: </span>
                  <span className="font-semibold">{resp.last_payment_at ?? "—"}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-800/60 border border-white/10">
                <div className="mb-1 opacity-70">Derivado:</div>
                <div>
                  <span className="opacity-70">Resultado: </span>
                  <span
                    className={
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold " +
                      (resp.derived?.result === "active"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30")
                    }
                  >
                    {resp.derived?.result ?? "—"}
                  </span>
                </div>
                <div className="opacity-70">
                  Ahora: {resp.derived?.now_iso ?? "—"}
                </div>
                {resp.derived?.note && (
                  <div className="opacity-70">Nota: {resp.derived.note}</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}