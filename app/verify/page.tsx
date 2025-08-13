'use client';

import { useEffect, useMemo, useState } from 'react';

type VerifyResp =
  | { ok?: true; result: 'ACTIVE' | 'EXPIRED' | 'active' | 'expired'; valid_until: string | null }
  | { ok?: false; result: 'INVALID_TOKEN' | 'invalid_token' };

function fmt(dt: string | null) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function VerifyPage() {
  const [status, setStatus] = useState<'ACTIVE' | 'EXPIRED' | 'INVALID' | 'LOADING'>('LOADING');
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [bgIndex, setBgIndex] = useState(0);

  const colors = useMemo(
    () => [
      'from-zinc-900 via-zinc-800 to-zinc-900',
      'from-slate-900 via-slate-800 to-slate-900',
      'from-neutral-900 via-neutral-800 to-neutral-900',
      'from-stone-900 via-stone-800 to-stone-900',
    ],
    []
  );

  useEffect(() => {
    // rotar fondo cada 60s (anti-screenshot viejo)
    const id = setInterval(() => setBgIndex((i) => (i + 1) % colors.length), 60_000);
    return () => clearInterval(id);
  }, [colors.length]);

  async function load() {
    setStatus('LOADING');
    const url = new URL(window.location.href);
    const t = url.searchParams.get('t');
    if (!t) {
      setStatus('INVALID');
      setValidUntil(null);
      return;
    }
    try {
      const res = await fetch(`/api/verify?t=${encodeURIComponent(t)}`, { cache: 'no-store' });
      const data: VerifyResp = await res.json();
      if ('result' in data) {
        const r = (data.result || '').toString().toUpperCase();
        if (r === 'ACTIVE') setStatus('ACTIVE');
        else if (r === 'EXPIRED') setStatus('EXPIRED');
        else setStatus('INVALID');
        setValidUntil('valid_until' in data ? data.valid_until ?? null : null);
      } else {
        setStatus('INVALID');
        setValidUntil(null);
      }
    } catch {
      setStatus('INVALID');
      setValidUntil(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = status === 'ACTIVE';
  const isExpired = status === 'EXPIRED';
  const isInvalid = status === 'INVALID';
  const isLoading = status === 'LOADING';

  return (
    <div
      className={`min-h-screen w-full bg-gradient-to-br ${colors[bgIndex]} text-white flex items-center justify-center p-4`}
    >
      <div className="w-full max-w-md">
        <div
          className={`rounded-2xl p-6 shadow-2xl border-2 ${
            isActive
              ? 'bg-emerald-950/60 border-emerald-500'
              : isExpired
              ? 'bg-rose-950/60 border-rose-500'
              : isInvalid
              ? 'bg-amber-950/60 border-amber-500'
              : 'bg-zinc-900/60 border-zinc-600'
          }`}
        >
          <div className="text-center">
            <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Verificación</div>

            <div
              className={`text-5xl font-extrabold tracking-widest mb-2 ${
                isActive ? 'text-emerald-400' : isExpired ? 'text-rose-400' : isInvalid ? 'text-amber-400' : 'text-zinc-300'
              }`}
            >
              {isLoading ? 'VERIFICANDO…' : isActive ? 'ACTIVO' : isExpired ? 'VENCIDO' : 'TOKEN INVÁLIDO'}
            </div>

            <div className="text-sm opacity-80">
              {isLoading ? 'Espere un momento…' : `Válido hasta: ${fmt(validUntil)}`}
            </div>

            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={load}
                className="rounded-xl px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
              >
                Actualizar
              </button>
              <a
                href="/"
                className="rounded-xl px-4 py-2 text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
              >
                Inicio
              </a>
            </div>

            <div className="mt-4 text-[11px] opacity-60">
              Consejo: verifique que el fondo cambie cada minuto (evita capturas antiguas).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
