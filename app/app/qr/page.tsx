"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type QrApiResp = {
  ok: boolean;
  token: string;
  expires_at: string;     // ISO
  link_for_qr: string;    // URL pública /verify?... que codificamos en el QR
  error?: string;
};

function toPublicVerifyUrl(link: string) {
  // Normaliza por si algún día viniera con /app/verify
  try {
    const u = new URL(link, window.location.origin);
    const origin = `${u.protocol}//${u.host}`;
    const t = u.searchParams.get("t") || "";
    const token = u.searchParams.get("token") || "";
    const qs = new URLSearchParams();
    if (t) qs.set("t", t);
    if (token) qs.set("token", token);
    return `${origin}/verify?${qs.toString()}`;
  } catch {
    return link;
  }
}

export default function MemberQRPage() {
  const router = useRouter();
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [link, setLink] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadQr = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      setImgSrc(null);

      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) {
        router.replace("/login");
        return;
      }

      // Pide (o reutiliza) un token efímero y nos da el link para codificar
      const res = await fetch("/api/membership/qr-token", {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: "no-store",
      });
      const json = (await res.json()) as Partial<QrApiResp>;

      if (!res.ok || !json?.ok || !json.link_for_qr) {
        setErr((json && "error" in json && json.error) || "No se pudo generar el QR");
        return;
      }

      const lnk = toPublicVerifyUrl(json.link_for_qr);
      setLink(lnk);
      setExpiresAt(json.expires_at || null);

      // 1) Intento local (sin dependencias externas) usando librería "qrcode" si está instalada
      try {
        const QRCode = (await import("qrcode")).default; // si no está instalada, salta al catch
        const dataUrl = await QRCode.toDataURL(lnk, { width: 480, margin: 1 });
        setImgSrc(dataUrl);
      } catch {
        // 2) Fallback rápido a un generador público de QR
        const u =
          "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" +
          encodeURIComponent(lnk);
        setImgSrc(u);
      }
    } catch (e: any) {
      setErr(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadQr();
  }, [loadQr]);

  const vence = expiresAt
    ? new Date(expiresAt).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen p-4 bg-neutral-950 text-neutral-100">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Mi QR de membresía</h1>
          <button
            onClick={() => router.push("/app/member")}
            className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Volver
          </button>
        </header>

        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
          {loading && (
            <div className="text-sm opacity-70">Generando QR…</div>
          )}

          {err && (
            <div className="text-sm p-2 rounded-lg bg-rose-500/15 border border-rose-500/30">
              {err}{" "}
              <button
                onClick={() => router.push("/app/member")}
                className="underline decoration-dotted"
              >
                Ir a membresía
              </button>
            </div>
          )}

          {!loading && !err && imgSrc && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={imgSrc}
                alt="QR de membresía"
                className="w-[320px] h-[320px] rounded-xl bg-white p-2"
              />
              <div className="text-xs opacity-80 text-center">
                Mostrá este QR en el comercio.{" "}
                {vence ? `Válido hasta las ${vence}.` : ""}
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={loadQr}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
                  title="Genera un token nuevo (o reutiliza el existente si aún está vigente)"
                >
                  Actualizar QR
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(link);
                  }}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
                  title="Copiar link que codifica este QR"
                >
                  Copiar link
                </button>
              </div>

              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline decoration-dotted opacity-70"
              >
                Ver link codificado (página pública de verificación)
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
