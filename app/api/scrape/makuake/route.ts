import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { MakuakeScraper } from '@/lib/scrapers/makuake';
import { log } from '@/lib/utils/logger';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const scraper = new MakuakeScraper();

  let newProjects = 0;
  let errors = 0;

  try {
    const projects = await scraper.run();
    log('info', 'makuake_scrape_complete', { total: projects.length });

    for (const project of projects) {
      // Check if already exists to count new vs updated
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('platform', 'makuake')
        .eq('external_id', project.external_id)
        .maybeSingle();

      const { error } = await supabase.from('projects').upsert(
        { ...project, scraped_at: new Date().toISOString() },
        { onConflict: 'platform,external_id' }
      );

      if (error) {
        log('error', 'makuake_upsert_error', {
          external_id: project.external_id,
          error: error.message,
        });
        errors++;
        continue;
      }

      if (!existing) newProjects++;
    }
  } catch (err) {
    log('error', 'makuake_scrape_failed', { error: String(err) });
    errors++;
  }

  return NextResponse.json({ newProjects, errors });
}
