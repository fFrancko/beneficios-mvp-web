// app/qr/[user]/page.tsx
import * as jose from "jose";
import QRCode from "qrcode";

type Params = { user: string };

// Validación sencilla de UUID
function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

// Server Component: firma el token y renderiza el QR (no expone secretos)
export default async function QRPage({ params }: { params: Params }) {
  const userId = params.user;

  if (!userId || !isUUID(userId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
        <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
          <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
          <p className="opacity-80">El parámetro <code>user</code> no es un UUID válido.</p>
        </div>
      </div>
    );
  }

  // 1) firmar token (expira en 5 minutos)
  const expMinutes = 5;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${expMinutes}m`)
    .sign(secret);

  // 2) armar URL de verificación
  const base = process.env.BASE_URL || "";
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;

  // 3) generar imagen QR (DataURL)
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    scale: 8,
  });

  // 4) fecha/hora de expiración (para el contador)
  const expiresAt = new Date(Date.now() + expMinutes * 60_000);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
        <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

        <div className="bg-white p-3 rounded-xl inline-block">
          {/* Imagen del QR */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
        </div>

        <div className="mt-4 text-xs opacity-80 break-words">
          Apunta a: <code className="opacity-90">{verifyUrl}</code>
        </div>

        <Countdown expiresAt={expiresAt.toISOString()} />

        <div className="mt-5 flex gap-2 justify-center">
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
          >
            Regenerar
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
    </div>
  );
}

// --- Componente cliente para mostrar el contador ---
"use client";
import { useEffect, useState } from "react";

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number>(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(expiresAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left <= 0) {
    return <div className="mt-3 text-rose-400 font-semibold">QR vencido</div>;
  }

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="mt-3 text-emerald-400 font-semibold">
      Expira en: {mm}:{ss}
    </div>
  );
}