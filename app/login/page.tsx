"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // ✅ un solo cliente (sessionStorage)

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true); // evita redirecciones prematuras

  // Si ya hay sesión, mandamos a /app/member
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) {
        router.replace("/app/member");
      } else {
        setChecking(false); // mostrar el formulario
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function signIn() {
    try {
      setLoading(true);
      setMsg(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      router.replace("/app/member");
    } catch (e: any) {
      setMsg(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    try {
      setLoading(true);
      setMsg(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/app/member` },
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg(
        "Te enviamos un correo para confirmar la cuenta. Abrí el link y luego volvé a iniciar sesión."
      );
    } catch (e: any) {
      setMsg(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 text-neutral-400">
        Cargando…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900/40 p-5 text-neutral-100">
        <h1 className="text-xl font-semibold mb-4">Ingresar</h1>

        <label className="block text-sm mb-1 opacity-80">Email</label>
        <input
          type="email"
          className="w-full mb-3 rounded-xl bg-neutral-800 border border-white/10 p-2 outline-none"
          placeholder="tucorreo@mail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block text-sm mb-1 opacity-80">Contraseña</label>
        <input
          type="password"
          className="w-full mb-4 rounded-xl bg-neutral-800 border border-white/10 p-2 outline-none"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={signIn}
          disabled={loading || !email || !password}
          className="w-full py-2 rounded-xl border border-white/20 disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Iniciar sesión"}
        </button>

        <div className="text-center my-3 text-xs opacity-60">ó</div>

        <button
          onClick={signUp}
          disabled={loading || !email || !password}
          className="w-full py-2 rounded-xl border border-white/20 disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Crear cuenta"}
        </button>

        {msg && (
          <div className="mt-3 text-sm p-2 rounded-lg bg-neutral-800 border border-white/10">
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
