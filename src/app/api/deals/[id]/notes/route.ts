import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/supabase/server-session';
import { createAdminClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { note_type, content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deal_notes')
    .insert({ deal_id: id, note_type: note_type || 'memo', content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
