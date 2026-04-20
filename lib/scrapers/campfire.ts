import { BaseScraper } from './base';
import { log } from '../utils/logger';
import { delay } from '../utils/delay';
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

// Target categories only — product/gadget/food
const CATEGORIES = ['product', 'technology', 'food'] as const;

export class CampfireScraper extends BaseScraper {
  constructor() {
    super('campfire', process.env.CAMPFIRE_BASE_URL ?? 'https://camp-fire.jp');
  }

  // Called internally by run() with category; base class signature satisfied via override below
  async scrapeListPage(page: number): Promise<string[]> {
    return this.scrapeListPageForCategory(page, CATEGORIES[0]);
  }

  private async scrapeListPageForCategory(page: number, category: string): Promise<string[]> {
    const html = await this.fetch(
      `/projects/search?status=success&category=${category}&sort=newest&page=${page}`
    );
    const $ = this.load(html);

    const urls: string[] = [];
    $('a[href*="/projects/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (/\/projects\/\d+\/view/.test(href)) {
        const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        urls.push(url);
      }
    });

    const unique = [...new Set(urls)];
    log('info', 'campfire_search_page', { category, page, found: unique.length });
    return unique;
  }

  // Override base run() to iterate categories × pages
  async run(): Promise<ScrapedProject[]> {
    const results: ScrapedProject[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      if (this.errorTracker.isHalted()) break;

      for (let page = 1; page <= this.maxPages; page++) {
        if (this.errorTracker.isHalted()) break;

        let urls: string[];
        try {
          urls = await this.scrapeListPageForCategory(page, category);
        } catch (err) {
          log('error', 'campfire_list_error', { category, page, error: String(err) });
          break;
        }

        if (urls.length === 0) break;

        for (const url of urls) {
          if (seen.has(url) || this.errorTracker.isHalted()) continue;
          seen.add(url);

          await delay(this.requestDelay);

          try {
            const project = await this.scrapeProjectPage(url);
            if (project) results.push(project);
          } catch (err) {
            log('error', 'campfire_project_error', { url, error: String(err) });
          }
        }

        await delay(this.requestDelay);
      }
    }

    return results;
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
    if (!endAt || endAt > new Date()) {
      log('info', 'campfire_skip_active', { url, endAtStr, now: new Date().toISOString() });
      return null;
    }
    if (currentAmount <= 0) {
      log('info', 'campfire_skip_no_amount', { url });
      return null;
    }
    if (targetAmount > 0 && currentAmount < targetAmount) {
      log('info', 'campfire_skip_not_achieved', { url, currentAmount, targetAmount });
      return null;
    }

    const idMatch = url.match(/\/projects\/(\d+)\/view/);
    const externalId = idMatch?.[1] ?? url;

    const achievementRate =
      targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : null;

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ??
      null;

    const ownerHref = $('a[href*="/users/"]').first().attr('href') ?? null;
    const ownerProfileUrl = ownerHref
      ? ownerHref.startsWith('http')
        ? ownerHref
        : `${this.baseUrl}${ownerHref}`
      : null;

    log('info', 'campfire_project_achieved', { externalId, achievementRate, currentAmount });

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
