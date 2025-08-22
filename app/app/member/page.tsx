"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // ✅ usa el cliente con sessionStorage

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
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysLeft(validUntil?: string | null, nowIso?: string) {
  if (!validUntil || !nowIso) return null;
  const now = new Date(nowIso).getTime();
  const vu = new Date(validUntil).getTime();
  if (isNaN(now) || isNaN(vu)) return null;
  const diff = vu - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* =====================  Logout & Auto-logout ===================== */

const LOGOUT_IDLE_MS = 15 * 60 * 1000; // 15 minutos

function useDoLogout() {
  const router = useRouter();

  return useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      try {
        window.sessionStorage.clear();
      } catch {}
      try {
        window.localStorage.clear();
      } catch {}
      router.replace("/login");
    }
  }, [router]);
}

function useInactivityLogout(onLogout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onLogout, LOGOUT_IDLE_MS);
  }, [onLogout]);

  useEffect(() => {
    reset();

    // Eventos del WINDOW
    const windowEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
    ];
    const handler = () => reset();
    windowEvents.forEach((ev) =>
      window.addEventListener(ev, handler, { passive: true })
    );

    // Evento del DOCUMENT
    const onDocVisibility = () => reset();
    document.addEventListener("visibilitychange", onDocVisibility);

    return () => {
      windowEvents.forEach((ev) => window.removeEventListener(ev, handler));
      document.removeEventListener("visibilitychange", onDocVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);
}

/* =====================  Página ===================== */

export default function MemberPage() {
  const router = useRouter();
  const doLogout = useDoLogout(); // ← acción de logout
  useInactivityLogout(doLogout); // ← auto-logout por inactividad

  const [loading, setLoading] = useState(true);
  const [loadingPay, setLoadingPay] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 1) Chequear sesión y cargar estado
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }
      await fetchState(token);
    })();
  }, [router]);

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

  // 👉 Inicia flujo de pago (Mercado Pago) y redirige a init_point
  async function handleRenew() {
    try {
      setLoadingPay(true);
      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        // Podés omitir body para usar los defaults del backend;
        // dejo un título por claridad:
        body: JSON.stringify({
          title: "Membresía mensual",
          quantity: 1,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.init_point) {
        alert(json?.error || "No se pudo iniciar el pago");
        return;
      }

      // Abrimos el checkout (mobile_init_point si existe, si no init_point)
      window.location.href = json.mobile_init_point || json.init_point;
    } catch (e) {
      alert("Error iniciando el pago");
    } finally {
      setLoadingPay(false);
    }
  }

  const active = resp?.derived?.result === "active";
  const dl = daysLeft(resp?.valid_until ?? null, resp?.derived?.now_iso);

  return (
    <main className="min-h-screen p-4 bg-neutral-950 text-neutral-100">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Mi membresía</h1>
            <p className="text-sm opacity-70">Estado y acceso a tu QR digital</p>
          </div>

          {/* 🔒 Botón Cerrar Sesión (arriba derecha) */}
          <button
            onClick={doLogout}
            className="ml-3 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-sm font-semibold hover:bg-rose-500/25 active:scale-[0.99] transition"
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
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
              Tu membresía está vencida.{" "}
              {resp?.derived?.note ? `(${resp.derived.note})` : ""}
            </div>
          )}

          {err && (
            <div className="text-sm p-2 rounded-lg bg-rose-500/15 border border-rose-500/30">
              {err}
            </div>
          )}

          {loading && (
            <div className="text-sm opacity-70">
              Cargando estado de membresía…
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
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

            {/* Mostrar QR solo si está activa */}
            <button
              onClick={() => (active ? router.push("/app/qr") : null)}
              disabled={!active}
              className="flex-1 py-2 rounded-xl border border-white/20 disabled:opacity-50"
              title={active ? "Abrir mi QR" : "Necesitás membresía activa"}
            >
              Mostrar mi QR
            </button>

            {/* Renovar membresía cuando NO esté activa */}
            {!active && (
              <button
                onClick={handleRenew}
                disabled={loadingPay}
                className="w-full py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-[0.99] transition"
                title="Iniciar pago de membresía"
              >
                {loadingPay ? "Redirigiendo a pago…" : "Renovar membresía"}
              </button>
            )}
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-4 text-xs opacity-70">
          Última verificación: {fmtDate(resp?.derived?.now_iso)}
          {resp?.status && (
            <>
              {" "}
              · Estado del sistema:{" "}
              <span className="opacity-90">{resp.status}</span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
