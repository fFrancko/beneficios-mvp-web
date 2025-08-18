// app/api/payments/verify/route.ts
import { NextResponse } from "next/server";

const MP_API = "https://api.mercadopago.com";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("id");

    if (!paymentId) {
      return NextResponse.json(
        { error: "Falta parámetro id (ej: /api/payments/verify?id=1234567890)" },
        { status: 400 }
      );
    }

    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN" },
        { status: 500 }
      );
    }

    // Consultar pago en la API oficial
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: "Mercado Pago error", detail: errText },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, payment: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
