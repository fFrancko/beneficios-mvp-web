// app/qr/[user]/Countdown.tsx
"use client";

import { useEffect, useState } from "react";

export default function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number>(() => {
    const t = new Date(expiresAt).getTime() - Date.now();
    return t > 0 ? t : 0;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((prev) => {
        const next = prev - 1000;
        return next > 0 ? next : 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mm = Math.floor(left / 60000)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor((left % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="mt-3 text-sm opacity-80">
      Expira en:{" "}
      <span className="font-mono tabular-nums">
        {mm}:{ss}
      </span>
    </div>
  );
}
