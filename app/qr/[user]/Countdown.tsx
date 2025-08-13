"use client";
import { useEffect, useState } from "react";

export default function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number>(() => new Date(expiresAt).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(expiresAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left <= 0) return <div className="mt-3 text-rose-400 font-semibold">QR vencido</div>;

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, "0");
  return <div className="mt-3 text-emerald-400 font-semibold">Expira en: {mm}:{ss}</div>;
}
