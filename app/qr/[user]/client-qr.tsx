"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  userId: string;
  initialVerifyUrl: string;
  initialQrDataUrl: string;
  initialExpiresAtISO: string;
  minRegenerateDelayMs?: number; // anti‑spam: retardo mínimo entre regeneraciones
};

export default function ClientQR({
  userId,
  initialVerifyUrl,
  initialQrDataUrl,
  initialExpiresAtISO,
  minRegenerateDelayMs = 800,
}: Props) {
  const [verifyUrl, setVerifyUrl] = useState(initialVerifyUrl);
  const [qrDataUrl, setQrDataUrl] = useState(initialQrDataUrl);
  const [expiresAtISO, setExpiresAtISO] = useState(initialExpiresAtISO);
  const [isBusy, setIsBusy] = useState(false);

  // anti‑spam simple
  const lastRegenRef = useRef<number>(0);

  // contador mm:ss
  const msLeft = Math.max(0, new Date(expiresAtISO).getTime() - Date.now());
  const [left, setLeft] = useState<number>(msLeft);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(Math.max(0, new Date(expiresAtISO).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAtISO]);

  const mmss = useMemo(() => {
    const s = Math.floor(left / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [left]);

  // Regenerar token/QR llamando a la API del servidor (no pasar funciones del server).
  async function handleRegenerate() {
    if (isBusy) return;
    const now = Date.now();
    if (now - lastRegenRef.current < minRegenerateDelayMs) return;

    try {
      setIsBusy(true);
      lastRegenRef.current = now;

      const res = await fetch(`/api/membership/generate-token?user=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        alert(`No se pudo regenerar el QR. Intenta de nuevo.\n\n${txt}`);
        return;
      }

      // La API debe devolver: { token, verifyUrl, qrDataUrl, expiresAtISO }
      const { token, verifyUrl: vurl, qrDataUrl: qurl, expiresAtISO: newExp } =
        await res.json();

      setVerifyUrl(vurl);
      setQrDataUrl(qurl);
      setExpiresAtISO(newExp);
    } catch (e: any) {
      alert(`No se pudo regenerar el QR. Intenta de nuevo.\n\n${e?.message ?? e}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="bg-white p-3 rounded-xl inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
      </div>

      <div className="mt-4 text-xs opacity-80 break-words">
        Apunta a: <code className="opacity-90">{verifyUrl}</code>
      </div>

      <div className="mt-2 text-sm opacity-80">
        Expira en: <span className="tabular-nums">{mmss}</span>
      </div>

      <div className="mt-4 flex gap-2 justify-center">
        <button
          onClick={handleRegenerate}
          disabled={isBusy}
          className="px-4 py-2 rounded-xl text-sm font-medium
                     bg-white/10 hover:bg-white/15 border border-white/20
                     disabled:opacity-60"
        >
          {isBusy ? "Generando..." : "Regenerar"}
        </button>
      </div>
    </>
  );
}
