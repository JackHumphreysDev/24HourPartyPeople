export type ScrapeStatus = {
  lastAttemptedAt: string | null;
  lastError?: string | null;
  lastSucceededAt: string | null;
  latestRefreshFailed: boolean;
};

export type ScrapeRefreshResult = {
  imported: {
    fixturesImported: number;
    resultsImported: number;
    standingsImported: number;
  };
  scrapeStatus: ScrapeStatus;
};
