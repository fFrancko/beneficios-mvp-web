// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Helper SSR para Next 15: cookies() es Promise y es Readonly.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // ✅ esperar la Promise

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,       // público
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // público (anon)
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // En RSC el tipo es Readonly → casteamos a any y atrapamos si no se puede mutar
        set(name: string, value: string, options?: any) {
          try {
            (cookieStore as any).set?.(name, value, options);
          } catch {}
        },
        remove(name: string, options?: any) {
          try {
            (cookieStore as any).delete?.(name, options);
          } catch {}
        },
      },
    }
  );
}
