import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/supabase/server-session';
import { createAdminClient } from '@/lib/supabase/server';
import { STATUS_LABELS, type DealStatus } from '@/types/deal';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('deals').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { add_note, ...updates } = body;

  const admin = createAdminClient();

  // Fetch current deal to detect status change
  let prevStatus: DealStatus | null = null;
  if (add_note && updates.status) {
    const { data: current } = await admin.from('deals').select('status').eq('id', id).single();
    prevStatus = current?.status ?? null;
  }

  // Timestamp updates
  if (updates.status === 'contacted' && !updates.contacted_at) {
    updates.contacted_at = new Date().toISOString();
  }
  if (updates.status === 'replied' && !updates.last_reply_at) {
    updates.last_reply_at = new Date().toISOString();
  }
  if ((updates.status === 'closed_won' || updates.status === 'closed_lost') && !updates.closed_at) {
    updates.closed_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from('deals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-add status change note
  if (add_note && updates.status && prevStatus && prevStatus !== updates.status) {
    await admin.from('deal_notes').insert({
      deal_id: id,
      note_type: 'status_change',
      content: `ステータスを「${STATUS_LABELS[prevStatus as DealStatus]}」→「${STATUS_LABELS[updates.status as DealStatus]}」に変更`,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('deals').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
