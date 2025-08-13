// app/qr/[user]/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="max-w-md w-full rounded-2xl p-6 border border-rose-500/50 bg-rose-950/40">
        <h1 className="text-xl font-semibold mb-2">QR — Error</h1>
        <p className="opacity-80">
          Ocurrió un error renderizando esta página. {error?.digest && (
            <>Digest: <code>{error.digest}</code></>
          )}
        </p>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/20"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
