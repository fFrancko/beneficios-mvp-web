// app/verify/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VerifyResp =
  | {
      ok: true;
      valid: boolean;
      kind: "db_token" | "jwt";
      user_id: string;
      expires_at?: string;
      now_iso: string;
      member?: { full_name?: string | null; avatar_url?: string | null; email?: string | null } | null;
      membership?: { status: string; valid_until: string | null; last_payment_at: string | null; active: boolean } | null;
      reason?: string;
    }
  | { ok: false; valid: false; reason: string; error?: string };

function Loading() {
  return (
    <main className="min-h-screen grid place-items-center p-4 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-center">
        Verificando…
      </div>
    </main>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR", { hour12: false });
}

function ResultBadge({ valid }: { valid: boolean }) {
  return (
    <div
      className={
        "rounded-xl p-5 text-center text-2xl font-bold border " +
        (valid ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30")
      }
    >
      {valid ? "VÁLIDO" : "INVÁLIDO"}
    </div>
  );
}

function useVerifyApi() {
  const [state, setState] = useState<VerifyResp | null>(null);
  const [loading, setLoading] = useState(false);
  const lastTokenRef = useRef<string | null>(null);

  async function verifyToken(token: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/verify?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await r.json()) as VerifyResp;
      lastTokenRef.current = token;
      setState(j);
    } catch (e: any) {
      setState({ ok: false, valid: false, reason: "network_error", error: e?.message });
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (lastTokenRef.current) await verifyToken(lastTokenRef.current);
  }

  return { state, loading, verifyToken, refresh, lastTokenRef };
}

function parseTokenFromText(text: string): string | null {
  try {
    // Si es una URL, buscamos ?token o ?t
    const u = new URL(text);
    return u.searchParams.get("token") || u.searchParams.get("t");
  } catch {
    // Si no es URL, puede venir el token directo
    return text?.trim() || null;
  }
}

function VerifyClient() {
  const sp = useSearchParams();
  const tokenFromUrl = useMemo(() => sp.get("token") || sp.get("t") || "", [sp]);

  const { state, loading, verifyToken, refresh, lastTokenRef } = useVerifyApi();

  // Cámara (html5-qrcode cargado dinámicamente)
  const [scanning, setScanning] = useState(false);
  const html5QrRef = useRef<any>(null);
  const readerDivId = "qr-reader";

  // Si viene token por URL, verificamos automáticamente
  useEffect(() => {
    if (tokenFromUrl) verifyToken(tokenFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

  async function startScanOnce() {
    // Import dinámico para evitar problemas en SSR
    const { Html5Qrcode } = await import("html5-qrcode");
    const html5QrCode = new Html5Qrcode(readerDivId, { verbose: false });
    html5QrRef.current = html5QrCode;

    setScanning(true);

    const onSuccess = async (decodedText: string) => {
      try {
        const token = parseTokenFromText(decodedText);
        // detenemos la cámara primero (para no “multiplicar” lecturas)
        await stopScan();
        if (token) {
          await verifyToken(token);
        }
      } catch {
        await stopScan();
      }
    };

    const onError = (_err: string) => {
      // ignoramos errores de decodificación por frame
    };

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onSuccess,
      onError
    );
  }

  async function stopScan() {
    try {
      const inst = html5QrRef.current;
      if (inst) {
        await inst.stop();
        await inst.clear();
      }
    } finally {
      html5QrRef.current = null;
      setScanning(false);
    }
  }

  const valid = !!(state && "valid" in state && state.valid === true);

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
        <header className="mb-4">
          <h1 className="text-xl font-semibold">Verificación de acceso</h1>
          <p className="text-sm opacity-70">Escaneá el QR del socio (1 lectura por vez)</p>
        </header>

        {/* Resultado */}
        <ResultBadge valid={valid} />

        {/* Cámara */}
        <div className="mt-4">
          {!scanning ? (
            <button onClick={startScanOnce} className="w-full py-2 rounded-xl border border-white/20">
              Escanear nuevo
            </button>
          ) : (
            <button onClick={stopScan} className="w-full py-2 rounded-xl border border-white/20">
              Detener cámara
            </button>
          )}
          {/* Contenedor del lector (solo visible al escanear) */}
          {scanning && <div id={readerDivId} className="mt-3 rounded-lg overflow-hidden" />}
        </div>

        {/* Detalles */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Tipo</span>
            <span className="font-medium">{(state as any)?.kind ?? "—"}</span>
          </div>

          <div className="flex justify-between">
            <span className="opacity-70">Usuario</span>
            <span className="font-mono text-xs truncate max-w-[60%]">{(state as any)?.user_id ?? "—"}</span>
          </div>

          <div className="flex justify-between">
            <span className="opacity-70">Nombre</span>
            <span className="font-medium truncate max-w-[60%]">{(state as any)?.member?.full_name ?? "—"}</span>
          </div>

          <div className="flex justify-between">
            <span className="opacity-70">Email</span>
            <span className="font-mono text-xs truncate max-w-[60%]">{(state as any)?.member?.email ?? "—"}</span>
          </div>

          <div className="flex justify-between">
            <span className="opacity-70">Membresía</span>
            <span
              className={
                "px-2 py-0.5 rounded-full text-xs font-semibold border " +
                ((state as any)?.membership?.active
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30")
              }
            >
              {(state as any)?.membership?.active ? "Activa" : "Inactiva"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="opacity-70">Válido hasta</span>
            <span className="font-medium">{fmt((state as any)?.membership?.valid_until)}</span>
          </div>

          <div className="flex justify-between">
            <span className="opacity-70">Expira token</span>
            <span className="font-medium">{fmt((state as any)?.expires_at)}</span>
          </div>

          {!valid && state && "reason" in state && state.reason && (
            <div className="mt-2 p-3 rounded-lg text-rose-200 bg-rose-500/10 border border-rose-500/30">
              Motivo: <span className="font-mono">{state.reason}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={refresh}
              disabled={!lastTokenRef.current || loading}
              className="flex-1 py-2 rounded-xl border border-white/20 disabled:opacity-50"
              title="Reverificar el último token leído"
            >
              {loading ? "Verificando…" : "Actualizar"}
            </button>
            <button
              onClick={startScanOnce}
              className="flex-1 py-2 rounded-xl border border-white/20"
              title="Leer otro QR (enciende la cámara y se apaga al leer)"
            >
              Escanear nuevo
            </button>
          </div>

          <p className="text-xs opacity-60 mt-2">La cámara se apaga automáticamente tras una lectura.</p>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VerifyClient />
    </Suspense>
  );
}
