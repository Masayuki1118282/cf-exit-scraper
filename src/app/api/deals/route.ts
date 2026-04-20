import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/supabase/server-session';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status');
  const platform = req.nextUrl.searchParams.get('platform');

  const admin = createAdminClient();
  let query = admin.from('deals').select('*').order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const {
    project_url, platform, project_title,
    project_image_url, owner_name, owner_company,
    achieved_amount, supporter_count, category, project_end_date,
  } = body;

  if (!project_url || !platform || !project_title) {
    return NextResponse.json({ error: 'project_url, platform, project_title are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deals')
    .insert({
      project_url,
      platform,
      project_title,
      project_image_url: project_image_url || null,
      owner_name: owner_name || null,
      owner_company: owner_company || null,
      achieved_amount: achieved_amount || null,
      supporter_count: supporter_count || null,
      category: category || null,
      project_end_date: project_end_date || null,
      status: 'new',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'このURLは既に登録済みです' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
