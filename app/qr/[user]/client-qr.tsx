"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { issueQR } from "./actions";

type Props = {
  userId: string;
  initialSrc: string;
  initialVerifyUrl: string;
  initialExpiresAt: string; // ISO
};

function fmt(msLeft: number) {
  const clamped = Math.max(0, msLeft);
  const m = Math.floor(clamped / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ClientQR({
  userId,
  initialSrc,
  initialVerifyUrl,
  initialExpiresAt,
}: Props) {
  const [src, setSrc] = useState(initialSrc);
  const [verifyUrl, setVerifyUrl] = useState(initialVerifyUrl);
  const [expiresAt, setExpiresAt] = useState<Date>(new Date(initialExpiresAt));

  const [left, setLeft] = useState<number>(() => expiresAt.getTime() - Date.now());
  const [isPending, startTransition] = useTransition();
  const lastClickRef = useRef<number>(0);

  // Recalcular cuenta atrás
  useEffect(() => {
    const id = setInterval(() => {
      setLeft(expiresAt.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mmss = useMemo(() => fmt(left), [left]);

  const canClick = !isPending;

  // Regenerar “on demand” (con anti‑spam de 750ms)
  const handleRegenerate = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 750 || !canClick) return; // throttle simple
    lastClickRef.current = now;

    startTransition(async () => {
      try {
        const next = await issueQR(userId);
        setSrc(next.src);
        setVerifyUrl(next.verifyUrl);
        setExpiresAt(new Date(next.expiresAt));
        setLeft(new Date(next.expiresAt).getTime() - Date.now());
      } catch (e) {
        alert("No se pudo regenerar el QR. Intenta de nuevo.");
      }
    });
  }, [userId, canClick, startTransition]);

  return (
    <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
      <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

      <div className="bg-white p-3 rounded-xl inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="QR de verificación" className="w-full h-auto rounded" />
      </div>

      <div className="mt-4 text-xs opacity-80 break-words">
        Apunta a: <code className="opacity-90">{verifyUrl}</code>
      </div>

      <div className="mt-3 text-sm opacity-90">
        Expira en: <span className="font-mono">{mmss}</span>
      </div>

      <div className="mt-5 flex gap-2 justify-center">
        <button
          onClick={handleRegenerate}
          disabled={!canClick}
          className={`px-4 py-2 rounded-xl text-sm font-medium border border-white/20
            ${canClick ? "bg-white/10 hover:bg-white/15" : "bg-white/5 opacity-50 cursor-not-allowed"}`}
        >
          {isPending ? "Generando…" : "Regenerar"}
        </button>

        <a
          href="/"
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
        >
          Inicio
        </a>
      </div>

      <p className="mt-3 text-[11px] opacity-60">
        El QR expira en 5 minutos. Podés regenerarlo cuando quieras.
      </p>
    </div>
  );
}
