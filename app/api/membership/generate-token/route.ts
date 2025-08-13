// app/api/membership/generate-token/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ','');
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error:'unauthorized' }, { status:401 });

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setExpirationTime('5m')
    .sign(secret);

  return NextResponse.json({ token });
}