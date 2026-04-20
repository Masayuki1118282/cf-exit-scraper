import { load } from 'cheerio';
import type { Platform } from '@/types/deal';

type CheerioAPI = ReturnType<typeof load>;

export interface ProjectPreview {
  platform: Platform;
  project_title: string;
  project_image_url: string | null;
  owner_name: string | null;
  owner_company: string | null;
  achieved_amount: number | null;
  supporter_count: number | null;
  category: string | null;
  project_end_date: string | null;
}

function detectPlatform(url: string): Platform {
  if (url.includes('makuake.com')) return 'makuake';
  if (url.includes('greenfunding.jp')) return 'greenfunding';
  if (url.includes('camp-fire.jp')) return 'campfire';
  return 'other';
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function parseDate(text: string): string | null {
  const m = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function getOgp($: CheerioAPI): { title: string | null; image: string | null } {
  return {
    title: $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text().trim() || null,
    image: $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') || null,
  };
}

function parseMakuake($: CheerioAPI): Partial<ProjectPreview> {
  const ogp = getOgp($);

  let achieved_amount: number | null = null;
  $('*').each((_: number, el: unknown) => {
    const text = $(el).text();
    if (text.includes('達成') && text.match(/[\d,]+円/)) {
      const m = text.match(/([\d,]+)円/);
      if (m) { achieved_amount = parseAmount(m[1]); return false; }
    }
  });

  let supporter_count: number | null = null;
  $('*').each((_: number, el: unknown) => {
    const text = $(el).text();
    if ((text.includes('支援者') || text.includes('人が支援')) && text.match(/\d+/)) {
      const m = text.match(/(\d+)\s*人/);
      if (m) { supporter_count = parseInt(m[1], 10); return false; }
    }
  });

  let project_end_date: string | null = null;
  $('*').each((_: number, el: unknown) => {
    const text = $(el).text();
    if (text.includes('終了') && text.match(/\d{4}/)) {
      const d = parseDate(text);
      if (d) { project_end_date = d; return false; }
    }
  });

  let owner_name: string | null = null;
  const ownerEl = $('[class*="owner"], [class*="producer"], [class*="Owner"]').first();
  if (ownerEl.length) owner_name = ownerEl.text().trim().slice(0, 50) || null;

  return {
    project_title: ogp.title ?? undefined,
    project_image_url: ogp.image,
    achieved_amount,
    supporter_count,
    project_end_date,
    owner_name,
    owner_company: null,
  };
}

function parseGreenfunding($: CheerioAPI): Partial<ProjectPreview> {
  const ogp = getOgp($);

  let achieved_amount: number | null = null;
  $('*').each((_: number, el: unknown) => {
    const text = $(el).text();
    if (text.match(/[\d,]+円/) && (text.includes('集まりました') || text.includes('達成'))) {
      const m = text.match(/([\d,]+)円/);
      if (m) { achieved_amount = parseAmount(m[1]); return false; }
    }
  });

  let supporter_count: number | null = null;
  $('*').each((_: number, el: unknown) => {
    const text = $(el).text();
    if (text.match(/^\s*\d+\s*人/)) {
      const m = text.match(/(\d+)\s*人/);
      if (m) { supporter_count = parseInt(m[1], 10); return false; }
    }
  });

  let project_end_date: string | null = null;
  $('*').each((_: number, el: unknown) => {
    const text = $(el).text();
    if ((text.includes('終了') || text.includes('締切')) && text.match(/\d{4}/)) {
      const d = parseDate(text);
      if (d) { project_end_date = d; return false; }
    }
  });

  return {
    project_title: ogp.title ?? undefined,
    project_image_url: ogp.image,
    achieved_amount,
    supporter_count,
    project_end_date,
    owner_name: null,
    owner_company: null,
  };
}

export async function fetchProjectPreview(url: string): Promise<ProjectPreview> {
  const platform = detectPlatform(url);
  const timeout = parseInt(process.env.PREVIEW_TIMEOUT_MS || '10000', 10);
  const userAgent = process.env.PREVIEW_USER_AGENT || 'CFExit-Bot/1.0 (contact@cfexit.jp)';

  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent },
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = load(html);

  let partial: Partial<ProjectPreview>;
  if (platform === 'makuake') {
    partial = parseMakuake($);
  } else if (platform === 'greenfunding') {
    partial = parseGreenfunding($);
  } else {
    const ogp = getOgp($);
    partial = { project_title: ogp.title ?? undefined, project_image_url: ogp.image };
  }

  return {
    platform,
    project_title: partial.project_title || 'タイトル取得失敗',
    project_image_url: partial.project_image_url ?? null,
    owner_name: partial.owner_name ?? null,
    owner_company: partial.owner_company ?? null,
    achieved_amount: partial.achieved_amount ?? null,
    supporter_count: partial.supporter_count ?? null,
    category: partial.category ?? null,
    project_end_date: partial.project_end_date ?? null,
  };
}
