import { NextResponse } from "next/server";
export const runtime = "nodejs";

/**
 * Deshabilitado: usamos /api/membership/qr-token (tokens efímeros en BD con sesión).
 * Motivo: este endpoint firmaba JWT con ?user=<uuid> sin autenticar.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "deprecated_endpoint", use: "/api/membership/qr-token" },
    { status: 410 }
  );
}