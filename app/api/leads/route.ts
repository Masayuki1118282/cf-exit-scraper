import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { scoreProject } from '@/lib/utils/scoring';
import { notifyHotLead } from '@/lib/notify/discord';
import { log } from '@/lib/utils/logger';
import type { Project } from '@/types/project';

export const maxDuration = 300;

const HOT_LEAD_THRESHOLD = 80;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch projects that don't yet have a lead entry
  const { data: projects, error: fetchError } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'completed')
    .not(
      'id',
      'in',
      `(${
        (
          await supabase.from('leads').select('project_id')
        ).data
          ?.map((r) => `'${r.project_id}'`)
          .join(',') ?? ''
      })`
    );

  if (fetchError) {
    log('error', 'leads_fetch_projects_error', { error: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let created = 0;
  let hotLeads = 0;

  for (const project of (projects ?? []) as Project[]) {
    const { score, reasons } = scoreProject(project);

    const { error } = await supabase.from('leads').insert({
      project_id: project.id,
      priority_score: score,
      priority_reason: reasons.join(' / '),
      status: 'new',
    });

    if (error) {
      log('error', 'leads_insert_error', {
        project_id: project.id,
        error: error.message,
      });
      continue;
    }

    created++;
    log('info', 'lead_created', { project_id: project.id, score });

    if (score >= HOT_LEAD_THRESHOLD) {
      hotLeads++;
      await notifyHotLead(project.title, project.url, score);
    }
  }

  return NextResponse.json({ created, hotLeads });
}

// GET: list leads with project info for dashboard
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');
  const minScore = parseInt(searchParams.get('min_score') ?? '0', 10);

  const supabase = createAdminClient();

  let query = supabase
    .from('leads')
    .select(`
      *,
      projects (
        id, platform, title, url, category,
        owner_name, owner_company, owner_profile_url,
        achieved_amount, target_amount, achievement_rate,
        supporter_count, end_date
      )
    `)
    .gte('priority_score', minScore)
    .order('priority_score', { ascending: false });

  if (status) query = query.eq('status', status);
  if (platform) query = query.eq('projects.platform', platform);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data });
}
