import { Router, type Response } from 'express';
import { z } from 'zod';

import type { Competition, Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';

const scoreSchema = z.number().int().min(0).max(2_147_483_647);
const resultScoreSchema = z
  .object({
    isWalkover: z.boolean(),
    opponentScore: scoreSchema.nullable(),
    ourScore: scoreSchema.nullable(),
    walkoverReason: z.string().trim().max(500).nullable(),
  })
  .superRefine((result, context) => {
    if (result.isWalkover) {
      if (result.ourScore !== null || result.opponentScore !== null) {
        context.addIssue({
          code: 'custom',
          message: 'Walkovers cannot have a score.',
          path: ['ourScore'],
        });
      }
      return;
    }

    if (result.ourScore === null || result.opponentScore === null) {
      context.addIssue({
        code: 'custom',
        message: 'Both scores are required.',
        path: ['ourScore'],
      });
    }
  });

const fixtureResultSchema = z
  .object({
    entryMode: z.literal('fixture'),
    fixtureId: z.uuid(),
  })
  .and(resultScoreSchema);

const manualResultSchema = z
  .object({
    competition: z.enum(['LEAGUE', 'CUP']),
    datePlayed: z.iso.date(),
    entryMode: z.literal('manual'),
    opponentName: z.string().trim().min(1).max(100),
    seasonId: z.uuid(),
  })
  .and(resultScoreSchema);

const gameResultSchema = z.union([fixtureResultSchema, manualResultSchema]);
const gameIdSchema = z.uuid();
const playerContributionSchema = z.object({
  assists: z.number().int().min(0).max(100),
  cleanSheet: z.boolean(),
  goals: z.number().int().min(0).max(100),
  playerId: z.uuid(),
});
const playerContributionsSchema = z.object({
  playerStats: z.array(playerContributionSchema).max(50),
});

const gameResultSelect = {
  competition: true,
  createdAt: true,
  datePlayed: true,
  fixtureId: true,
  id: true,
  isWalkover: true,
  opponentClub: {
    select: {
      id: true,
      name: true,
    },
  },
  opponentScore: true,
  ourScore: true,
  season: {
    select: {
      id: true,
      name: true,
    },
  },
  walkoverReason: true,
} as const;

class FixtureNotFoundError extends Error {}
class FixtureAlreadyRecordedError extends Error {}
class SeasonNotFoundError extends Error {}
class ResultOutsideSeasonError extends Error {}
class CupWalkoverError extends Error {}
class GameNotFoundError extends Error {}
class PerGameStatsUnavailableError extends Error {}
class InvalidPlayerContributionsError extends Error {}

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

  throw new Error('The game-result transaction could not be completed.');
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function invalidGameResponse(response: Response): void {
  response.status(400).json({
    error: {
      code: 'INVALID_GAME_RESULT',
      message:
        'Enter a valid fixture or manual game, result type, and non-negative scores.',
    },
  });
}

export const publicGamesRouter = Router();

publicGamesRouter.get('/', async (_request, response) => {
  const games = await prisma.gameResult.findMany({
    orderBy: [{ datePlayed: 'desc' }, { createdAt: 'desc' }],
    select: gameResultSelect,
  });

  response.status(200).json({ games });
});

export const adminGamesRouter = Router();

adminGamesRouter.use(requireAuthentication, requireAdmin);

adminGamesRouter.get('/fixtures', async (_request, response) => {
  const fixtures = await prisma.fixture.findMany({
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    select: {
      competition: true,
      id: true,
      opponentClub: {
        select: {
          id: true,
          name: true,
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
      venue: true,
    },
    where: { status: 'SCHEDULED' },
  });

  response.status(200).json({ fixtures });
});

adminGamesRouter.get('/player-stats', async (_request, response) => {
  const [games, players] = await Promise.all([
    prisma.gameResult.findMany({
      orderBy: [{ datePlayed: 'desc' }, { createdAt: 'desc' }],
      select: {
        competition: true,
        datePlayed: true,
        id: true,
        opponentClub: { select: { name: true } },
        opponentScore: true,
        ourScore: true,
        playerStats: {
          orderBy: { player: { name: 'asc' } },
          select: {
            assists: true,
            cleanSheet: true,
            goals: true,
            playerId: true,
          },
        },
        season: { select: { id: true, name: true } },
      },
      where: {
        isWalkover: false,
        season: { tracksGamesPlayed: true },
      },
    }),
    prisma.player.findMany({
      orderBy: [{ isActiveSquad: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        isActiveSquad: true,
        name: true,
        position: true,
      },
    }),
  ]);
  response.status(200).json({ games, players });
});

adminGamesRouter.put('/:gameId/player-stats', async (request, response) => {
  const gameId = gameIdSchema.safeParse(request.params.gameId);
  const parsed = playerContributionsSchema.safeParse(request.body);
  if (!gameId.success || !parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_PLAYER_STATS',
        message: 'Enter valid player contributions for this game.',
      },
    });
    return;
  }

  const uniquePlayerIds = new Set(
    parsed.data.playerStats.map((stat) => stat.playerId),
  );
  if (uniquePlayerIds.size !== parsed.data.playerStats.length) {
    response.status(400).json({
      error: {
        code: 'DUPLICATE_PLAYER_STATS',
        message: 'Each player can appear only once for a game.',
      },
    });
    return;
  }

  try {
    const playerStats = await runSerializableTransaction(
      async (transaction) => {
        const game = await transaction.gameResult.findUnique({
          select: {
            isWalkover: true,
            opponentScore: true,
            ourScore: true,
            season: { select: { tracksGamesPlayed: true } },
          },
          where: { id: gameId.data },
        });
        if (!game) throw new GameNotFoundError();
        if (game.isWalkover || !game.season.tracksGamesPlayed) {
          throw new PerGameStatsUnavailableError();
        }

        const goals = parsed.data.playerStats.reduce(
          (total, stat) => total + stat.goals,
          0,
        );
        const assists = parsed.data.playerStats.reduce(
          (total, stat) => total + stat.assists,
          0,
        );
        if (
          game.ourScore === null ||
          goals > game.ourScore ||
          assists > game.ourScore ||
          (game.opponentScore !== 0 &&
            parsed.data.playerStats.some((stat) => stat.cleanSheet))
        ) {
          throw new InvalidPlayerContributionsError();
        }

        const playerCount = await transaction.player.count({
          where: { id: { in: [...uniquePlayerIds] } },
        });
        if (playerCount !== uniquePlayerIds.size) {
          throw new InvalidPlayerContributionsError();
        }

        await transaction.gamePlayerStat.deleteMany({
          where: { gameResultId: gameId.data },
        });
        if (parsed.data.playerStats.length > 0) {
          await transaction.gamePlayerStat.createMany({
            data: parsed.data.playerStats.map((stat) => ({
              ...stat,
              gameResultId: gameId.data,
            })),
          });
        }
        return transaction.gamePlayerStat.findMany({
          orderBy: { player: { name: 'asc' } },
          select: {
            assists: true,
            cleanSheet: true,
            goals: true,
            playerId: true,
          },
          where: { gameResultId: gameId.data },
        });
      },
    );
    response.status(200).json({ playerStats });
  } catch (error) {
    if (error instanceof GameNotFoundError) {
      response.status(404).json({
        error: { code: 'GAME_NOT_FOUND', message: 'Game not found.' },
      });
      return;
    }
    if (error instanceof PerGameStatsUnavailableError) {
      response.status(409).json({
        error: {
          code: 'PLAYER_STATS_UNAVAILABLE',
          message:
            'Per-game player statistics start with a tracked season and are not recorded for walkovers.',
        },
      });
      return;
    }
    if (error instanceof InvalidPlayerContributionsError) {
      response.status(400).json({
        error: {
          code: 'INVALID_PLAYER_STATS',
          message:
            'Player goals and assists cannot exceed the team score, and clean sheets require a zero opposition score.',
        },
      });
      return;
    }
    throw error;
  }
});

adminGamesRouter.post('/', async (request, response) => {
  const parsed = gameResultSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidGameResponse(response);
    return;
  }

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      let competition: Competition;
      let datePlayed: Date;
      let fixtureId: string | null = null;
      let opponentClubId: string;
      let seasonId: string;

      if (parsed.data.entryMode === 'fixture') {
        const fixture = await transaction.fixture.findUnique({
          select: {
            competition: true,
            id: true,
            opponentClubId: true,
            result: { select: { id: true } },
            scheduledDate: true,
            seasonId: true,
            status: true,
          },
          where: { id: parsed.data.fixtureId },
        });

        if (!fixture) {
          throw new FixtureNotFoundError();
        }

        if (fixture.result) {
          throw new FixtureAlreadyRecordedError();
        }

        if (fixture.status !== 'SCHEDULED') {
          throw new FixtureNotFoundError();
        }

        competition = fixture.competition;
        datePlayed = fixture.scheduledDate;
        fixtureId = fixture.id;
        opponentClubId = fixture.opponentClubId;
        seasonId = fixture.seasonId;
      } else {
        const season = await transaction.season.findUnique({
          select: { endDate: true, id: true, startDate: true },
          where: { id: parsed.data.seasonId },
        });

        if (!season) {
          throw new SeasonNotFoundError();
        }

        datePlayed = dateFromInput(parsed.data.datePlayed);
        if (datePlayed < season.startDate || datePlayed > season.endDate) {
          throw new ResultOutsideSeasonError();
        }

        const existingOpponent = await transaction.opponentClub.findFirst({
          select: { id: true },
          where: {
            name: {
              equals: parsed.data.opponentName,
              mode: 'insensitive',
            },
          },
        });
        const opponent =
          existingOpponent ??
          (await transaction.opponentClub.create({
            data: { name: parsed.data.opponentName },
            select: { id: true },
          }));

        competition = parsed.data.competition;
        opponentClubId = opponent.id;
        seasonId = season.id;
      }

      if (parsed.data.isWalkover && competition !== 'LEAGUE') {
        throw new CupWalkoverError();
      }

      const game = await transaction.gameResult.create({
        data: {
          competition,
          datePlayed,
          fixtureId,
          isWalkover: parsed.data.isWalkover,
          opponentClubId,
          opponentScore: parsed.data.opponentScore,
          ourScore: parsed.data.ourScore,
          seasonId,
          walkoverReason: parsed.data.isWalkover
            ? parsed.data.walkoverReason || null
            : null,
        },
        select: gameResultSelect,
      });

      if (fixtureId) {
        await transaction.fixture.update({
          data: {
            status: parsed.data.isWalkover ? 'WALKOVER' : 'PLAYED',
          },
          where: { id: fixtureId },
        });
      }

      return game;
    });

    response.status(201).json({
      game: result,
      standingsRefreshRequired:
        result.competition === 'LEAGUE' && !result.isWalkover,
    });
  } catch (error) {
    if (error instanceof FixtureNotFoundError) {
      response.status(404).json({
        error: {
          code: 'FIXTURE_NOT_FOUND',
          message: 'The scheduled fixture was not found.',
        },
      });
      return;
    }

    if (error instanceof FixtureAlreadyRecordedError) {
      response.status(409).json({
        error: {
          code: 'FIXTURE_RESULT_EXISTS',
          message: 'A result has already been recorded for this fixture.',
        },
      });
      return;
    }

    if (error instanceof SeasonNotFoundError) {
      response.status(404).json({
        error: {
          code: 'SEASON_NOT_FOUND',
          message: 'Season not found.',
        },
      });
      return;
    }

    if (error instanceof ResultOutsideSeasonError) {
      response.status(400).json({
        error: {
          code: 'RESULT_OUTSIDE_SEASON',
          message: 'The game date must fall within the selected season.',
        },
      });
      return;
    }

    if (error instanceof CupWalkoverError) {
      response.status(400).json({
        error: {
          code: 'CUP_WALKOVER_NOT_SUPPORTED',
          message: 'Only league games can use the walkover flow.',
        },
      });
      return;
    }

    throw error;
  }
});
