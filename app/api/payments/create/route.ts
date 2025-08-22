// app/api/payments/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MP_API = "https://api.mercadopago.com";

type CreatePreferenceBody = {
  title?: string;
  description?: string;
  quantity?: number;
  unit_price?: number; // ARS
};

function getBearer(req: Request) {
  const h = (req.headers as any).get?.("authorization") || (req.headers as any).get?.("Authorization");
  if (!h) return null;
  const [t, v] = String(h).split(" ");
  return t?.toLowerCase() === "bearer" && v ? v : null;
}

export async function POST(req: Request) {
  try {
    // 0) Autenticación del socio (requiere sesión)
    const bearer = getBearer(req);
    if (!bearer) {
      return NextResponse.json({ error: "Falta Authorization: Bearer <token>" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Faltan variables de Supabase" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) {
      return NextResponse.json({ error: "Token inválido o sesión expirada" }, { status: 401 });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? undefined;

    // 1) Datos del ítem
    const body = (await req.json()) as CreatePreferenceBody;
    const title = body.title ?? "Membresía mensual";
    const description = body.description ?? "Renovación de membresía";
    const quantity = body.quantity ?? 1;
    const unit_price = body.unit_price ?? 5000; // ajusta tu precio

    // 2) Entorno Mercado Pago
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN; // prod
    const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const WEBHOOK_BASE = process.env.MP_WEBHOOK_URL || `${BASE_URL}/api/webhooks/mercadopago`;
    const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || "";
    const WEBHOOK_URL = WEBHOOK_SECRET ? `${WEBHOOK_BASE}?s=${encodeURIComponent(WEBHOOK_SECRET)}` : WEBHOOK_BASE;

    if (!ACCESS_TOKEN) {
      return NextResponse.json({ error: "Falta MP_ACCESS_TOKEN (producción)" }, { status: 500 });
    }

    // 3) Preference con external_reference + metadata
    const preference = {
      items: [
        {
          title,
          description,
          quantity,
          currency_id: "ARS",
          unit_price,
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
      external_reference: userId, // <-- clave para el webhook
      metadata: {
        user_id: userId,
        email: userEmail,
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
      return NextResponse.json({ error: "Mercado Pago error", detail: errText }, { status: 500 });
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
