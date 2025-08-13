"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { expiresAt: string; onExpired?: () => void };

function fmt(ms: number) {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function Countdown({ expiresAt, onExpired }: Props) {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [left, setLeft] = useState<number>(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(prev => {
        const next = Math.max(0, target - Date.now());
        if (prev > 0 && next === 0) onExpired?.();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpired]);

  return <div className="mt-2 text-sm opacity-80">Expira en: <b>{fmt(left)}</b></div>;
}
