import { timingSafeEqual } from 'node:crypto';

import { Router, type Request, type Response } from 'express';

import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import {
  CurrentSeasonRequiredError,
  refreshPowerleagueData,
  ScrapeRefreshError,
} from './refresh.js';
import { getScrapeStatus } from './status.js';

function safeMatches(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function handleRefresh(_request: Request, response: Response) {
  try {
    const imported = await refreshPowerleagueData();
    response.status(200).json({
      imported,
      scrapeStatus: await getScrapeStatus(undefined, true),
    });
  } catch (error) {
    if (error instanceof CurrentSeasonRequiredError) {
      response.status(409).json({
        error: {
          code: 'CURRENT_SEASON_REQUIRED',
          message: error.message,
        },
      });
      return;
    }
    if (error instanceof ScrapeRefreshError) {
      response.status(502).json({
        error: {
          code: 'SCRAPE_REFRESH_FAILED',
          message: error.message,
        },
      });
      return;
    }
    throw error;
  }
}

export const adminScrapeRouter = Router();
adminScrapeRouter.use(requireAuthentication, requireAdmin);
adminScrapeRouter.get('/status', async (_request, response) => {
  response.status(200).json({
    scrapeStatus: await getScrapeStatus(undefined, true),
  });
});
adminScrapeRouter.post('/refresh', handleRefresh);

export const scheduledScrapeRouter = Router();
scheduledScrapeRouter.get('/refresh', async (request, response, next) => {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.header('authorization') ?? '';
  if (!cronSecret || !safeMatches(authorization, `Bearer ${cronSecret}`)) {
    response.status(401).json({
      error: {
        code: 'INVALID_CRON_CREDENTIALS',
        message: 'Valid cron credentials are required.',
      },
    });
    return;
  }

  try {
    await handleRefresh(request, response);
  } catch (error) {
    next(error);
  }
});
