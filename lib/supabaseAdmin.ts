import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // Cliente “server-side” con la service_role (NO se expone al navegador)
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
