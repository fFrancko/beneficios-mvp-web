import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const jwt = process.env.JWT_SECRET;
  const mp = process.env.MP_ACCESS_TOKEN;

  const envOk = Boolean(url && anon && jwt && mp);

  let dbOk = false;
  try {
    if (url && anon) {
      const supabase = createClient(url, anon);
      const { error } = await supabase.from("profiles").select("*").limit(1);
      // Si la tabla no existe, igual consideramos que hay conexión
      dbOk = !error || (error as any).code === "42P01";
    }
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    ok: envOk && dbOk,
    env: { url: !!url, anon: !!anon, jwt: !!jwt, mp: !!mp },
    supabase: dbOk ? "reachable" : "unreachable",
  });
}
