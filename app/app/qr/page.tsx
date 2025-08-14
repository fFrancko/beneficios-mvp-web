"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function QRRedirect() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;

      if (!uid) {
        router.replace("/login");
        return;
      }

      // Redirige a tu ruta existente /qr/[user]
      router.replace(`/qr/${uid}`);
    })();
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center p-6 text-neutral-100">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-neutral-900/60 p-4 text-center">
        <div className="text-sm opacity-80">Abriendo tu QR…</div>
      </div>
    </main>
  );
}
