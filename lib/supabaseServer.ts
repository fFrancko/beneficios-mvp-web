// lib/supabaseServer.ts
// Modo sin cookies SSR: la sesión NO se guarda en cookies HTTPOnly.
// Así, al cerrar la pestaña se pierde (porque el cliente usa sessionStorage).
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ✅ API nueva (sin deprecations) y sin persistencia en cookies
      cookies: {
        getAll() {
          // No leemos cookies del request
          return [];
        },
        setAll() {
          // No escribimos cookies en la respuesta
        },
      },
    }
  );
}
