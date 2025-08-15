// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white">
      <div className="mx-auto max-w-md px-5 pt-14 pb-20">
        {/* Header / Marca */}
        <header className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl">
            🚘
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">MULTICLASICOS</h1>
            <p className="text-sm text-zinc-400">Eventos y comunidad de autos clásicos</p>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-10">
          <h2 className="text-3xl font-extrabold">
            Beneficios y eventos en un solo lugar
          </h2>
          <p className="mt-3 text-zinc-400">
            Entrá desde tu celular y navegá fácil: próximos eventos, redes y área de
            miembros.
          </p>
        </section>

        {/* Botones principales */}
        <nav className="mt-10 grid gap-4">
          <Link
            href="/eventos"
            className="block rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg font-semibold hover:bg-white/10 active:scale-[0.99] transition"
          >
            PROXIMOS EVENTOS
            <span className="block text-sm font-normal text-zinc-400">
              Calendario y detalles
            </span>
          </Link>

          <Link
            href="/redes"
            className="block rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg font-semibold hover:bg-white/10 active:scale-[0.99] transition"
          >
            REDES SOCIALES
            <span className="block text-sm font-normal text-zinc-400">
              Instagram, Facebook, YouTube
            </span>
          </Link>

          <Link
            href="/login"
            className="block rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-4 text-lg font-semibold hover:bg-emerald-500/25 active:scale-[0.99] transition"
          >
            MIEMBROS
            <span className="block text-sm font-normal text-emerald-300">
              Iniciar sesión / Registrarse
            </span>
          </Link>
        </nav>

        {/* Footer simple */}
        <footer className="mt-14 border-t border-white/10 pt-6 text-xs text-zinc-500">
          © {new Date().getFullYear()} MULTICLASICOS — Hecho con Next.js
        </footer>
      </div>
    </main>
  );
}
