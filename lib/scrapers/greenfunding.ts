import { BaseScraper } from './base';
import { log } from '../utils/logger';
import { delay } from '../utils/delay';
import type { ScrapedProject } from '@/types/project';

// Target category IDs only — gadget/tech/food
const CATEGORY_IDS = [
  27, // ガジェット
  38, // テクノロジー/IoT
  29, // フード
] as const;

export class GreenFundingScraper extends BaseScraper {
  constructor() {
    super(
      'greenfunding',
      process.env.GREENFUNDING_BASE_URL ?? 'https://greenfunding.jp'
    );
  }

  async scrapeListPage(page: number): Promise<string[]> {
    return this.scrapeListPageForCategory(page, CATEGORY_IDS[0]);
  }

  private async scrapeListPageForCategory(page: number, categoryId: number): Promise<string[]> {
    const html = await this.fetch(
      `/portals/search?category_id=${categoryId}&status=success&page=${page}`
    );
    const $ = this.load(html);

    const urls: string[] = [];
    $('a[href*="/lab/projects/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      // Only top-level project pages (not /activities/, /supports/ etc.)
      if (/\/lab\/projects\/\d+$/.test(href)) {
        const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        urls.push(url);
      }
    });

    const unique = [...new Set(urls)];
    log('info', 'greenfunding_search_page', { categoryId, page, found: unique.length });
    return unique;
  }

  // Override base run() to iterate categories × pages
  async run(): Promise<ScrapedProject[]> {
    const results: ScrapedProject[] = [];
    const seen = new Set<string>();

    for (const categoryId of CATEGORY_IDS) {
      if (this.errorTracker.isHalted()) break;

      for (let page = 1; page <= this.maxPages; page++) {
        if (this.errorTracker.isHalted()) break;

        let urls: string[];
        try {
          urls = await this.scrapeListPageForCategory(page, categoryId);
        } catch (err) {
          log('error', 'greenfunding_list_error', { categoryId, page, error: String(err) });
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
            log('error', 'greenfunding_project_error', { url, error: String(err) });
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

    // Only accept completed (sold out) projects
    const availability = getMeta('product:availability');
    if (availability !== 'out of stock') return null;

    const title =
      $('meta[property="og:title"]').attr('content') ??
      $('title').text().trim() ??
      null;
    if (!title) {
      log('warn', 'greenfunding_no_title', { url });
      return null;
    }

    // Current funded amount: "182,206,741" → 182206741
    const rawAmount = getMeta('product:custom_label_3') ?? '0';
    const currentAmount = parseInt(rawAmount.replace(/,/g, ''), 10);
    if (currentAmount <= 0) return null;

    // Supporters: "1901人" → 1901
    const rawSupporters = getMeta('product:custom_label_1') ?? '';
    const supporterCount = parseInt(rawSupporters.replace(/[^\d]/g, ''), 10) || null;

    // Target amount and end date from sidebar HTML
    // <span class='is-number'>50,000,000</span><span>円</span> (in 目標 context)
    // <span class='is-number'>2024</span>年<span>12</span>月<span>21</span>日まで
    const targetInfo = $('.project_sidebar_dashboard-target-info');
    const targetText = targetInfo.text();

    const targetMatch = targetInfo
      .find('.text')
      .filter((_, el) => $(el).text().includes('目標'))
      .find('.is-number')
      .first()
      .text();
    const targetAmount = targetMatch
      ? parseInt(targetMatch.replace(/,/g, ''), 10)
      : 0;

    // Parse end date: "2024年12月21日まで" → "2024-12-21"
    const dateMatch = targetText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const endDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
      : null;

    if (targetAmount > 0 && currentAmount < targetAmount) return null;

    const idMatch = url.match(/\/lab\/projects\/(\d+)/);
    const externalId = idMatch?.[1] ?? url;

    const achievementRate =
      targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : null;

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ??
      null;

    const ownerCompany = getMeta('product:brand');

    // Owner profile link: GreenFunding uses /lab/users/{id} paths
    const ownerHref =
      $('a[href*="/lab/users/"]').first().attr('href') ?? null;
    const ownerProfileUrl = ownerHref
      ? ownerHref.startsWith('http')
        ? ownerHref
        : `${this.baseUrl}${ownerHref}`
      : null;

    log('info', 'greenfunding_project_achieved', {
      externalId,
      achievementRate,
      currentAmount,
    });

    return {
      platform: 'greenfunding',
      external_id: externalId,
      url,
      title,
      description: description ? description.slice(0, 500) : null,
      category: getMeta('product:custom_label_4'),
      owner_name: null,
      owner_company: ownerCompany || null,
      owner_profile_url: ownerProfileUrl,
      achieved_amount: currentAmount,
      target_amount: targetAmount > 0 ? targetAmount : null,
      achievement_rate: achievementRate,
      supporter_count: supporterCount,
      start_date: null,
      end_date: endDate,
      status: 'completed',
      raw_html: html.slice(0, 50_000),
    };
  }
}
