// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // Next 15: Promise

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // ✅ Forzamos cookies de sesión (sin expiración explícita)
              const sessionOpts: any = { ...(options || {}) };
              delete sessionOpts.maxAge;
              delete sessionOpts.expires;
              (cookieStore as any).set(name, value, sessionOpts);
            });
          } catch {}
        },
      },
    }
  );
}
