import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { log } from '@/lib/utils/logger';
import { notifyScrapeSummary, notifyDiscord } from '@/lib/notify/discord';
import type { ScrapedProject } from '@/types/project';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const platforms = ['makuake', 'campfire', 'greenfunding'] as const;
  let totalNew = 0;
  let totalErrors = 0;

  for (const platform of platforms) {
    const { data: logEntry } = await supabase
      .from('scrape_logs')
      .insert({ platform, started_at: new Date().toISOString(), status: 'running' })
      .select()
      .single();

    log('info', 'cron_scrape_start', { platform });

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/scrape/${platform}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      );

      const result = await res.json() as { newProjects?: number; errors?: number };
      totalNew += result.newProjects ?? 0;
      totalErrors += result.errors ?? 0;

      if (logEntry) {
        await supabase
          .from('scrape_logs')
          .update({
            finished_at: new Date().toISOString(),
            total_projects: result.newProjects ?? 0,
            status: 'completed',
          })
          .eq('id', logEntry.id);
      }

      await notifyScrapeSummary(platform, result.newProjects ?? 0, result.newProjects ?? 0, result.errors ?? 0);
    } catch (err) {
      log('error', 'cron_scrape_error', { platform, error: String(err) });
      totalErrors++;

      if (logEntry) {
        await supabase
          .from('scrape_logs')
          .update({ finished_at: new Date().toISOString(), status: 'failed' })
          .eq('id', logEntry.id);
      }

      await notifyDiscord(`❌ ${platform}: Cronスクレイピング失敗 - ${String(err)}`);
    }
  }

  return NextResponse.json({ totalNew, totalErrors });
}
