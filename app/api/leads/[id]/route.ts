import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { LeadStatus } from '@/types/project';

const VALID_STATUSES: LeadStatus[] = [
  'new', 'contacted', 'replied', 'meeting', 'closed', 'rejected',
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { status?: LeadStatus; notes?: string };

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    updates.status = body.status;
    if (body.status === 'contacted') {
      updates.contacted_at = new Date().toISOString();
    }
  }
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
