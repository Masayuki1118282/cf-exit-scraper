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

// Extract __NEXT_DATA__ JSON from Next.js pages
function getNextData($: CheerioAPI): Record<string, unknown> | null {
  const el = $('#__NEXT_DATA__');
  if (!el.length) return null;
  try {
    return JSON.parse(el.text()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Safely navigate nested object paths
function dig(obj: unknown, ...keys: string[]): unknown {
  let cur = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur ?? null;
}

function parseMakuake($: CheerioAPI): Partial<ProjectPreview> {
  const ogp = getOgp($);

  // Makuake embeds all key data in <meta property="note:*"> tags
  const noteMeta = (name: string) =>
    $(`meta[property="note:${name}"]`).attr('content') ?? null;

  const currentAmount = noteMeta('current_amount');
  const achieved_amount = currentAmount ? parseInt(currentAmount, 10) : null;

  const supporters = noteMeta('supporters');
  const supporter_count = supporters ? parseInt(supporters, 10) : null;

  const endAt = noteMeta('end_at');
  const project_end_date = endAt ? endAt.slice(0, 10) : null;

  const owner_name = noteMeta('owner');
  const category = noteMeta('category');

  // og:title on Makuake includes "Makuake｜" prefix — strip it
  const rawTitle = ogp.title ?? '';
  const project_title = rawTitle.replace(/^Makuake[｜|]\s*/, '').replace(/\s*[｜|].*$/, '').trim() || rawTitle;

  return {
    project_title: project_title || undefined,
    project_image_url: ogp.image,
    achieved_amount,
    supporter_count,
    project_end_date,
    owner_name,
    owner_company: null,
    category,
  };
}

function parseGreenfunding($: CheerioAPI): Partial<ProjectPreview> {
  const ogp = getOgp($);
  let achieved_amount: number | null = null;
  let supporter_count: number | null = null;
  let project_end_date: string | null = null;

  // Try __NEXT_DATA__ (GreenFunding is also Next.js)
  const nextData = getNextData($);
  if (nextData) {
    const project =
      dig(nextData, 'props', 'pageProps', 'project') ||
      dig(nextData, 'props', 'pageProps', 'projectData') ||
      dig(nextData, 'props', 'pageProps', 'data');

    if (project && typeof project === 'object') {
      const p = project as Record<string, unknown>;
      achieved_amount =
        (p.collected_money as number) ??
        (p.totalAmount as number) ??
        (p.achieved_amount as number) ?? null;

      supporter_count =
        (p.patron_count as number) ??
        (p.supporterCount as number) ?? null;

      const endDate =
        (p.end_date as string) ?? (p.endDate as string) ?? null;
      if (endDate) project_end_date = parseDate(endDate) ?? endDate.slice(0, 10);
    }
  }

  // Fallback: targeted selectors
  if (achieved_amount === null) {
    $('span, p, strong, b').each((_: number, el: unknown) => {
      const text = $(el).text().trim();
      if (/^[\d,]+円$/.test(text) && text.length < 20) {
        const ctx = $(el).parent().parent().text();
        if (ctx.includes('集まりました') || ctx.includes('達成') || ctx.includes('支援総額')) {
          achieved_amount = parseAmount(text);
          return false;
        }
      }
    });
  }

  if (supporter_count === null) {
    $('span, p, strong').each((_: number, el: unknown) => {
      const text = $(el).text().trim();
      if (/^\d+$/.test(text)) {
        const ctx = $(el).parent().text();
        if (ctx.includes('人') && (ctx.includes('支援') || ctx.includes('サポーター'))) {
          supporter_count = parseInt(text, 10);
          return false;
        }
      }
    });
  }

  if (project_end_date === null) {
    $('time').each((_: number, el: unknown) => {
      const dt = $(el).attr('datetime');
      if (dt) { project_end_date = dt.slice(0, 10); return false; }
    });
    if (!project_end_date) {
      $('*').each((_: number, el: unknown) => {
        const text = $(el).text().trim();
        if ((text.includes('終了') || text.includes('締切')) && text.match(/\d{4}/) && text.length < 40) {
          const d = parseDate(text);
          if (d) { project_end_date = d; return false; }
        }
      });
    }
  }

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

function parseCampfire($: CheerioAPI): Partial<ProjectPreview> {
  const ogp = getOgp($);
  let achieved_amount: number | null = null;
  let supporter_count: number | null = null;
  let project_end_date: string | null = null;

  // CAMPFIRE uses Rails/server-rendered HTML — use specific selectors
  const amountEl = $('[class*="total-amount"], [class*="totalAmount"], .total_amount, [data-total-amount]').first();
  if (amountEl.length) achieved_amount = parseAmount(amountEl.text());

  const countEl = $('[class*="supporter-count"], [class*="supporterCount"], .supporter_count').first();
  if (countEl.length) {
    const n = parseInt(countEl.text().replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n)) supporter_count = n;
  }

  // Fallback: scan for yen amounts and supporter text
  if (achieved_amount === null) {
    $('span, strong, p').each((_: number, el: unknown) => {
      const text = $(el).text().trim();
      if (/^[\d,]+円$/.test(text) && text.length < 20) {
        achieved_amount = parseAmount(text);
        return false;
      }
    });
  }

  if (supporter_count === null) {
    $('span, strong, p').each((_: number, el: unknown) => {
      const text = $(el).text().trim();
      if (/^\d+人$/.test(text)) {
        supporter_count = parseInt(text, 10);
        return false;
      }
    });
  }

  $('time').each((_: number, el: unknown) => {
    const dt = $(el).attr('datetime');
    if (dt) { project_end_date = dt.slice(0, 10); return false; }
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
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en;q=0.5',
      'Cache-Control': 'no-cache',
    },
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
  } else if (platform === 'campfire') {
    partial = parseCampfire($);
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
