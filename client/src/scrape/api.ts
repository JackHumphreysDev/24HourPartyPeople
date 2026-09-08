import type { ScrapeRefreshResult } from './types';

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function refreshPowerleague(): Promise<ScrapeRefreshResult> {
  const response = await fetch('/api/admin/scrape/refresh', {
    credentials: 'include',
    method: 'POST',
  });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as ErrorResponse | null;
    throw new Error(
      body?.error?.message ?? 'Powerleague could not be refreshed.',
    );
  }
  return (await response.json()) as ScrapeRefreshResult;
}
