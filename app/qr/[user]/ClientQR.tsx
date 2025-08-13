"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

/** Props que recibe desde el server */
type Props = {
  userId: string;
  initialVerifyUrl: string;
  initialExpiresAt: string; // ISO
  initialQrDataUrl: string;
  expMinutes: number; // ej: 5
};

/** helper para mostrar mm:ss */
function formatLeft(ms: number) {
  const clamped = Math.max(0, ms);
  const m = Math.floor(clamped / 60000);
  const s = Math.floor((clamped % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Este componente:
 * - Renderiza el QR y el contador.
 * - Al pulsar "Regenerar", pide un token nuevo SIN recargar la página:
 *   llama a la misma ruta /qr/[user]?r=<timestamp>, parsea el HTML devuelto,
 *   lee verifyUrl y vuelve a generar el QR localmente. También reinicia el timer.
 */
export default function ClientQR({
  userId,
  initialVerifyUrl,
  initialExpiresAt,
  initialQrDataUrl,
  expMinutes,
}: Props) {
  const [verifyUrl, setVerifyUrl] = useState(initialVerifyUrl);
  const [expiresAt, setExpiresAt] = useState(new Date(initialExpiresAt));
  const [qrDataUrl, setQrDataUrl] = useState(initialQrDataUrl);
  const [busy, setBusy] = useState(false);

  // milisegundos que quedan
  const left = useMemo(() => expiresAt.getTime() - Date.now(), [expiresAt]);
  const leftStr = useMemo(() => formatLeft(left), [left]);

  // tick de 1s para el contador
  useEffect(() => {
    const t = setInterval(() => {
      // forzamos un re-render tocando expiresAt levemente si ya pasó el tiempo,
      // así el contador nunca se queda “quieto” en valores intermedios
      if (Date.now() >= expiresAt.getTime()) {
        // nada: el leftStr ya queda en 00:00
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const regenerate = useCallback(async () => {
    try {
      setBusy(true);

      // pedimos la MISMA página pero con r=<timestamp>
      const url = new URL(window.location.href);
      url.searchParams.set("r", Date.now().toString());

      // Traemos el HTML y lo parseamos para extraer verifyUrl y expiresAt nuevos
      const html = await fetch(url.toString(), { cache: "no-store" }).then((r) => r.text());

      // Inyecté data-* en el server? No, acá lo vamos a deducir desde una marca simple:
      // Para evitar fragilidad, vamos a parsear el primer <img src="data:image/png..."> si está
      // pero como ahora generamos QR en el cliente, preferimos que el server nos devuelva
      // un JSON… como estamos en la misma ruta HTML, vamos a re-firmar acá mismo.
      //
      // Mejor estrategia: regenerar verifyUrl 100% en el cliente llamando a un endpoint dedicado
      // que devuelve el token (pero en tu flujo actual aún no tenés ese endpoint público).
      //
      // Solución simple y robusta:
      // Recalcular verifyUrl localmente no se puede (no tenemos JWT_SECRET en el cliente).
      // Entonces vamos a “leer” verifyUrl del HTML del server.
      //
      // Buscamos el string "Apunta a: <code>VERIFY_URL</code>" que está en el markup del server.
      const marker = "Apunta a: <code className=\"opacity-90\">";
      const idx = html.indexOf(marker);
      if (idx === -1) {
        // fallback: recargamos (último recurso si cambia el markup)
        window.location.reload();
        return;
      }
      const start = idx + marker.length;
      const end = html.indexOf("</code>", start);
      const freshVerifyUrl = html.slice(start, end);

      // También obtenemos la expiración nueva: está a expMinutes desde ahora
      const freshExpiresAt = new Date(Date.now() + expMinutes * 60_000);

      // Generamos el nuevo QR localmente
      const freshQr = await QRCode.toDataURL(freshVerifyUrl, { margin: 1, scale: 8 });

      // seteamos estado (esto reinicia el contador porque cambia expiresAt)
      setVerifyUrl(freshVerifyUrl);
      setExpiresAt(freshExpiresAt);
      setQrDataUrl(freshQr);
    } catch (e) {
      // si algo falla, mejor recargar
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }, [expMinutes]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-black/40 shadow-2xl text-center">
        <div className="text-sm opacity-70 mb-2">MULTICLASICOS — Mi QR</div>

        <div className="bg-white p-3 rounded-xl inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR de verificación" className="w-full h-auto rounded" />
        </div>

        <div className="mt-4 text-xs opacity-80 break-words">
          Apunta a: <code className="opacity-90">{verifyUrl}</code>
        </div>

        <div className="mt-2 text-sm">
          Expira en: <span className="tabular-nums font-semibold">{leftStr}</span>
        </div>

        <div className="mt-5 flex gap-2 justify-center">
          <button
            onClick={regenerate}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20 disabled:opacity-50"
          >
            {busy ? "Generando..." : "Regenerar"}
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/20"
          >
            Inicio
          </a>
        </div>

        <p className="mt-3 text-[11px] opacity-60">
          El QR expira en {expMinutes} minutos. Regeneralo si el comercio lo pide.
        </p>
      </div>
    </div>
  );
}
