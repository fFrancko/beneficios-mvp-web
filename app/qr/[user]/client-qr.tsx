"use client";

import { useEffect, useState } from "react";

// Countdown simple que reinicia cuando cambia expiresAt
function Countdown({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [left, setLeft] = useState<number>(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const mmss = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="mt-4 text-sm">
      <span className="opacity-80">Expira en: </span>
      <span className="font-semibold">{mmss}</span>
    </div>
  );
}

type Props = {
  initial: {
    verifyUrl: string;
    qrDataUrl: string;
    expiresAt: string;
  };
};

// Componente cliente que maneja el estado del QR y el contador
export default function ClientQR({ initial }: Props) {
  const [verifyUrl, setVerifyUrl] = useState(initial.verifyUrl);
  const [qrDataUrl, setQrDataUrl] = useState(initial.qrDataUrl);
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [loading, setLoading] = useState(false);

  async function regenerate() {
    try {
      setLoading(true);
      // 1) Pedimos un token nuevo al backend
      const res = await fetch("/api/membership/generate-token", { method: "POST" });
      if (!res.ok) throw new Error("No se pudo generar el token");
      const json = await res.json() as { token: string; expSeconds?: number; baseUrl?: string };

      // 2) Armamos la nueva URL de verificación
      const base = json.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "";
      const newVerify = `${base}/verify?t=${encodeURIComponent(json.token)}`;

      // 3) Generamos el PNG del QR en el cliente
      const { toDataURL } = await import("qrcode");
      const newQr = await toDataURL(newVerify, { margin: 1, scale: 8 });

      // 4) Calculamos nueva expiración (fallback 300s = 5min)
      const secs = json.expSeconds ?? 300;
      const newExp = new Date(Date.now() + secs * 1000).toISOString();

      // 5) Actualizamos estado (esto reinicia el Countdown)
      setVerifyUrl(newVerify);
      setQrDataUrl(newQr);
      setExpiresAt(newExp);
    } catch (e) {
      console.error(e);
      alert("No se pudo regenerar el QR. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
      <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

      <div className="bg-white p-3 rounded-xl inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
      </div>

      <div className="mt-4 text-xs opacity-80 break-words">
        Apunta a: <code className="opacity-90">{verifyUrl}</code>
      </div>

      <Countdown expiresAt={expiresAt} />

      <div className="mt-5 flex gap-2 justify-center">
        <button
          onClick={regenerate}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20 disabled:opacity-50"
        >
          {loading ? "Generando..." : "Regenerar"}
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
        >
          Inicio
        </a>
      </div>

      <p className="mt-3 text-[11px] opacity-60">
        El QR expira en 5 minutos. Regeneralo si el comercio lo pide.
      </p>
    </div>
  );
}
