import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/supabase/server-session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createSessionClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL('/', req.url));
}
