import { load } from 'cheerio';
import { delay, getRequestDelay } from '../utils/delay';
import { isAllowed } from '../utils/robots-checker';
import { ConsecutiveErrorTracker, ScraperError } from '../utils/error-handler';
import { log } from '../utils/logger';
import type { Platform, ScrapedProject } from '@/types/project';

export abstract class BaseScraper {
  protected readonly platform: Platform;
  protected readonly baseUrl: string;
  protected readonly userAgent: string;
  protected readonly requestDelay: number;
  protected readonly maxPages: number;
  protected readonly errorTracker: ConsecutiveErrorTracker;

  constructor(platform: Platform, baseUrl: string) {
    this.platform = platform;
    this.baseUrl = baseUrl;
    this.userAgent = process.env.SCRAPER_USER_AGENT ?? 'CFExit-Bot/1.0 (contact@cfexit.jp)';
    this.requestDelay = getRequestDelay();
    this.maxPages = parseInt(process.env.SCRAPER_MAX_PAGES_PER_RUN ?? '50', 10);
    this.errorTracker = new ConsecutiveErrorTracker();
  }

  protected async fetch(path: string): Promise<string> {
    if (this.errorTracker.isHalted()) {
      throw new ScraperError('Scraper is halted due to consecutive errors', undefined, false);
    }

    const allowed = await isAllowed(this.baseUrl, path);
    if (!allowed) {
      throw new ScraperError(`Path disallowed by robots.txt: ${path}`, undefined, false);
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    log('info', 'fetch_start', { platform: this.platform, url });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.5',
          },
        });

        if (!res.ok) {
          await this.errorTracker.recordError(res.status, this.platform);

          if (res.status === 429 || res.status === 403) {
            throw new ScraperError(`HTTP ${res.status}`, res.status, false);
          }
          if (res.status >= 500 && attempt < 3) {
            log('warn', 'fetch_retry', { url, status: res.status, attempt });
            await delay(30_000);
            lastError = new ScraperError(`HTTP ${res.status}`, res.status);
            continue;
          }
          throw new ScraperError(`HTTP ${res.status}`, res.status, false);
        }

        this.errorTracker.reset();
        return res.text();
      } catch (err) {
        if (err instanceof ScraperError && !err.retryable) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 3) {
          log('warn', 'fetch_retry_network', { url, attempt, error: lastError.message });
          await delay(5_000);
        }
      }
    }

    throw lastError ?? new ScraperError('Max retries exceeded');
  }

  protected load(html: string): ReturnType<typeof load> {
    return load(html);
  }

  abstract scrapeListPage(page: number): Promise<string[]>;
  abstract scrapeProjectPage(url: string): Promise<ScrapedProject | null>;

  async run(): Promise<ScrapedProject[]> {
    const results: ScrapedProject[] = [];

    for (let page = 1; page <= this.maxPages; page++) {
      if (this.errorTracker.isHalted()) break;

      log('info', 'scrape_page_start', { platform: this.platform, page });

      let urls: string[];
      try {
        urls = await this.scrapeListPage(page);
      } catch (err) {
        log('error', 'scrape_list_page_error', { platform: this.platform, page, error: String(err) });
        break;
      }

      if (urls.length === 0) {
        log('info', 'scrape_list_empty', { platform: this.platform, page });
        break;
      }

      for (const url of urls) {
        if (this.errorTracker.isHalted()) break;

        await delay(this.requestDelay);

        try {
          const project = await this.scrapeProjectPage(url);
          if (project) results.push(project);
        } catch (err) {
          log('error', 'scrape_project_error', { platform: this.platform, url, error: String(err) });
        }
      }

      if (page < this.maxPages) {
        await delay(this.requestDelay);
      }
    }

    return results;
  }
}
