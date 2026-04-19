export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRequestDelay(): number {
  return parseInt(process.env.SCRAPER_REQUEST_DELAY_MS ?? '2000', 10);
}
