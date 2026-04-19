import { BaseScraper } from './base';
import { log } from '../utils/logger';
import type { ScrapedProject } from '@/types/project';

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

export class CampfireScraper extends BaseScraper {
  constructor() {
    super('campfire', process.env.CAMPFIRE_BASE_URL ?? 'https://camp-fire.jp');
  }

  // Search page returns static HTML with 20 project links per page
  async scrapeListPage(page: number): Promise<string[]> {
    const html = await this.fetch(
      `/projects/search?status=success&sort=newest&page=${page}`
    );
    const $ = this.load(html);

    const urls: string[] = [];
    $('a[href*="/projects/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/\/projects\/(\d+)\/view/);
      if (match) {
        const url = href.startsWith('http')
          ? href
          : `${this.baseUrl}${href}`;
        urls.push(url);
      }
    });

    const unique = [...new Set(urls)];
    log('info', 'campfire_search_page', { page, found: unique.length });
    return unique;
  }

  async scrapeProjectPage(url: string): Promise<ScrapedProject | null> {
    const html = await this.fetch(url);
    const $ = this.load(html);

    const getMeta = (prop: string) =>
      $(`meta[property="${prop}"]`).attr('content') ?? null;

    const title = getMeta(META.title);
    if (!title) {
      log('warn', 'campfire_no_title', { url });
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

    const idMatch = url.match(/\/projects\/(\d+)\/view/);
    const externalId = idMatch?.[1] ?? url;

    const achievementRate =
      targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : null;

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ??
      null;

    // Owner profile link: Campfire uses /users/{id} paths
    const ownerHref =
      $('a[href*="/users/"]').first().attr('href') ?? null;
    const ownerProfileUrl = ownerHref
      ? ownerHref.startsWith('http')
        ? ownerHref
        : `${this.baseUrl}${ownerHref}`
      : null;

    log('info', 'campfire_project_achieved', {
      externalId,
      achievementRate,
      currentAmount,
    });

    return {
      platform: 'campfire',
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
