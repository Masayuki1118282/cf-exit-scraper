import { log } from '../utils/logger';

export async function notifyDiscord(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    log('warn', 'discord_webhook_not_configured', {});
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      log('warn', 'discord_notify_failed', { status: res.status });
    }
  } catch (err) {
    log('error', 'discord_notify_error', { error: String(err) });
  }
}

export async function notifyScrapeSummary(
  platform: string,
  totalProjects: number,
  newProjects: number,
  errors: number
): Promise<void> {
  const message = [
    `📊 **${platform} スクレイピング完了**`,
    `新規: ${newProjects}件 / 合計: ${totalProjects}件 / エラー: ${errors}件`,
  ].join('\n');
  await notifyDiscord(message);
}

export async function notifyHotLead(
  projectTitle: string,
  projectUrl: string,
  score: number
): Promise<void> {
  const message = [
    `🔥 **ホットリード発見（スコア: ${score}点）**`,
    `タイトル: ${projectTitle}`,
    `URL: ${projectUrl}`,
  ].join('\n');
  await notifyDiscord(message);
}
