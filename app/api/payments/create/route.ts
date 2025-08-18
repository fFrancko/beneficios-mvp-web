// app/api/payments/create/route.ts
import { NextResponse } from "next/server";

const MP_API = "https://api.mercadopago.com";

type CreatePreferenceBody = {
  title?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;   // monto en ARS
  // metadata?: Record<string, any>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePreferenceBody;
    const title = body.title ?? "Membresía mensual";
    const description = body.description ?? "Renovación de membresía";
    const quantity = body.quantity ?? 1;
    const unit_price = body.unit_price ?? 5000; // ajusta tu precio luego

    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN; // <-- solo producción
    const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
    const WEBHOOK_URL =
      process.env.MP_WEBHOOK_URL || `${BASE_URL}/api/webhooks/mercadopago`;

    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN (producción)" },
        { status: 500 }
      );
    }

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
      // metadata: body.metadata ?? {}
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
