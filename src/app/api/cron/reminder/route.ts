import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Stale: contacted but no reply for 3+ days
  const { data: staleDeals } = await admin
    .from('deals')
    .select('id, project_title, project_url, contacted_at')
    .eq('status', 'contacted')
    .lt('contacted_at', threeDaysAgo)
    .order('contacted_at', { ascending: true });

  // Upcoming end: projects ending within 7 days that are still new/contacted
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: endingSoon } = await admin
    .from('deals')
    .select('id, project_title, project_url, project_end_date')
    .in('status', ['new', 'contacted', 'replied'])
    .gte('project_end_date', today)
    .lte('project_end_date', sevenDaysLater)
    .order('project_end_date', { ascending: true });

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ skipped: true, reason: 'DISCORD_WEBHOOK_URL not set' });
  }

  const embeds = [];

  if (staleDeals && staleDeals.length > 0) {
    const lines = staleDeals.map((d) => {
      const days = Math.floor(
        (Date.now() - new Date(d.contacted_at!).getTime()) / (1000 * 60 * 60 * 24)
      );
      return `• [${d.project_title}](${d.project_url}) — DM送信から **${days}日**経過`;
    });
    embeds.push({
      title: `⚠️ 返信待ち放置 ${staleDeals.length}件`,
      description: lines.join('\n'),
      color: 0xf97316,
    });
  }

  if (endingSoon && endingSoon.length > 0) {
    const lines = endingSoon.map((d) => {
      const daysLeft = Math.ceil(
        (new Date(d.project_end_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return `• [${d.project_title}](${d.project_url}) — 終了まで **${daysLeft}日**`;
    });
    embeds.push({
      title: `🕐 終了間近のプロジェクト ${endingSoon.length}件`,
      description: lines.join('\n'),
      color: 0x3b82f6,
    });
  }

  if (embeds.length === 0) {
    return NextResponse.json({ ok: true, notified: false, reason: 'nothing to report' });
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'CF Exit',
      embeds,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Discord error: ${text}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    notified: true,
    stale: staleDeals?.length ?? 0,
    endingSoon: endingSoon?.length ?? 0,
  });
}
