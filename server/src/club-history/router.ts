import { Router, type Response } from 'express';
import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';

const TEAM_NAME = '24 Hour Party People';
const seasonIdSchema = z.uuid();

const historySelect = {
  finalisedAt: true,
  ga: true,
  gd: true,
  gf: true,
  id: true,
  lost: true,
  played: true,
  points: true,
  position: true,
  season: {
    select: {
      endDate: true,
      id: true,
      name: true,
      startDate: true,
    },
  },
  walkoverGames: true,
  won: true,
  drawn: true,
} as const;

const standingSelect = {
  drawn: true,
  ga: true,
  gd: true,
  gf: true,
  lost: true,
  played: true,
  points: true,
  position: true,
  walkoverGames: true,
  won: true,
} as const;

class SeasonNotFoundError extends Error {}
class SeasonNotEndedError extends Error {}
class SeasonPredatesHistoryError extends Error {}
class HistoryAlreadyFinalisedError extends Error {}
class TeamStandingRequiredError extends Error {}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function sheffieldToday(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/London',
    year: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

function withClubName<T>(history: T): T & { clubName: string } {
  return { ...history, clubName: TEAM_NAME };
}

async function getFinalisedHistory() {
  const history = await prisma.clubHistory.findMany({
    orderBy: { season: { endDate: 'desc' } },
    select: historySelect,
    where: { finalisedAt: { not: null } },
  });

  return history.map(withClubName);
}

async function getFinalisationCandidates() {
  const seasons = await prisma.season.findMany({
    orderBy: { endDate: 'desc' },
    select: {
      endDate: true,
      id: true,
      name: true,
      standings: {
        select: standingSelect,
        where: {
          clubName: { equals: TEAM_NAME, mode: 'insensitive' },
        },
      },
      startDate: true,
    },
    where: {
      clubHistory: null,
      endDate: { lt: sheffieldToday() },
      tracksGamesPlayed: true,
    },
  });

  return seasons.map(({ standings, ...season }) => ({
    ...season,
    standing: standings[0] ?? null,
  }));
}

async function runSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (hasErrorCode(error, 'P2034') && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Club history could not be finalised.');
}

function handleFinalisationError(error: unknown, response: Response): boolean {
  if (error instanceof SeasonNotFoundError) {
    response.status(404).json({
      error: { code: 'SEASON_NOT_FOUND', message: 'Season not found.' },
    });
    return true;
  }

  if (error instanceof SeasonNotEndedError) {
    response.status(409).json({
      error: {
        code: 'SEASON_NOT_ENDED',
        message: 'Club history can only be finalised after the season ends.',
      },
    });
    return true;
  }

  if (error instanceof SeasonPredatesHistoryError) {
    response.status(409).json({
      error: {
        code: 'SEASON_PREDATES_CLUB_HISTORY',
        message: 'That season predates the club history record.',
      },
    });
    return true;
  }

  if (
    error instanceof HistoryAlreadyFinalisedError ||
    hasErrorCode(error, 'P2002')
  ) {
    response.status(409).json({
      error: {
        code: 'HISTORY_ALREADY_FINALISED',
        message: 'That season has already been finalised.',
      },
    });
    return true;
  }

  if (error instanceof TeamStandingRequiredError) {
    response.status(409).json({
      error: {
        code: 'TEAM_STANDING_REQUIRED',
        message:
          'Save a 24 Hour Party People standings row before finalising this season.',
      },
    });
    return true;
  }

  return false;
}

export const publicClubHistoryRouter = Router();

publicClubHistoryRouter.get('/', async (_request, response) => {
  response.status(200).json({ history: await getFinalisedHistory() });
});

export const adminClubHistoryRouter = Router();

adminClubHistoryRouter.use(requireAuthentication, requireAdmin);

adminClubHistoryRouter.get('/', async (_request, response) => {
  const [history, candidates] = await Promise.all([
    getFinalisedHistory(),
    getFinalisationCandidates(),
  ]);
  response.status(200).json({ candidates, history });
});

adminClubHistoryRouter.post(
  '/:seasonId/finalise',
  async (request, response) => {
    const seasonId = seasonIdSchema.safeParse(request.params.seasonId);
    if (!seasonId.success) {
      handleFinalisationError(new SeasonNotFoundError(), response);
      return;
    }

    try {
      const history = await runSerializableTransaction(async (transaction) => {
        const season = await transaction.season.findUnique({
          select: {
            clubHistory: { select: { id: true } },
            endDate: true,
            id: true,
            standings: {
              select: standingSelect,
              where: {
                clubName: { equals: TEAM_NAME, mode: 'insensitive' },
              },
            },
            tracksGamesPlayed: true,
          },
          where: { id: seasonId.data },
        });

        if (!season) {
          throw new SeasonNotFoundError();
        }
        if (season.endDate >= sheffieldToday()) {
          throw new SeasonNotEndedError();
        }
        if (!season.tracksGamesPlayed) {
          throw new SeasonPredatesHistoryError();
        }
        if (season.clubHistory) {
          throw new HistoryAlreadyFinalisedError();
        }

        const standing = season.standings[0];
        if (!standing) {
          throw new TeamStandingRequiredError();
        }

        return transaction.clubHistory.create({
          data: {
            ...standing,
            finalisedAt: new Date(),
            seasonId: season.id,
          },
          select: historySelect,
        });
      });

      response.status(201).json({ history: withClubName(history) });
    } catch (error) {
      if (!handleFinalisationError(error, response)) {
        throw error;
      }
    }
  },
);
