"use client";

import { useEffect, useState } from "react";

export default function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    // Al cambiar expiresAt (por "Regenerar"), reseteamos el timer
    setLeft(new Date(expiresAt).getTime() - Date.now());

    const id = setInterval(() => {
      setLeft((prev) => {
        const next = prev - 1000;
        return next < 0 ? 0 : next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="mt-3 text-sm opacity-80">
      Expira en: <span className="tabular-nums">{mm}:{ss}</span>
    </div>
  );
}
