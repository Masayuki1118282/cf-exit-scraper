import { load } from 'cheerio';
import { BaseScraper } from './base';
import { log } from '../utils/logger';
import type { ScrapedProject } from '@/types/project';

const SITEMAP_TOTAL_PAGES = 9;

// note:* meta tags use property= attribute (not name=)
const META = {
  title: 'note:title',
  owner: 'note:owner',
  category: 'note:category',
  target_amount: 'note:target_amount',
  current_amount: 'note:current_amount',
  supporters: 'note:supporters',
  start_at: 'note:start_at',
  end_at: 'note:end_at',
} as const;

export class MakuakeScraper extends BaseScraper {
  constructor() {
    super('makuake', process.env.MAKUAKE_BASE_URL ?? 'https://www.makuake.com');
  }

  // Sitemap pages are XML — parse with xmlMode
  async scrapeListPage(page: number): Promise<string[]> {
    if (page > SITEMAP_TOTAL_PAGES) return [];

    const xml = await this.fetch(`/sitemap/project/${page}/`);
    const $ = load(xml, { xmlMode: true });

    const urls: string[] = [];
    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      // Only top-level project pages, not /communication/ sub-pages
      if (/\/project\/[^/]+\/$/.test(url)) {
        urls.push(url);
      }
    });

    const unique = [...new Set(urls)];
    log('info', 'makuake_sitemap_page', { page, found: unique.length });
    return unique;
  }

  async scrapeProjectPage(url: string): Promise<ScrapedProject | null> {
    const html = await this.fetch(url);
    const $ = this.load(html);

    const getMeta = (prop: string) =>
      $(`meta[property="${prop}"]`).attr('content') ?? null;

    const title = getMeta(META.title);
    if (!title) {
      log('warn', 'makuake_no_title', { url });
      return null;
    }

    const currentAmount = parseInt(getMeta(META.current_amount) ?? '0', 10);
    const targetAmount = parseInt(getMeta(META.target_amount) ?? '0', 10);
    const endAtStr = getMeta(META.end_at);
    const startAtStr = getMeta(META.start_at);

    // Only accept projects that have ended AND achieved their goal
    const endAt = endAtStr ? new Date(endAtStr) : null;
    if (!endAt || endAt > new Date()) return null;
    if (currentAmount <= 0) return null;
    if (targetAmount > 0 && currentAmount < targetAmount) return null;

    const slugMatch = url.match(/\/project\/([^/]+)\//);
    const externalId = slugMatch?.[1] ?? url;

    const achievementRate =
      targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : null;

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ??
      null;

    // Owner profile link: Makuake uses /user/{id}/ paths
    const ownerHref =
      $('a[href*="/user/"]').first().attr('href') ?? null;
    const ownerProfileUrl = ownerHref
      ? ownerHref.startsWith('http')
        ? ownerHref
        : `${this.baseUrl}${ownerHref}`
      : null;

    log('info', 'makuake_project_achieved', {
      externalId,
      achievementRate,
      currentAmount,
    });

    return {
      platform: 'makuake',
      external_id: externalId,
      url,
      title,
      description: description ? description.slice(0, 500) : null,
      category: getMeta(META.category),
      owner_name: getMeta(META.owner),
      owner_company: null,
      owner_profile_url: ownerProfileUrl,
      achieved_amount: currentAmount,
      target_amount: targetAmount > 0 ? targetAmount : null,
      achievement_rate: achievementRate,
      supporter_count: parseInt(getMeta(META.supporters) ?? '0', 10) || null,
      start_date: startAtStr ? startAtStr.split('T')[0] : null,
      end_date: endAtStr ? endAtStr.split('T')[0] : null,
      status: 'completed',
      raw_html: html.slice(0, 50_000),
    };
  }
}
