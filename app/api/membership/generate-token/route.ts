// app/api/membership/generate-token/route.ts
import { NextResponse } from "next/server";
import * as jose from "jose";
import QRCode from "qrcode";

export const runtime = "nodejs";

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const user = url.searchParams.get("user");
    if (!user || !isUUID(user)) {
      return NextResponse.json({ error: "user inválido" }, { status: 400 });
    }

    const expMinutes = 5;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user)
      .setExpirationTime(`${expMinutes}m`)
      .sign(secret);

    const base = process.env.BASE_URL || "";
    const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });
    const expiresAtISO = new Date(Date.now() + expMinutes * 60_000).toISOString();

    return NextResponse.json({ token, verifyUrl, qrDataUrl, expiresAtISO });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}
