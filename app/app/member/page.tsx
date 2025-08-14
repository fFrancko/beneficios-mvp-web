"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ApiResp = {
  status?: string;
  valid_until?: string | null;
  last_payment_at?: string | null;
  derived?: { result: "active" | "expired"; now_iso: string; note?: string };
  error?: string | { code?: string; message?: string };
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLeft(validUntil?: string | null, nowIso?: string) {
  if (!validUntil || !nowIso) return null;
  const now = new Date(nowIso).getTime();
  const vu = new Date(validUntil).getTime();
  if (isNaN(now) || isNaN(vu)) return null;
  const diff = vu - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function MemberPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [loading, setLoading] = useState(true);
  const [resp, setResp] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 1) Chequear sesión y cargar estado
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }
      await fetchState(token);
    })();
    return () => {
      alive = false;
      // para TypeScript: no usamos alive luego, pero dejamos patrón por si extendés
    };
  }, [supabase, router]);

  async function fetchState(token: string) {
    try {
      setLoading(true);
      setErr(null);
      setResp(null);
      const r = await fetch("/api/membership", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json()) as ApiResp;
      if (!r.ok) {
        const msg =
          typeof j?.error === "string"
            ? j.error
            : j?.error?.message || "Error al consultar membresía";
        setErr(msg);
        return;
      }
      setResp(j);
    } catch (e: any) {
      setErr(e?.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }

  const active = resp?.derived?.result === "active";
  const dl = daysLeft(resp?.valid_until ?? null, resp?.derived?.now_iso);

  return (
    <main className="min-h-screen p-4 bg-neutral-950 text-neutral-100">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-4">
          <h1 className="text-xl font-semibold">Mi membresía</h1>
          <p className="text-sm opacity-70">Estado y acceso a tu QR digital</p>
        </header>

        {/* Estado */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="opacity-80">Estado</span>
            <span
              className={
                "px-3 py-1 rounded-full text-xs font-semibold border " +
                (active
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30")
              }
            >
              {active ? "Activa" : "Vencida"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="opacity-80">Válida hasta</span>
            <span className="font-medium">{fmtDate(resp?.valid_until)}</span>
          </div>

          {active && typeof dl === "number" && (
            <div
              className={
                "mt-1 text-xs p-2 rounded-lg border " +
                (dl <= 7
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200")
              }
            >
              {dl > 0
                ? `Tu membresía vence en ${dl} día${dl === 1 ? "" : "s"}.`
                : "Vence hoy."}
            </div>
          )}

          {!active && (
            <div className="mt-1 text-xs p-2 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-200">
              Tu membresía está vencida. {resp?.derived?.note ? `(${resp.derived.note})` : ""}
            </div>
          )}

          {err && (
            <div className="text-sm p-2 rounded-lg bg-rose-500/15 border border-rose-500/30">
              {err}
            </div>
          )}

          {loading && (
            <div className="text-sm opacity-70">Cargando estado de membresía…</div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const token = data.session?.access_token;
                if (token) await fetchState(token);
              }}
              className="flex-1 py-2 rounded-xl border border-white/20"
            >
              Actualizar
            </button>

            <button
              onClick={() => (active ? router.push("/app/qr") : null)}
              disabled={!active}
              className="flex-1 py-2 rounded-xl border border-white/20 disabled:opacity-50"
              title={active ? "Abrir mi QR" : "Necesitás membresía activa"}
            >
              Mostrar mi QR
            </button>
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-4 text-xs opacity-70">
          Última verificación: {fmtDate(resp?.derived?.now_iso)}
          {resp?.status && (
            <>
              {" "}
              · Estado del sistema: <span className="opacity-90">{resp.status}</span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
