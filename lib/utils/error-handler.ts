import { log } from './logger';
import { notifyDiscord } from '../notify/discord';

export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class RateLimitError extends ScraperError {
  constructor() {
    super('Rate limit exceeded (429)', 429, false);
    this.name = 'RateLimitError';
  }
}

export class ConsecutiveErrorTracker {
  private count = 0;
  private readonly threshold = 3;
  private haltUntil: number | null = null;

  isHalted(): boolean {
    if (this.haltUntil !== null && Date.now() < this.haltUntil) return true;
    if (this.haltUntil !== null) this.haltUntil = null;
    return false;
  }

  async recordError(statusCode: number, platform: string): Promise<void> {
    if ([403, 429, 500].includes(statusCode)) {
      this.count++;
      log('warn', 'consecutive_error', { statusCode, count: this.count, platform });

      if (statusCode === 429) {
        this.haltUntil = Date.now() + 24 * 60 * 60 * 1000;
        log('error', 'scraper_halted_rate_limit', { platform, haltUntil: new Date(this.haltUntil).toISOString() });
        await notifyDiscord(`⛔ ${platform}: レートリミット(429)により24時間停止`);
        return;
      }

      if (this.count >= this.threshold) {
        this.haltUntil = Date.now() + 24 * 60 * 60 * 1000;
        log('error', 'scraper_halted_consecutive_errors', { platform, count: this.count });
        await notifyDiscord(`⛔ ${platform}: 連続${this.count}回エラー(${statusCode})により24時間停止`);
      }
    }
  }

  reset(): void {
    this.count = 0;
  }
}
