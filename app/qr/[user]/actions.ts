"use server";

import * as jose from "jose";
import QRCode from "qrcode";

const EXP_MINUTES = 5;

/** Emite un nuevo token + QR para el usuario dado. */
export async function issueQR(userId: string) {
  if (!userId) {
    throw new Error("Falta userId");
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${EXP_MINUTES}m`)
    .sign(secret);

  const base = process.env.BASE_URL || "";
  const verifyUrl = `${base}/verify?t=${encodeURIComponent(token)}`;
  const src = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 8 });
  const expiresAt = new Date(Date.now() + EXP_MINUTES * 60_000).toISOString();

  return {
    src,
    verifyUrl,
    expiresAt,
    expMinutes: EXP_MINUTES,
  };
}
