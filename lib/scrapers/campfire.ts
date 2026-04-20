import { BaseScraper } from './base';
import { log } from '../utils/logger';
import { delay } from '../utils/delay';
import type { ScrapedProject } from '@/types/project';

const META = {
  title: 'og:title',
  description: 'og:description',
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
    const getMetaName = (name: string) =>
      $(`meta[name="${name}"]`).attr('content') ?? null;

    const title = getMeta(META.title) ?? getMetaName('title') ?? ($('title').text().trim() || null);
    if (!title) {
      log('warn', 'campfire_no_title', { url });
      return null;
    }

    // Parse amounts from JSON-LD or visible HTML text
    const parseAmount = (text: string) =>
      parseInt(text.replace(/[¥,円\s]/g, ''), 10) || 0;

    // Try JSON-LD first
    let currentAmount = 0;
    let targetAmount = 0;
    let supporterCount: number | null = null;
    let endDateStr: string | null = null;
    let startDateStr: string | null = null;
    let ownerName: string | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? '{}');
        if (data['@type'] === 'Product' || data.name) {
          if (data.offers?.price) currentAmount = parseAmount(String(data.offers.price));
        }
      } catch { /* ignore */ }
    });

    // Fallback: parse from visible HTML
    if (currentAmount === 0) {
      const amountText = $('[class*="amount"], [class*="collected"], [class*="raised"]').first().text();
      if (amountText) currentAmount = parseAmount(amountText);
    }

    const targetText = $('[class*="target"], [class*="goal"]').first().text();
    if (targetText) targetAmount = parseAmount(targetText);

    const supporterText = $('[class*="supporter"], [class*="backer"], [class*="supporter-count"]').first().text();
    if (supporterText) {
      const m = supporterText.match(/[\d,]+/);
      if (m) supporterCount = parseInt(m[0].replace(',', ''), 10);
    }

    const endText = $('[class*="end"], [class*="deadline"], [class*="finish"]').first().text();
    const endMatch = endText.match(/(\d{4})[^\d](\d{1,2})[^\d](\d{1,2})/);
    if (endMatch) {
      endDateStr = `${endMatch[1]}-${endMatch[2].padStart(2, '0')}-${endMatch[3].padStart(2, '0')}`;
    }

    // Check if project is ended
    const endAt = endDateStr ? new Date(endDateStr) : null;
    if (!endAt || endAt > new Date()) {
      log('info', 'campfire_skip_active', { url, endDateStr });
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

    const description = getMeta(META.description) ?? getMetaName('description') ?? null;

    const ownerHref = $('a[href*="/users/"]').first().attr('href') ?? null;
    const ownerProfileUrl = ownerHref
      ? ownerHref.startsWith('http') ? ownerHref : `${this.baseUrl}${ownerHref}`
      : null;

    ownerName = $('[class*="owner"], [class*="user-name"], [class*="author"]').first().text().trim() || null;

    log('info', 'campfire_project_achieved', { externalId, achievementRate, currentAmount });

    return {
      platform: 'campfire',
      external_id: externalId,
      url,
      title,
      description: description ? description.slice(0, 500) : null,
      category: null,
      owner_name: ownerName,
      owner_company: null,
      owner_profile_url: ownerProfileUrl,
      achieved_amount: currentAmount,
      target_amount: targetAmount > 0 ? targetAmount : null,
      achievement_rate: achievementRate,
      supporter_count: supporterCount,
      start_date: startDateStr,
      end_date: endDateStr,
      status: 'completed',
      raw_html: html.slice(0, 50_000),
    };
  }
}
