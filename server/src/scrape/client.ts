import { scrapePayloadSchema, type ScrapePayload } from './schema.js';

export class ScraperUnavailableError extends Error {}

export async function requestPowerleagueScrape(): Promise<ScrapePayload> {
  const serviceUrl = process.env.POWERLEAGUE_SCRAPER_URL;
  const serviceKey = process.env.SCRAPER_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) {
    throw new ScraperUnavailableError(
      'The Powerleague scraper service is not configured.',
    );
  }

  try {
    const baseUrl = serviceUrl.endsWith('/') ? serviceUrl : `${serviceUrl}/`;
    const response = await fetch(new URL('scrape', baseUrl), {
      headers: { Authorization: `Bearer ${serviceKey}` },
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      throw new ScraperUnavailableError(
        `The Powerleague scraper returned HTTP ${response.status}.`,
      );
    }

    const parsed = scrapePayloadSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ScraperUnavailableError(
        'The Powerleague scraper returned invalid data.',
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ScraperUnavailableError) {
      throw error;
    }
    throw new ScraperUnavailableError(
      error instanceof Error
        ? `The Powerleague scraper could not be reached: ${error.message}`
        : 'The Powerleague scraper could not be reached.',
    );
  }
}
