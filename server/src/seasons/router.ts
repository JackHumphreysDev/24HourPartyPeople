import { Router, type Response } from 'express';
import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';

const seasonIdSchema = z.uuid();
const seasonSchema = z
  .object({
    endDate: z.iso.date(),
    isCurrent: z.boolean(),
    name: z.string().trim().min(1).max(100),
    startDate: z.iso.date(),
    tracksGamesPlayed: z.boolean(),
  })
  .superRefine((season, context) => {
    if (season.endDate < season.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'The end date must be on or after the start date.',
        path: ['endDate'],
      });
    }
  });

const seasonSelect = {
  endDate: true,
  id: true,
  isCurrent: true,
  name: true,
  startDate: true,
  tracksGamesPlayed: true,
} as const;

class CurrentSeasonRequiredError extends Error {}
class CurrentSeasonCannotBeUnsetError extends Error {}
class TrackedGamesExistError extends Error {}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
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

  throw new Error('The season transaction could not be completed.');
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function invalidSeasonResponse(response: Response): void {
  response.status(400).json({
    error: {
      code: 'INVALID_SEASON',
      message:
        'Enter a valid name, date range, current-season status, and games-played setting.',
    },
  });
}

function seasonNotFoundResponse(response: Response): void {
  response.status(404).json({
    error: {
      code: 'SEASON_NOT_FOUND',
      message: 'Season not found.',
    },
  });
}

export const adminSeasonsRouter = Router();

adminSeasonsRouter.use(requireAuthentication, requireAdmin);

adminSeasonsRouter.get('/', async (_request, response) => {
  const seasons = await prisma.season.findMany({
    orderBy: { startDate: 'desc' },
    select: seasonSelect,
  });

  response.status(200).json({ seasons });
});

adminSeasonsRouter.post('/', async (request, response) => {
  const parsed = seasonSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidSeasonResponse(response);
    return;
  }

  try {
    const season = await runSerializableTransaction(async (transaction) => {
      const seasonCount = await transaction.season.count();
      if (seasonCount === 0 && !parsed.data.isCurrent) {
        throw new CurrentSeasonRequiredError();
      }

      if (parsed.data.isCurrent) {
        await transaction.season.updateMany({
          data: { isCurrent: false },
          where: { isCurrent: true },
        });
      }

      return transaction.season.create({
        data: {
          ...parsed.data,
          endDate: dateFromInput(parsed.data.endDate),
          startDate: dateFromInput(parsed.data.startDate),
        },
        select: seasonSelect,
      });
    });

    response.status(201).json({ season });
  } catch (error) {
    if (error instanceof CurrentSeasonRequiredError) {
      response.status(409).json({
        error: {
          code: 'CURRENT_SEASON_REQUIRED',
          message: 'The first season must be the current season.',
        },
      });
      return;
    }

    throw error;
  }
});

adminSeasonsRouter.put('/:seasonId', async (request, response) => {
  const seasonId = seasonIdSchema.safeParse(request.params.seasonId);
  if (!seasonId.success) {
    seasonNotFoundResponse(response);
    return;
  }

  const parsed = seasonSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidSeasonResponse(response);
    return;
  }

  try {
    const season = await runSerializableTransaction(async (transaction) => {
      const existingSeason = await transaction.season.findUnique({
        select: {
          id: true,
          isCurrent: true,
          tracksGamesPlayed: true,
        },
        where: { id: seasonId.data },
      });

      if (!existingSeason) {
        return null;
      }

      if (existingSeason.isCurrent && !parsed.data.isCurrent) {
        throw new CurrentSeasonCannotBeUnsetError();
      }

      if (existingSeason.tracksGamesPlayed && !parsed.data.tracksGamesPlayed) {
        const trackedStatCount = await transaction.playerSeasonStat.count({
          where: {
            gamesPlayed: { not: null },
            seasonId: existingSeason.id,
          },
        });

        if (trackedStatCount > 0) {
          throw new TrackedGamesExistError();
        }
      }

      if (parsed.data.isCurrent && !existingSeason.isCurrent) {
        await transaction.season.updateMany({
          data: { isCurrent: false },
          where: { isCurrent: true },
        });
      }

      return transaction.season.update({
        data: {
          ...parsed.data,
          endDate: dateFromInput(parsed.data.endDate),
          startDate: dateFromInput(parsed.data.startDate),
        },
        select: seasonSelect,
        where: { id: existingSeason.id },
      });
    });

    if (!season) {
      seasonNotFoundResponse(response);
      return;
    }

    response.status(200).json({ season });
  } catch (error) {
    if (error instanceof CurrentSeasonCannotBeUnsetError) {
      response.status(409).json({
        error: {
          code: 'CURRENT_SEASON_CANNOT_BE_UNSET',
          message: 'Make another season current instead.',
        },
      });
      return;
    }

    if (error instanceof TrackedGamesExistError) {
      response.status(409).json({
        error: {
          code: 'TRACKED_GAMES_EXIST',
          message:
            'Games played cannot be disabled after tracked statistics exist.',
        },
      });
      return;
    }

    throw error;
  }
});
