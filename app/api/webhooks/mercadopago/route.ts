// app/api/webhooks/mercadopago/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const MP_API = "https://api.mercadopago.com";

type MPWebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string };
  resource?: string;
};

async function fetchPayment(accessToken: string, paymentId: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error consultando pago ${paymentId}: ${err}`);
  }
  return res.json();
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: Request) {
  try {
    // 0) Validación simple del webhook por secreto en query (?s=)
    const url = new URL(req.url);
    const qsSecret = url.searchParams.get("s");
    const expected = process.env.MP_WEBHOOK_SECRET || "";
    if (expected && qsSecret !== expected) {
      // respondemos 200 para evitar reintentos infinitos, pero sin procesar
      return NextResponse.json({ ok: true, note: "firma inválida (secret)" });
    }

    // 1) Body (no confiar aún)
    const body = (await req.json()) as MPWebhookBody;

    // 2) paymentId (puede venir en varios formatos)
    let paymentId = body?.data?.id;
    if (!paymentId && body?.resource) {
      const parts = body.resource.split("/");
      paymentId = parts[parts.length - 1];
    }

    if (!paymentId) {
      // MP puede enviar pings de vida. Nunca devolver 4xx para no crear loops.
      return NextResponse.json({ ok: true, note: "sin paymentId" });
    }

    // 3) Token MP
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return NextResponse.json({ error: "Falta MP_ACCESS_TOKEN (producción)" }, { status: 500 });
    }

    // 4) Consultar pago real
    const payment = await fetchPayment(ACCESS_TOKEN, paymentId);

    // Campos útiles
    const status: string = payment.status; // "approved" | "pending" | "rejected" ...
    const externalReference: string | undefined = payment.external_reference;
    const metaUserId: string | undefined = payment.metadata?.user_id;
    const payerEmail: string | undefined = payment.payer?.email;

    // 5) Sólo actuamos en "approved"
    if (status === "approved") {
      // Identificar socio
      const userId = externalReference || metaUserId;
      if (!userId) {
        // No sabemos a quién acreditar: responder OK para cortar reintentos pero avisar
        return NextResponse.json({
          ok: true,
          paymentId,
          status,
          note: "approved sin userId (external_reference/metadata)",
        });
      }

      const sb = supabaseAdmin();
      const now = new Date();

      // Buscar membresía vigente más reciente
      const { data: memb, error: membErr } = await sb
        .from("memberships")
        .select("id, valid_until, status")
        .eq("user_id", userId)
        .order("valid_until", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membErr && (membErr as any).code !== "42P01") {
        // No cortar reintentos por errores transitorios
        return NextResponse.json({ ok: true, paymentId, status, warn: membErr.message });
      }

      // === 🔽 BLOQUE NUEVO: extensión según plan (mensual/anual) 🔽 ===

      // Base para extender: el mayor entre la fecha vigente y ahora (no pisa días ya pagos)
      const base =
        memb?.valid_until && new Date(memb.valid_until).getTime() > now.getTime()
          ? new Date(memb.valid_until)
          : now;

      // Plan según metadata definida en /api/payments/create
      const plan: "mensual" | "anual" =
        payment?.metadata?.plan === "anual" ? "anual" : "mensual";

      // Días por plan (podés cambiar 365 por 360 si preferís 12×30)
      const extension_days = plan === "anual" ? 365 : 30;

      const newValid = addDays(base, extension_days).toISOString();

      // === 🔼 FIN BLOQUE NUEVO 🔼 ===

      if (memb?.id) {
        // Update: extender + marcar activo + último pago
        await sb
          .from("memberships")
          .update({
            status: "active",
            valid_until: newValid,
            last_payment_at: now.toISOString(),
            provider: "mercado_pago",
          })
          .eq("id", memb.id);
      } else {
        // Insert: crear membresía activa
        await sb.from("memberships").insert({
          user_id: userId,
          status: "active",
          valid_until: newValid,
          last_payment_at: now.toISOString(),
          provider: "mercado_pago",
        });
      }

      return NextResponse.json({
        ok: true,
        paymentId,
        status,
        userId,
        externalReference,
        payerEmail,
        plan,                 // 👈 agregado para verificar
        extension_days,       // 👈 agregado para verificar
        new_valid_until: newValid,
        note: "Membresía extendida según plan",
      });
    }

    // Status no aprobado -> solo log
    return NextResponse.json({
      ok: true,
      paymentId,
      status,
      note: "Evento recibido; sin acción (no aprobado)",
    });
  } catch (e: any) {
    // MVP: devolvemos 200 para que MP no reintente indefinidamente,
    // pero adjuntamos el error para registrarlo en logs.
    return NextResponse.json({ ok: true, error: e?.message || String(e) }, { status: 200 });
  }
}

// (Opcional) GET como ping de vida
export async function GET() {
  return NextResponse.json({ ok: true, ping: "mercadopago webhook alive" });
}
