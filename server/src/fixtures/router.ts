import { Router, type Response } from 'express';
import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';
import { getScrapeStatus } from '../scrape/status.js';

const fixtureIdSchema = z.uuid();
const availabilitySchema = z.object({
  response: z.enum(['AVAILABLE', 'UNSURE', 'UNAVAILABLE']),
});
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
const fixtureSchema = z.object({
  competition: z.enum(['LEAGUE', 'CUP']),
  opponentName: z.string().trim().min(1).max(100),
  scheduledDate: z.iso.date(),
  scheduledTime: timeSchema,
  seasonId: z.uuid(),
  venue: z.string().trim().max(200).nullable(),
});

const fixtureSelect = {
  competition: true,
  id: true,
  opponentClub: {
    select: {
      id: true,
      name: true,
    },
  },
  result: {
    select: {
      id: true,
    },
  },
  scheduledDate: true,
  scheduledTime: true,
  season: {
    select: {
      id: true,
      name: true,
    },
  },
  source: true,
  status: true,
  venue: true,
} as const;

class SeasonNotFoundError extends Error {}
class FixtureOutsideSeasonError extends Error {}
class DuplicateFixtureError extends Error {}
class FixtureLockedError extends Error {}

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
      if (
        (hasErrorCode(error, 'P2002') || hasErrorCode(error, 'P2034')) &&
        attempt === 0
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('The fixture transaction could not be completed.');
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeFromInput(value: string | null): Date | null {
  return value ? new Date(`1970-01-01T${value}:00.000Z`) : null;
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

  return dateFromInput(`${values.year}-${values.month}-${values.day}`);
}

function invalidFixtureResponse(response: Response): void {
  response.status(400).json({
    error: {
      code: 'INVALID_FIXTURE',
      message:
        'Enter a valid season, opponent, competition, date, time, and venue.',
    },
  });
}

function fixtureNotFoundResponse(response: Response): void {
  response.status(404).json({
    error: {
      code: 'FIXTURE_NOT_FOUND',
      message: 'Fixture not found.',
    },
  });
}

async function resolveFixtureRelations(
  transaction: Prisma.TransactionClient,
  input: z.infer<typeof fixtureSchema>,
) {
  const season = await transaction.season.findUnique({
    select: { endDate: true, id: true, startDate: true },
    where: { id: input.seasonId },
  });

  if (!season) {
    throw new SeasonNotFoundError();
  }

  const scheduledDate = dateFromInput(input.scheduledDate);
  if (scheduledDate < season.startDate || scheduledDate > season.endDate) {
    throw new FixtureOutsideSeasonError();
  }

  const existingOpponent = await transaction.opponentClub.findFirst({
    select: { id: true },
    where: {
      name: {
        equals: input.opponentName,
        mode: 'insensitive',
      },
    },
  });
  const opponent =
    existingOpponent ??
    (await transaction.opponentClub.create({
      data: { name: input.opponentName },
      select: { id: true },
    }));

  return {
    opponentClubId: opponent.id,
    scheduledDate,
    scheduledTime: timeFromInput(input.scheduledTime),
    seasonId: season.id,
  };
}

async function requireUniqueFixture(
  transaction: Prisma.TransactionClient,
  values: {
    competition: 'LEAGUE' | 'CUP';
    fixtureId?: string;
    opponentClubId: string;
    scheduledDate: Date;
    scheduledTime: Date | null;
    seasonId: string;
  },
): Promise<void> {
  const duplicate = await transaction.fixture.findFirst({
    select: { id: true },
    where: {
      competition: values.competition,
      id: values.fixtureId ? { not: values.fixtureId } : undefined,
      opponentClubId: values.opponentClubId,
      scheduledDate: values.scheduledDate,
      scheduledTime: values.scheduledTime,
      seasonId: values.seasonId,
    },
  });

  if (duplicate) {
    throw new DuplicateFixtureError();
  }
}

function handleFixtureError(error: unknown, response: Response): boolean {
  if (error instanceof SeasonNotFoundError) {
    response.status(404).json({
      error: {
        code: 'SEASON_NOT_FOUND',
        message: 'Season not found.',
      },
    });
    return true;
  }

  if (error instanceof FixtureOutsideSeasonError) {
    response.status(400).json({
      error: {
        code: 'FIXTURE_OUTSIDE_SEASON',
        message: 'The fixture date must fall within the selected season.',
      },
    });
    return true;
  }

  if (error instanceof DuplicateFixtureError) {
    response.status(409).json({
      error: {
        code: 'DUPLICATE_FIXTURE',
        message: 'That fixture has already been recorded.',
      },
    });
    return true;
  }

  if (error instanceof FixtureLockedError) {
    response.status(409).json({
      error: {
        code: 'FIXTURE_LOCKED',
        message: 'Played and walkover fixtures cannot be edited.',
      },
    });
    return true;
  }

  return false;
}

export const publicFixturesRouter = Router();

publicFixturesRouter.get('/upcoming', async (_request, response) => {
  const fixtures = await prisma.fixture.findMany({
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    select: fixtureSelect,
    where: {
      scheduledDate: { gte: sheffieldToday() },
      status: 'SCHEDULED',
    },
  });

  response.status(200).json({
    fixtures,
    scrapeStatus: await getScrapeStatus(),
  });
});

publicFixturesRouter.get(
  '/availability',
  requireAuthentication,
  async (request, response) => {
    const user = request.authUser!;
    if (user.role !== 'PLAYER' || !user.playerId) {
      response.status(403).json({
        error: {
          code: 'APPROVED_PLAYER_REQUIRED',
          message: 'An approved player profile is required.',
        },
      });
      return;
    }

    const availability = await prisma.fixtureAvailability.findMany({
      select: { fixtureId: true, response: true },
      where: {
        fixture: {
          scheduledDate: { gte: sheffieldToday() },
          status: 'SCHEDULED',
        },
        playerId: user.playerId,
      },
    });
    response.status(200).json({ availability });
  },
);

publicFixturesRouter.put(
  '/:fixtureId/availability',
  requireAuthentication,
  async (request, response) => {
    const user = request.authUser!;
    if (user.role !== 'PLAYER' || !user.playerId) {
      response.status(403).json({
        error: {
          code: 'APPROVED_PLAYER_REQUIRED',
          message: 'An approved player profile is required.',
        },
      });
      return;
    }

    const fixtureId = fixtureIdSchema.safeParse(request.params.fixtureId);
    const parsed = availabilitySchema.safeParse(request.body);
    if (!fixtureId.success || !parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_AVAILABILITY',
          message: 'Select a valid fixture and availability response.',
        },
      });
      return;
    }

    const availability = await runSerializableTransaction(
      async (transaction) => {
        const fixture = await transaction.fixture.findUnique({
          select: { scheduledDate: true, status: true },
          where: { id: fixtureId.data },
        });
        if (
          !fixture ||
          fixture.status !== 'SCHEDULED' ||
          fixture.scheduledDate < sheffieldToday()
        ) {
          return null;
        }

        return transaction.fixtureAvailability.upsert({
          create: {
            fixtureId: fixtureId.data,
            playerId: user.playerId!,
            response: parsed.data.response,
          },
          update: { response: parsed.data.response },
          where: {
            fixtureId_playerId: {
              fixtureId: fixtureId.data,
              playerId: user.playerId!,
            },
          },
          select: { fixtureId: true, response: true },
        });
      },
    );

    if (!availability) {
      response.status(409).json({
        error: {
          code: 'FIXTURE_NOT_OPEN',
          message: 'Availability is only open for upcoming fixtures.',
        },
      });
      return;
    }
    response.status(200).json({ availability });
  },
);

export const adminFixturesRouter = Router();

adminFixturesRouter.use(requireAuthentication, requireAdmin);

adminFixturesRouter.get('/availability', async (_request, response) => {
  const fixtures = await prisma.fixture.findMany({
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    select: {
      availability: {
        orderBy: { player: { name: 'asc' } },
        select: {
          player: { select: { id: true, name: true } },
          response: true,
          updatedAt: true,
        },
      },
      id: true,
    },
    where: {
      scheduledDate: { gte: sheffieldToday() },
      status: 'SCHEDULED',
    },
  });
  response.status(200).json({ fixtures });
});

adminFixturesRouter.get('/', async (_request, response) => {
  const fixtures = await prisma.fixture.findMany({
    orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
    select: fixtureSelect,
  });

  response.status(200).json({ fixtures });
});

adminFixturesRouter.post('/', async (request, response) => {
  const parsed = fixtureSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidFixtureResponse(response);
    return;
  }

  try {
    const fixture = await runSerializableTransaction(async (transaction) => {
      const relations = await resolveFixtureRelations(transaction, parsed.data);
      await requireUniqueFixture(transaction, {
        competition: parsed.data.competition,
        ...relations,
      });

      return transaction.fixture.create({
        data: {
          competition: parsed.data.competition,
          ...relations,
          source: 'MANUAL',
          venue: parsed.data.venue || null,
        },
        select: fixtureSelect,
      });
    });

    response.status(201).json({ fixture });
  } catch (error) {
    if (!handleFixtureError(error, response)) {
      throw error;
    }
  }
});

adminFixturesRouter.put('/:fixtureId', async (request, response) => {
  const fixtureId = fixtureIdSchema.safeParse(request.params.fixtureId);
  if (!fixtureId.success) {
    fixtureNotFoundResponse(response);
    return;
  }

  const parsed = fixtureSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidFixtureResponse(response);
    return;
  }

  try {
    const fixture = await runSerializableTransaction(async (transaction) => {
      const existingFixture = await transaction.fixture.findUnique({
        select: {
          id: true,
          result: { select: { id: true } },
          status: true,
        },
        where: { id: fixtureId.data },
      });

      if (!existingFixture) {
        return null;
      }

      if (existingFixture.status !== 'SCHEDULED' || existingFixture.result) {
        throw new FixtureLockedError();
      }

      const relations = await resolveFixtureRelations(transaction, parsed.data);
      await requireUniqueFixture(transaction, {
        competition: parsed.data.competition,
        fixtureId: existingFixture.id,
        ...relations,
      });

      return transaction.fixture.update({
        data: {
          competition: parsed.data.competition,
          ...relations,
          venue: parsed.data.venue || null,
        },
        select: fixtureSelect,
        where: { id: existingFixture.id },
      });
    });

    if (!fixture) {
      fixtureNotFoundResponse(response);
      return;
    }

    response.status(200).json({ fixture });
  } catch (error) {
    if (!handleFixtureError(error, response)) {
      throw error;
    }
  }
});
