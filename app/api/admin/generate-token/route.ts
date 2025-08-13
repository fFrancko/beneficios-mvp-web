import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { user_id, exp_minutes = 5 } = await req.json();
  if (!user_id) {
    return NextResponse.json({ ok: false, error: "missing user_id" }, { status: 400 });
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user_id)
    .setExpirationTime(`${exp_minutes}m`)
    .sign(secret);

  return NextResponse.json({ ok: true, token, exp_minutes });
}
