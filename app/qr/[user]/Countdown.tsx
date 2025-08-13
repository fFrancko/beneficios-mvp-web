// app/qr/[user]/Countdown.tsx
"use client";

import { useEffect, useState } from "react";

export default function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number>(
    () => new Date(expiresAt).getTime() - Date.now()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left < 0) {
    return (
      <div className="mt-3 text-rose-300">
        Expirado. Pulsa <b>Regenerar</b> para obtener un QR nuevo.
      </div>
    );
  }

  const total = Math.max(0, left);
  const mm = String(Math.floor(total / 1000 / 60)).padStart(2, "0");
  const ss = String(Math.floor((total / 1000) % 60)).padStart(2, "0");

  return (
    <div className="mt-3 text-emerald-300">
      Expira en <span className="tabular-nums font-semibold">{mm}:{ss}</span>
    </div>
  );
}