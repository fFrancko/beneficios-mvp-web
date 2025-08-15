// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // Next 15

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ✅ Nueva firma: sin deprecations
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Forzamos cookies de sesión (sin Expires / Max-Age)
          cookiesToSet.forEach(({ name, value, options }) => {
            const sessionOpts: any = { ...(options || {}) };
            delete sessionOpts.expires;
            delete sessionOpts.maxAge;
            (cookieStore as any).set(name, value, sessionOpts);
          });
        },
      },
    }
  );
}
