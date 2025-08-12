"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente Supabase (lado cliente)
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function TestSupabasePage() {
  const [result, setResult] = useState<string>("");

  // Test 1: ping directo a Auth (no depende de tablas)
  async function testAuthPing() {
    setResult("Probando conexión básica...");
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}` },
      });
      if (res.ok) {
        setResult("✅ Conexión básica OK (Auth respondió 200).");
      } else {
        setResult(`⚠️ Conexión llegó pero respuesta no OK: ${res.status}`);
      }
    } catch (e: any) {
      setResult(`❌ Error de red: ${e?.message || e}`);
    }
  }

  // Test 2: query a una tabla típica del roadmap ("profiles")
  // Si no existe aún, igual confirma que llegamos a la BD (dará error 'tabla no existe').
  async function testProfilesQuery() {
    setResult("Consultando tabla 'profiles'...");
    const { data, error } = await supabase.from("profiles").select("*").limit(1);
    if (error) {
      // 42P01 = undefined_table (tabla no creada)
      if ((error as any).code === "42P01") {
        setResult("✅ Conectado a la BD, pero falta crear la tabla 'profiles'.");
      } else {
        setResult(`⚠️ Error consultando 'profiles': ${error.message}`);
      }
    } else {
      setResult(`✅ Query OK. Filas recibidas: ${data?.length ?? 0}`);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Test Supabase</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={testAuthPing}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white"
        >
          1) Probar conexión básica
        </button>
        <button
          onClick={testProfilesQuery}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white"
        >
          2) Probar query a "profiles"
        </button>
      </div>
      <p className="mt-4 text-center text-sm text-gray-200/80">{result}</p>
      <p className="text-xs text-gray-400/80">
        URL: {supabaseUrl ? "cargada" : "vacía"} • KEY: {supabaseAnon ? "cargada" : "vacía"}
      </p>
    </main>
  );
}