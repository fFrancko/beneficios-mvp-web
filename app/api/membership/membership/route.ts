// app/api/membership/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ','');
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error:'unauthorized' }, { status:401 });

  const { data, error } = await supa
    .from('memberships')
    .select('status, valid_until')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status:500 });
  return NextResponse.json(data ?? { status:'past_due', valid_until:null });
}