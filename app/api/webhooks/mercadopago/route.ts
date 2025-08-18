// app/api/webhooks/mercadopago/route.ts
import { NextResponse } from "next/server";

const MP_API = "https://api.mercadopago.com";

/**
 * Mercado Pago puede enviar payloads distintos según la integración.
 * Dos formatos comunes:
 * 1) { "type": "payment", "data": { "id": "1234567890" } }
 * 2) { "action": "payment.updated", "data": { "id": "1234567890" } }
 * 3) A veces llega "resource" con la URL al recurso.
 */
type MPWebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string };
  resource?: string;
};

async function fetchPayment(accessToken: string, paymentId: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error consultando pago ${paymentId}: ${err}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  try {
    // 1) Leer body (sin confiar aún)
    const body = (await req.json()) as MPWebhookBody;

    // 2) Identificar paymentId
    let paymentId = body?.data?.id;
    if (!paymentId && body?.resource) {
      // /v1/payments/{id} -> extraer el último segmento si vino "resource"
      const parts = body.resource.split("/");
      paymentId = parts[parts.length - 1];
    }

    if (!paymentId) {
      // Si MP está probando el webhook o llega algo sin ID, devolver 200 para no reintentos infinitos
      return NextResponse.json({ ok: true, note: "sin paymentId" });
    }

    // 3) Token (producción)
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN (producción)" },
        { status: 500 }
      );
    }

    // 4) Consultar a Mercado Pago el estado real del pago
    const payment = await fetchPayment(ACCESS_TOKEN, paymentId);

    // Campos típicos que usaremos
    const status: string = payment.status; // "approved", "pending", "rejected", etc.
    const externalReference: string | undefined = payment.external_reference; // útil si envías metadata propia
    const payerEmail: string | undefined = payment.payer?.email;

    // 5) Branching principal
    if (status === "approved") {
      // 👉 Aquí va la lógica de negocio real:
      // - Buscar al miembro (por external_reference o metadata)
      // - Extender su valid_until: +30 días (o lo que definas)
      // - Guardar last_payment_at = now()
      // - Escribir logs
      //
      // Por ahora, lo dejamos como comentario para conectarlo luego con Supabase.
      // await updateMembershipActive(memberId)

      return NextResponse.json({
        ok: true,
        paymentId,
        status,
        externalReference,
        payerEmail,
        note: "Pago aprobado: aquí se extiende la membresía",
      });
    }

    // Status no aprobado -> solo logueamos y OK para evitar reintentos eternos
    return NextResponse.json({
      ok: true,
      paymentId,
      status,
      note: "Evento recibido; sin acción (no aprobado)",
    });
  } catch (e: any) {
    // Responder 200 en errores puntuales evita que MP reintente indefinidamente,
    // pero durante desarrollo es útil ver el error. Aquí optamos por 200 + detalle.
    return NextResponse.json(
      { ok: true, error: e?.message || String(e) },
      { status: 200 }
    );
  }
}

// (Opcional) Soportar GET como ping de vida del webhook
export async function GET() {
  return NextResponse.json({ ok: true, ping: "mercadopago webhook alive" });
}
