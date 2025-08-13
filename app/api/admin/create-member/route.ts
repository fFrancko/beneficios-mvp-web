// app/api/admin/create-member/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------- helpers ---------
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const BodySchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  months: z.number().int().min(1).max(24).default(1),
});

// --------- route ---------
export async function POST(req: NextRequest) {
  try {
    // 1) guard: admin secret
    const adminSecret = req.headers.get("x-admin-secret");
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // 2) body
    const { email, full_name, months } = BodySchema.parse(await req.json());

    // 3) supabase (service role)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 4) asegurar usuario (si no existe, crearlo)
    let userId: string | undefined;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // verificado para el MVP
      user_metadata: { full_name },
    });

    if (createErr) {
      // si ya existe, lo buscamos por email con la Admin REST API
      const already =
        /already registered/i.test(createErr.message ?? "") || (createErr as any)?.status === 422;

      if (!already) throw new Error(`auth.createUser failed: ${createErr.message}`);

      const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`lookup by email failed: ${res.status} ${await res.text()}`);
      const arr = (await res.json()) as Array<{ id: string }>;
      userId = arr?.[0]?.id;
      if (!userId) throw new Error("Usuario existente no encontrado por email");
    } else {
      userId = created?.user?.id;
    }

    if (!userId) throw new Error("No se obtuvo userId");

    // 5) upsert profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name }, { onConflict: "id" });
    if (profileErr) throw new Error(`profiles.upsert failed: ${profileErr.message}`);

    // 6) membresía
    const { data: existing, error: selErr } = await supabase
      .from("memberships")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw new Error(`memberships.select failed: ${selErr.message}`);

    const now = new Date();
    const base = existing?.valid_until ? new Date(existing.valid_until as any) : now;
    const anchor = base > now ? base : now; // prorratea si ya tenía días vigentes
    const newValidUntil = addDays(anchor, months * 30);

    if (existing) {
      const { error: updErr } = await supabase
        .from("memberships")
        .update({
          status: "active",
          valid_until: newValidUntil.toISOString(),
          last_payment_at: now.toISOString(),
          provider: existing.provider ?? "manual",
          renewal_mode: existing.renewal_mode ?? "manual",
        })
        .eq("id", existing.id);
      if (updErr) throw new Error(`memberships.update failed: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase.from("memberships").insert({
        user_id: userId,
        status: "active",
        valid_until: newValidUntil.toISOString(),
        last_payment_at: now.toISOString(),
        provider: "manual",
        renewal_mode: "manual",
      });
      if (insErr) throw new Error(`memberships.insert failed: ${insErr.message}`);
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      email,
      full_name,
      valid_until: newValidUntil.toISOString(),
      granted_months: months,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "unknown" }, { status: 400 });
  }
}