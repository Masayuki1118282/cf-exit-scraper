import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/supabase/server-session';
import { fetchProjectPreview } from '@/lib/preview/fetch-project';

export async function GET(req: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // 24時間キャッシュ: 既登録の案件URLなら即返す
  const { data: existing } = await supabase
    .from('deals')
    .select('project_url, platform, project_title, project_image_url, owner_name, owner_company, achieved_amount, supporter_count, category, project_end_date')
    .eq('project_url', url)
    .single();

  if (existing) {
    return NextResponse.json({ ...existing, cached: true });
  }

  try {
    const preview = await fetchProjectPreview(url);
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
