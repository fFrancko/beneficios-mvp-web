"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type VerifyResponse = {
  result: "active" | "expired" | "invalid_token" | string;
  member?: { id: string; full_name: string | null };
  membership?: { status: string; valid_until: string | null };
  token?: { expires_at: string | null };
  now_iso?: string;
  error?: string;
  message?: string;
  note?: string;
};

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-semibold ${
        ok ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
           : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
      }`}
    >
      {ok ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

export default function VerifyPage() {
  const search = useSearchParams();
  const router = useRouter();
  const t = search.get("t") ?? "";

  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Traer verificación al cargar
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!t) {
        setData({ result: "invalid_token" });
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/verify?t=${encodeURIComponent(t)}`, { cache: "no-store" });
        const json = (await res.json()) as VerifyResponse;
        if (!cancel) setData(json);
      } catch {
        if (!cancel) setData({ result: "error" });
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [t]);

  const ok = data?.result === "active";
  const name = data?.member?.full_name ?? "Socio";
  const validUntil = data?.membership?.valid_until
    ? new Date(data.membership.valid_until)
    : null;
  const tokenExp = data?.token?.expires_at ? new Date(data.token.expires_at) : null;

  const validUntilText = useMemo(
    () => (validUntil ? validUntil.toLocaleString() : "—"),
    [validUntil]
  );
  const tokenExpText = useMemo(
    () => (tokenExp ? tokenExp.toLocaleString() : "—"),
    [tokenExp]
  );

  async function copySummary() {
    const lines = [
      `Estado: ${ok ? "ACTIVO" : "INACTIVO"}`,
      `Cliente: ${name ?? "-"}`,
      `Válido hasta: ${validUntilText}`,
      `Exp. del token: ${tokenExpText}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("Copiado ✅");
    } catch {
      alert("No se pudo copiar");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
        <div className="animate-pulse w-full max-w-sm rounded-2xl p-6 border border-white/10 bg-black/30">
          Cargando verificación…
        </div>
      </div>
    );
  }

  // UI principal
  return (
    <div
      className={`min-h-screen flex items-center justify-center p-6 text-white ${
        ok
          ? "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950"
          : "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950"
      }`}
    >
      <div className="w-full max-w-sm rounded-2xl p-6 border border-white/15 bg-black/35 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm opacity-80">MULTICLASICOS — Verificación</div>
          <StatusBadge ok={ok} />
        </div>

        <h1 className="text-2xl font-bold mb-1">{name}</h1>

        <div className="text-sm opacity-80 space-y-1">
          <div>
            <span className="opacity-70">Válido hasta: </span>
            <span className="font-medium">{validUntilText}</span>
          </div>
          <div>
            <span className="opacity-70">Token expira: </span>
            <span className="font-medium">{tokenExpText}</span>
          </div>
        </div>

        {data?.note ? (
          <div className="mt-3 text-xs opacity-70 italic">{data.note}</div>
        ) : null}

        {data?.result === "invalid_token" && (
          <div className="mt-3 text-sm text-amber-300/90">
            El QR no es válido o el token está mal formado/expirado.
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push("/verify/scan")}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20"
          >
            Nuevo escaneo
          </button>
          <button
            onClick={copySummary}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20"
          >
            Copiar resultado
          </button>
        </div>

        <p className="mt-4 text-[11px] opacity-60">
          Consejo: mantené esta página abierta para validar múltiples clientes rápidamente.
        </p>
      </div>
    </div>
  );
}