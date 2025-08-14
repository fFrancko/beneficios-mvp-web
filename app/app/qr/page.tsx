"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

type TokenOk = {
  ok: true;
  token: string;
  expires_at: string;   // ISO
  ttl_sec: number;      // ej: 120
  link_for_qr: string;  // URL dentro del QR
  now_iso: string;      // reloj del server
};
type TokenErr = { ok: false; error: string };

export default function QRPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [loading, setLoading] = useState(true);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [serverNowIso, setServerNowIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  async function fetchNewToken() {
    setLoading(true);
    setError(null);
    setImgDataUrl(null);

    try {
      const { data } = await supabase.auth.getSession();
      const at = data.session?.access_token;
      if (!at) {
        router.replace("/login");
        return;
      }

      const r = await fetch("/api/membership/qr-token", {
        headers: { Authorization: `Bearer ${at}` },
      });
      const j = (await r.json()) as TokenOk | TokenErr;

      if (!r.ok || !("ok" in j) || j.ok !== true) {
        const code = (j as TokenErr)?.error || "error_desconocido";
        if (code === "membership_inactive_or_expired") {
          setError("Tu membresía no está activa o ya venció.");
        } else if (code === "memberships_missing" || code === "qr_tokens_missing") {
          setError("Falta crear tablas/políticas en Supabase.");
        } else if (code === "no_token" || code === "unauthorized") {
          setError("Sesión inválida. Volvé a iniciar sesión.");
        } else {
          setError(`No se pudo generar el QR (${code}).`);
        }
        return;
      }

      setLink(j.link_for_qr);
      setExpiresAt(j.expires_at);
      setServerNowIso(j.now_iso);

      const dataUrl = await QRCode.toDataURL(j.link_for_qr, {
        margin: 1,
        width: 1024,
        errorCorrectionLevel: "M",
      });
      setImgDataUrl(dataUrl);
    } catch (e: any) {
      setError(e?.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNewToken();
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const left = new Date(expiresAt).getTime() - Date.now();
      if (left <= 0) {
        fetchNewToken(); // expira → regenerar
      } else {
        setServerNowIso((s) => s ?? new Date().toISOString()); // fuerza re-render p/contador
      }
    }, 1000) as unknown as number;

    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const secondsLeft = (() => {
    if (!expiresAt) return null;
    const left = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(left / 1000));
  })();

  function fmtTimeShort(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <main className="min-h-screen p-4 bg-neutral-950 text-neutral-100">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Mi QR</h1>
            <p className="text-sm opacity-70">Mostralo en el puesto para validar tu acceso</p>
          </div>
          <button
            onClick={() => router.push("/app/member")}
            className="px-3 py-2 rounded-xl border border-white/20 text-sm"
          >
            Volver
          </button>
        </header>

        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
          {error && (
            <div className="mb-3 text-sm p-3 rounded-lg bg-rose-500/15 border border-rose-500/30">
              {error}
            </div>
          )}

          {loading && <div className="mb-3 text-sm opacity-70">Generando QR…</div>}

          {imgDataUrl && (
            <div className="w-full flex items-center justify-center">
              <img
                src={imgDataUrl}
                alt="QR de verificación"
                className="w-full max-w-xs sm:max-w-sm rounded-xl bg-white p-2"
                draggable={false}
              />
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="opacity-70">Expira</span>
              <span className="font-medium">{fmtTimeShort(expiresAt)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="opacity-70">Tiempo restante</span>
              <span className="font-semibold">
                {typeof secondsLeft === "number" ? `${secondsLeft}s` : "—"}
              </span>
            </div>

            {link && (
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="w-full py-2 rounded-xl border border-white/20"
                title="Copiar enlace del QR (fallback)"
              >
                Copiar enlace del QR
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={fetchNewToken} className="flex-1 py-2 rounded-xl border border-white/20">
                Refrescar QR
              </button>
              <button
                onClick={() => document.documentElement.requestFullscreen?.()}
                className="flex-1 py-2 rounded-xl border border-white/20"
              >
                Pantalla completa
              </button>
            </div>

            <p className="text-xs opacity-60 mt-2">
              Si el QR no se ve bien, usá “Copiar enlace” y mostralo al staff.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
