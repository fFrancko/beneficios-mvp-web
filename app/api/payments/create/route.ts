// app/api/payments/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MP_API = "https://api.mercadopago.com";

// ⚠️ Mantengo las props legacy para NO romper a quien las envíe,
// pero el precio ya NO se toma del cliente.
type CreatePreferenceBody = {
  plan?: "mensual" | "anual";
  title?: string;        // ignorado para precio
  description?: string;  // ignorado para precio
  quantity?: number;     // forzamos 1 para seguridad
  unit_price?: number;   // ignorado para precio
};

function getBearer(req: Request) {
  const h =
    (req.headers as any).get?.("authorization") ||
    (req.headers as any).get?.("Authorization");
  if (!h) return null;
  const [t, v] = String(h).split(" ");
  return t?.toLowerCase() === "bearer" && v ? v : null;
}

export async function POST(req: Request) {
  try {
    // 0) Autenticación del socio (requiere sesión)
    const bearer = getBearer(req);
    if (!bearer) {
      return NextResponse.json(
        { error: "Falta Authorization: Bearer <token>" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Faltan variables de Supabase" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) {
      return NextResponse.json(
        { error: "Token inválido o sesión expirada" },
        { status: 401 }
      );
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? undefined;

    // 1) Entrada mínima: solo "plan" (legacy fields permitidos pero ignorados para precio)
    const body = (await req.json().catch(() => ({}))) as CreatePreferenceBody;
    const plan: "mensual" | "anual" = body.plan === "anual" ? "anual" : "mensual";

    // 2) Precios del SERVIDOR (ENV o defaults). El cliente NO define el precio.
    const envMensual = Number(process.env.MP_PRICE_MENSUAL_ARS);
    const envAnual = Number(process.env.MP_PRICE_ANUAL_ARS);
    const PRICES = {
      mensual: Number.isFinite(envMensual) && envMensual > 0 ? envMensual : 9999999,
      anual: Number.isFinite(envAnual) && envAnual > 0 ? envAnual : 9999999,
    } as const;

    const unit_price = PRICES[plan];
    const currency_id = "ARS";
    // Título/descripcion “oficiales” según plan (no críticos de seguridad)
    const title =
      plan === "anual" ? "Membresía anual" : "Membresía mensual";
    const description =
      plan === "anual" ? "Renovación 12 meses" : "Renovación 30 días";
    const quantity = 1; // 🔒 seguridad: forzado a 1

    // 3) Entorno Mercado Pago
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN; // prod
    const BASE_URL =
      process.env.BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    const WEBHOOK_BASE =
      process.env.MP_WEBHOOK_URL ||
      `${BASE_URL}/api/webhooks/mercadopago`;
    const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || "";
    const WEBHOOK_URL = WEBHOOK_SECRET
      ? `${WEBHOOK_BASE}?s=${encodeURIComponent(WEBHOOK_SECRET)}`
      : WEBHOOK_BASE;

    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN (producción)" },
        { status: 500 }
      );
    }

    // 4) Preference con external_reference + metadata segura
    const preference = {
      items: [
        {
          title,
          description,
          quantity,
          currency_id,
          unit_price, // 💰 fijo por servidor
        },
      ],
      back_urls: {
        success: `${BASE_URL}/pago-exitoso`,
        failure: `${BASE_URL}/pago-fallido`,
        pending: `${BASE_URL}/pago-pendiente`,
      },
      auto_return: "approved",
      notification_url: WEBHOOK_URL,
      statement_descriptor: "MEMBRESIA",
      external_reference: userId, // <-- clave para webhook (identificar socio)
      metadata: {
        user_id: userId,
        email: userEmail,
        plan,                    // 🔒 para validar en webhook
        expected_amount: unit_price,
        currency: currency_id,
        source: "mvp-membership",
      },
    };

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: "Mercado Pago error", detail: errText },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point, // producción
      mobile_init_point: data.mobile_init_point,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
