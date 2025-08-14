"use client";

import { useState, useEffect, useRef } from "react";

type QRData = {
  qrDataUrl: string;
  verifyUrl: string;
  expiresAt: string;
};

export default function ClientQR({
  initialData,
  regenerate,
}: {
  initialData: QRData;
  regenerate: () => Promise<QRData>;
}) {
  const [data, setData] = useState<QRData>(initialData);
  const [timeLeft, setTimeLeft] = useState<number>(
    new Date(initialData.expiresAt).getTime() - Date.now()
  );
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(new Date(data.expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [data.expiresAt]);

  const minutes = Math.max(0, Math.floor(timeLeft / 60000));
  const seconds = Math.max(0, Math.floor((timeLeft % 60000) / 1000));

  async function handleRegenerate() {
    // anti‑spam ~500ms
    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
    }, 500);

    setIsLoading(true);
    try {
      const newQR = await regenerate();
      setData(newQR);
      setTimeLeft(new Date(newQR.expiresAt).getTime() - Date.now());
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
      <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

      <div className="bg-white p-3 rounded-xl inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
      </div>

      <div className="mt-4 text-xs opacity-80 break-words">
        Apunta a: <code className="opacity-90">{data.verifyUrl}</code>
      </div>

      <p className="mt-2 text-lg font-semibold">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </p>

      <div className="mt-5 flex gap-2 justify-center">
        <button
          onClick={handleRegenerate}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20 disabled:opacity-50"
        >
          {isLoading ? "Generando..." : "Regenerar"}
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
        >
          Inicio
        </a>
      </div>

      <p className="mt-3 text-[11px] opacity-60">
        El QR expira en 5 minutos. Puedes regenerarlo en cualquier momento.
      </p>
    </div>
  );
}
