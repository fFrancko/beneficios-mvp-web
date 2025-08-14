"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type VerifyResponse = {
  result: "active" | "expired" | "invalid_token" | string;
  member?: { id: string; full_name: string | null };
  membership?: { status: string; valid_until: string | null };
  token?: { expires_at: string | null };
  now_iso?: string;
  error?: string;
  message?: string;
  note?: string;
};

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-semibold ${
        ok
          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
          : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
      }`}
    >
      {ok ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

// Utilidad: intenta extraer el token t de un texto cualquiera (URL, querystring, token crudo)
function extractTokenFromText(text: string): string | null {
  try {
    if (!text) return null;

    // Caso 1: es una URL completa con ?t=...
    if (text.includes("://")) {
      const u = new URL(text);
      const t = u.searchParams.get("t");
      if (t) return t;
    }

    // Caso 2: llega como "t=XXXX" o "t=XXX&..."
    if (text.startsWith("t=")) {
      const t = new URLSearchParams(text).get("t");
      if (t) return t;
    }

    // Caso 3: asumimos que es el token crudo
    if (text.length > 20 && text.split(".").length >= 3) {
      return text;
    }

    return null;
  } catch {
    return null;
  }
}

export default function ScanPage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastToken, setLastToken] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number>(0);
  const [lastResult, setLastResult] = useState<VerifyResponse | null>(null);

  const ok = lastResult?.result === "active";
  const name = lastResult?.member?.full_name ?? "Socio";
  const validUntil = lastResult?.membership?.valid_until
    ? new Date(lastResult.membership.valid_until)
    : null;
  const validUntilText = useMemo(
    () => (validUntil ? validUntil.toLocaleString() : "—"),
    [validUntil]
  );

  const tokenExp = lastResult?.token?.expires_at
    ? new Date(lastResult.token.expires_at)
    : null;
  const tokenExpText = useMemo(
    () => (tokenExp ? tokenExp.toLocaleString() : "—"),
    [tokenExp]
  );

  const hasBarcodeDetector =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  // Arranca cámara + loop de lectura
  useEffect(() => {
    let mounted = true;
    let raf = 0;
    let detector: any = null;

    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!mounted) return;

        setStream(s);
        const video = videoRef.current!;
        video.srcObject = s;

        await video.play();

        if (hasBarcodeDetector) {
          detector = new (window as any).BarcodeDetector({
            formats: ["qr_code"],
          });
        }

        setRunning(true);

        // Bucle de lectura
        const loop = async () => {
          if (!mounted) return;

          try {
            const v = videoRef.current;
            const c = canvasRef.current;

            if (v && v.videoWidth && v.videoHeight) {
              // Ajusta canvas al tamaño del video
              if (c && (c.width !== v.videoWidth || c.height !== v.videoHeight)) {
                c.width = v.videoWidth;
                c.height = v.videoHeight;
              }

              if (detector) {
                const codes = await detector.detect(v);
                if (codes?.length) {
                  const raw = (codes[0].rawValue || "").trim();
                  if (raw) await onRawText(raw);
                }
              }
            }
          } catch {
            // No interrumpimos el bucle por errores transitorios
          }

          raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        setError(
          e?.message ||
            "No se pudo abrir la cámara. Revisá permisos o probá otra app."
        );
      }
    }

    start();

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      setRunning(false);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Procesa el texto crudo leído por el detector (URL, token, etc.)
  async function onRawText(text: string) {
    // Debounce muy simple para no disparar mil requests
    const now = Date.now();
    if (now - lastScanAt < 600) return;

    const t = extractTokenFromText(text);
    if (!t) return;

    if (t === lastToken && now - lastScanAt < 1500) return;

    setLastToken(t);
    setLastScanAt(now);

    if (navigator.vibrate) navigator.vibrate(50);

    try {
      const res = await fetch(`/api/verify?t=${encodeURIComponent(t)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as VerifyResponse;
      setLastResult(json);
    } catch {
      setLastResult({ result: "error", message: "No se pudo verificar" });
    }
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;

    const caps: any = (track as any).getCapabilities?.();
    if (!caps?.torch) {
      alert("Este dispositivo no soporta linterna por software.");
      return;
    }
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch {
      alert("No se pudo controlar la linterna.");
    }
  }

  function clearLast() {
    setLastResult(null);
    setLastToken(null);
    setLastScanAt(0);
  }

  async function copySummary() {
    if (!lastResult) return;
    const lines = [
      `Estado: ${ok ? "ACTIVO" : "INACTIVO"}`,
      `Cliente: ${name ?? "-"}`,
      `Válido hasta: ${validUntilText}`,
      `Exp. del token: ${tokenExpText}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("Copiado ✅");
    } catch {
      alert("No se pudo copiar");
    }
  }

  // Fallback: subir foto del QR y detectar
  async function onPickFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;

    try {
      const bmp = await createImageBitmap(file);
      if (hasBarcodeDetector) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
        const codes = await detector.detect(bmp);
        const raw = codes?.[0]?.rawValue || "";
        if (raw) await onRawText(raw);
        else alert("No se detectó un QR en la imagen.");
      } else {
        alert("Este navegador no soporta detección local de QR.");
      }
    } catch (e: any) {
      alert(e?.message || "No se pudo procesar la imagen.");
    } finally {
      ev.target.value = "";
    }
  }

  return (
    <div className="min-h-screen relative text-white bg-black">
      {/* Video en vivo */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay con viñeta y marco */}
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[80vw] max-w-[420px] aspect-square rounded-2xl border-2 border-white/40 shadow-[0_0_0_300vmax_rgba(0,0,0,0.35)]" />
      </div>

      {/* Barra superior: volver + torch */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/verify")}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20"
        >
          Volver
        </button>

        <div className="flex items-center gap-2">
          <label className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20 cursor-pointer">
            Subir foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickFile}
            />
          </label>
          <button
            onClick={toggleTorch}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20"
            title="Linterna"
          >
            {torchOn ? "Linterna: ON" : "Linterna: OFF"}
          </button>
        </div>
      </div>

      {/* Error de cámara */}
      {error && (
        <div className="absolute left-0 right-0 top-14 mx-auto w-[92%] max-w-xl p-3 rounded-xl bg-rose-900/60 border border-rose-500/30 text-sm">
          {error}
        </div>
      )}

      {/* Tarjeta de último resultado (no detiene la cámara) */}
      {lastResult && (
        <div className="absolute left-0 right-0 bottom-4 mx-auto w-[92%] max-w-md rounded-2xl p-4 border border-white/15 bg-black/60 backdrop-blur shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-80">MULTICLASICOS — Resultado</div>
            <StatusBadge ok={ok} />
          </div>

          <div className="text-lg font-semibold">{name}</div>

          <div className="text-sm opacity-80 space-y-1 mt-1">
            <div>
              <span className="opacity-70">Válido hasta: </span>
              <span className="font-medium">{validUntilText}</span>
            </div>
            <div>
              <span className="opacity-70">Token expira: </span>
              <span className="font-medium">{tokenExpText}</span>
            </div>
          </div>

          {lastResult.note ? (
            <div className="mt-2 text-xs opacity-70 italic">{lastResult.note}</div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={clearLast}
              className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Limpiar
            </button>
            <button
              onClick={copySummary}
              className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20 col-span-2"
            >
              Copiar resultado
            </button>
          </div>

          <p className="mt-2 text-[11px] opacity-60">
            La cámara permanece abierta. Acercá el próximo QR para validar.
          </p>
        </div>
      )}

      {/* Pie: estado de la cámara */}
      <div className="absolute left-0 right-0 bottom-2 mx-auto w-[92%] max-w-md text-center text-[11px] opacity-60">
        {running ? "Cámara activa" : "Cargando cámara…"}
      </div>
    </div>
  );
}
