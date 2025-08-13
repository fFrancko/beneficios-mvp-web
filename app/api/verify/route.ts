// app/api/verify/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
    const t = searchParams.get('t');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
        let sub: string | undefined;

          try {
              const { payload } = await jose.jwtVerify(t!, secret);
                  sub = payload.sub as string;
                    } catch {
                        return NextResponse.json({ result: 'invalid_token' });
                          }

                            // service role para leer sin RLS y loguear verificación
                              const admin = createClient(
                                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                      process.env.SUPABASE_SERVICE_ROLE_KEY!
                                        );

                                          const { data } = await admin
                                              .from('memberships')
                                                  .select('status, valid_until, user_id')
                                                      .eq('user_id', sub!)
                                                          .maybeSingle();

                                                            const result = data && data.status === 'active' && data.valid_until && new Date(data.valid_until) > new Date()
                                                                ? 'active'
                                                                    : 'expired';

                                                                      await admin.from('verifications').insert({
                                                                          member_id: sub!,
                                                                              result,
                                                                                  verifier_ip: (req.headers.get('x-forwarded-for') || '').split(',')[0],
                                                                                      user_agent: req.headers.get('user-agent') || ''
                                                                                        });

                                                                                          return NextResponse.json({
                                                                                              result,
                                                                                                  valid_until: data?.valid_until ?? null
                                                                                                    });
                                                                                                    }