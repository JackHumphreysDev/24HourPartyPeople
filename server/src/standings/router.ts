import { Router, type Response } from 'express';
import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';

const TEAM_NAME = '24 Hour Party People';

const standingRowSchema = z
  .object({
    clubName: z.string().trim().min(1).max(100),
    drawn: z.int().min(0).max(1000),
    ga: z.int().min(0).max(10000),
    gf: z.int().min(0).max(10000),
    lost: z.int().min(0).max(1000),
    played: z.int().min(0).max(1000),
    points: z.int().min(0).max(10000),
    position: z.int().min(1).max(1000),
    walkoverGames: z.int().min(0).max(1000),
    won: z.int().min(0).max(1000),
  })
  .refine((row) => row.played === row.won + row.drawn + row.lost, {
    message: 'Played must equal won, drawn, and lost combined.',
    path: ['played'],
  })
  .refine((row) => row.walkoverGames <= row.played, {
    message: 'Walkovers cannot exceed games played.',
    path: ['walkoverGames'],
  });

const standingsSnapshotSchema = z
  .object({
    rows: z.array(standingRowSchema).min(1).max(100),
  })
  .superRefine(({ rows }, context) => {
    const positions = new Set<number>();
    const clubNames = new Set<string>();

    rows.forEach((row, index) => {
      const normalizedClubName = row.clubName.toLocaleLowerCase('en-GB');
      if (positions.has(row.position)) {
        context.addIssue({
          code: 'custom',
          message: 'Each league position must be unique.',
          path: ['rows', index, 'position'],
        });
      }
      if (clubNames.has(normalizedClubName)) {
        context.addIssue({
          code: 'custom',
          message: 'Each club name must be unique.',
          path: ['rows', index, 'clubName'],
        });
      }
      positions.add(row.position);
      clubNames.add(normalizedClubName);
    });

    if (!clubNames.has(TEAM_NAME.toLocaleLowerCase('en-GB'))) {
      context.addIssue({
        code: 'custom',
        message: `${TEAM_NAME} must be included in the standings.`,
        path: ['rows'],
      });
    }
  });

const standingSelect = {
  clubName: true,
  drawn: true,
  ga: true,
  gd: true,
  gf: true,
  id: true,
  lost: true,
  played: true,
  points: true,
  position: true,
  scrapedAt: true,
  walkoverGames: true,
  won: true,
} as const;

type StandingsClient = Prisma.TransactionClient | typeof prisma;

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

  throw new Error('The standings transaction could not be completed.');
}

async function getCurrentStandings(client: StandingsClient) {
  const season = await client.season.findFirst({
    select: { id: true, name: true },
    where: { isCurrent: true },
  });

  if (!season) {
    return { lastUpdated: null, season: null, standings: [] };
  }

  const standings = await client.seasonStanding.findMany({
    orderBy: [{ position: 'asc' }, { clubName: 'asc' }],
    select: standingSelect,
    where: { seasonId: season.id },
  });

  return {
    lastUpdated: standings[0]?.scrapedAt ?? null,
    season,
    standings,
  };
}

function invalidStandingsResponse(response: Response): void {
  response.status(400).json({
    error: {
      code: 'INVALID_STANDINGS',
      message:
        'Enter a complete table with unique clubs and positions, consistent results, and 24 Hour Party People included.',
    },
  });
}

export const publicStandingsRouter = Router();

publicStandingsRouter.get('/current', async (_request, response) => {
  response.status(200).json(await getCurrentStandings(prisma));
});

export const adminStandingsRouter = Router();

adminStandingsRouter.use(requireAuthentication, requireAdmin);

adminStandingsRouter.get('/', async (_request, response) => {
  response.status(200).json(await getCurrentStandings(prisma));
});

adminStandingsRouter.put('/current', async (request, response) => {
  const parsed = standingsSnapshotSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidStandingsResponse(response);
    return;
  }

  const snapshot = await runSerializableTransaction(async (transaction) => {
    const season = await transaction.season.findFirst({
      select: { id: true },
      where: { isCurrent: true },
    });

    if (!season) {
      return null;
    }

    const lastUpdated = new Date();
    await transaction.seasonStanding.deleteMany({
      where: { seasonId: season.id },
    });
    await transaction.seasonStanding.createMany({
      data: parsed.data.rows.map((row) => ({
        ...row,
        gd: row.gf - row.ga,
        scrapedAt: lastUpdated,
        seasonId: season.id,
      })),
    });

    return getCurrentStandings(transaction);
  });

  if (!snapshot) {
    response.status(409).json({
      error: {
        code: 'CURRENT_SEASON_REQUIRED',
        message: 'Create a current season before saving standings.',
      },
    });
    return;
  }

  response.status(200).json(snapshot);
});
