import { Router, type Response } from 'express';
import { z } from 'zod';

import type { PlayerPosition, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import {
  deletePlayerImage,
  ImageStorageConfigurationError,
  uploadPlayerImage,
} from '../media/playerImage.js';
import { parsePlayerImage } from './upload.js';

const positionSchema = z.enum(['GK', 'DEF', 'MID', 'FWD']);
const nullablePositionSchema = z.union([
  positionSchema,
  z.literal('').transform(() => null),
]);
const playerIdSchema = z.uuid();
const statValueSchema = z.number().int().min(0).max(10_000);
const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const additionalPositionsSchema = z
  .string()
  .default('[]')
  .transform((value, context): unknown => {
    try {
      return JSON.parse(value);
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid positions.' });
      return z.NEVER;
    }
  })
  .pipe(z.array(positionSchema).max(3));

const playerFieldsSchema = z.object({
  additionalPositions: additionalPositionsSchema,
  description: z.string().trim().min(1).max(2_000),
  isActiveSquad: booleanStringSchema.default(true),
  isOnBench: booleanStringSchema.default(false),
  name: z.string().trim().min(1).max(100),
  position: nullablePositionSchema,
});

function validatePlayerPositions(
  values: {
    additionalPositions: PlayerPosition[];
    isActiveSquad: boolean;
    isOnBench: boolean;
    position: PlayerPosition | null;
  },
  context: z.RefinementCtx,
) {
  if (values.isActiveSquad && values.position === null) {
    context.addIssue({
      code: 'custom',
      message: 'An active player must have a primary position.',
      path: ['position'],
    });
  }
  if (!values.isActiveSquad && values.isOnBench) {
    context.addIssue({
      code: 'custom',
      message: 'Only an active player can be placed on the bench.',
      path: ['isOnBench'],
    });
  }
  if (values.position === null && values.additionalPositions.length > 0) {
    context.addIssue({
      code: 'custom',
      message: 'Choose a primary position before additional positions.',
      path: ['additionalPositions'],
    });
  }
  if (
    new Set(values.additionalPositions).size !==
    values.additionalPositions.length
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Additional positions must be unique.',
      path: ['additionalPositions'],
    });
  }
  if (
    values.position !== null &&
    values.additionalPositions.includes(values.position)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'The primary position cannot also be an additional position.',
      path: ['additionalPositions'],
    });
  }
}

const createPlayerSchema = playerFieldsSchema.superRefine(
  validatePlayerPositions,
);

const updatePlayerSchema = playerFieldsSchema
  .extend({
    removeProfilePicture: booleanStringSchema.default(false),
  })
  .superRefine(validatePlayerPositions);

const seasonStatSchema = z.object({
  assists: statValueSchema,
  cleanSheets: statValueSchema,
  gamesPlayed: statValueSchema.nullable(),
  goals: statValueSchema,
  note: z.string().trim().max(500).nullable(),
  seasonId: z.uuid(),
});

const playerSummarySelect = {
  additionalPositions: true,
  createdAt: true,
  description: true,
  id: true,
  isActiveSquad: true,
  isOnBench: true,
  name: true,
  position: true,
  profilePictureUrl: true,
} as const;

export const ACTIVE_FORMATION_LIMITS: Record<PlayerPosition, number> = {
  DEF: 3,
  FWD: 1,
  GK: 1,
  MID: 1,
};

class FormationPositionFullError extends Error {}

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

  throw new Error('The player transaction could not be completed.');
}

async function requireFormationSpace(
  transaction: Prisma.TransactionClient,
  position: PlayerPosition,
  excludingPlayerId?: string,
): Promise<void> {
  const activePlayersInPosition = await transaction.player.count({
    where: {
      isActiveSquad: true,
      isOnBench: false,
      position,
      ...(excludingPlayerId ? { id: { not: excludingPlayerId } } : {}),
    },
  });

  if (activePlayersInPosition >= ACTIVE_FORMATION_LIMITS[position]) {
    throw new FormationPositionFullError();
  }
}

function invalidPlayerResponse(response: Response): void {
  response.status(400).json({
    error: {
      code: 'INVALID_PLAYER',
      message:
        'Enter a valid name, description, primary and additional positions, and squad status.',
    },
  });
}

async function removeStoredImage(publicId: string | null): Promise<void> {
  if (!publicId) {
    return;
  }

  try {
    await deletePlayerImage(publicId);
  } catch (error) {
    console.error('Failed to remove a player image from Cloudinary.', error);
  }
}

export const publicPlayersRouter = Router();

publicPlayersRouter.get('/', async (_request, response) => {
  const [players, historicalPlayers] = await Promise.all([
    prisma.player.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: playerSummarySelect,
      where: { isActiveSquad: true },
    }),
    prisma.player.findMany({
      orderBy: { name: 'asc' },
      select: playerSummarySelect,
      where: { isActiveSquad: false },
    }),
  ]);

  response.status(200).json({ historicalPlayers, players });
});

publicPlayersRouter.get('/:playerId', async (request, response) => {
  const playerId = playerIdSchema.safeParse(request.params.playerId);
  if (!playerId.success) {
    response.status(404).json({
      error: {
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found.',
      },
    });
    return;
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId.data },
    select: {
      ...playerSummarySelect,
      seasonStats: {
        orderBy: { season: { startDate: 'desc' } },
        select: {
          assists: true,
          cleanSheets: true,
          gamesPlayed: true,
          goals: true,
          id: true,
          note: true,
          season: {
            select: {
              endDate: true,
              id: true,
              isCurrent: true,
              name: true,
              startDate: true,
              tracksGamesPlayed: true,
            },
          },
        },
      },
      gameStats: {
        select: {
          assists: true,
          cleanSheet: true,
          gameResult: {
            select: {
              season: {
                select: {
                  endDate: true,
                  id: true,
                  isCurrent: true,
                  name: true,
                  startDate: true,
                  tracksGamesPlayed: true,
                },
              },
            },
          },
          goals: true,
          id: true,
        },
      },
    },
  });

  if (!player) {
    response.status(404).json({
      error: {
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found.',
      },
    });
    return;
  }

  const trackedStats = new Map<
    string,
    {
      assists: number;
      cleanSheets: number;
      gamesPlayed: number;
      goals: number;
      id: string;
      note: null;
      season: (typeof player.gameStats)[number]['gameResult']['season'];
    }
  >();
  for (const gameStat of player.gameStats) {
    const season = gameStat.gameResult.season;
    if (!season.tracksGamesPlayed) continue;
    const existing = trackedStats.get(season.id);
    if (existing) {
      existing.assists += gameStat.assists;
      existing.cleanSheets += gameStat.cleanSheet ? 1 : 0;
      existing.gamesPlayed += 1;
      existing.goals += gameStat.goals;
    } else {
      trackedStats.set(season.id, {
        assists: gameStat.assists,
        cleanSheets: gameStat.cleanSheet ? 1 : 0,
        gamesPlayed: 1,
        goals: gameStat.goals,
        id: `games-${player.id}-${season.id}`,
        note: null,
        season,
      });
    }
  }
  const seasonStats = [
    ...player.seasonStats.filter((stat) => !stat.season.tracksGamesPlayed),
    ...trackedStats.values(),
  ].sort(
    (left, right) =>
      right.season.startDate.getTime() - left.season.startDate.getTime(),
  );
  const { gameStats: _gameStats, ...playerDetails } = player;
  response.status(200).json({
    player: { ...playerDetails, seasonStats },
  });
});

export const adminPlayersRouter = Router();

adminPlayersRouter.use(requireAuthentication, requireAdmin);

adminPlayersRouter.get('/', async (_request, response) => {
  const players = await prisma.player.findMany({
    orderBy: [{ isActiveSquad: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    select: playerSummarySelect,
  });

  response.status(200).json({ players });
});

adminPlayersRouter.get('/:playerId/season-stats', async (request, response) => {
  const playerId = playerIdSchema.safeParse(request.params.playerId);
  if (!playerId.success) {
    response.status(404).json({
      error: {
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found.',
      },
    });
    return;
  }

  const player = await prisma.player.findUnique({
    select: {
      seasonStats: {
        orderBy: { season: { startDate: 'desc' } },
        select: {
          assists: true,
          cleanSheets: true,
          gamesPlayed: true,
          goals: true,
          id: true,
          note: true,
          seasonId: true,
        },
      },
    },
    where: { id: playerId.data },
  });

  if (!player) {
    response.status(404).json({
      error: {
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found.',
      },
    });
    return;
  }

  response.status(200).json({ seasonStats: player.seasonStats });
});

adminPlayersRouter.post(
  '/:playerId/season-stats',
  async (request, response) => {
    const playerId = playerIdSchema.safeParse(request.params.playerId);
    if (!playerId.success) {
      response.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'Player not found.',
        },
      });
      return;
    }

    const parsed = seasonStatSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_SEASON_STATS',
          message: 'Statistics must be whole numbers of zero or more.',
        },
      });
      return;
    }

    const [player, season] = await Promise.all([
      prisma.player.findUnique({
        select: { id: true },
        where: { id: playerId.data },
      }),
      prisma.season.findUnique({
        select: { id: true, tracksGamesPlayed: true },
        where: { id: parsed.data.seasonId },
      }),
    ]);

    if (!player) {
      response.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'Player not found.',
        },
      });
      return;
    }

    if (!season) {
      response.status(404).json({
        error: {
          code: 'SEASON_NOT_FOUND',
          message: 'Season not found.',
        },
      });
      return;
    }

    if (season.tracksGamesPlayed) {
      response.status(409).json({
        error: {
          code: 'PER_GAME_STATS_REQUIRED',
          message:
            'This season is tracked per game. Record player contributions from the Results administration page.',
        },
      });
      return;
    }

    if (!season.tracksGamesPlayed && parsed.data.gamesPlayed !== null) {
      response.status(400).json({
        error: {
          code: 'GAMES_PLAYED_NOT_TRACKED',
          message: 'Games played was not tracked for this season.',
        },
      });
      return;
    }

    const { seasonId, ...values } = parsed.data;
    const seasonStats = await prisma.playerSeasonStat.upsert({
      create: {
        ...values,
        playerId: player.id,
        seasonId,
      },
      select: {
        assists: true,
        cleanSheets: true,
        gamesPlayed: true,
        goals: true,
        id: true,
        note: true,
        seasonId: true,
      },
      update: values,
      where: {
        playerId_seasonId: {
          playerId: player.id,
          seasonId,
        },
      },
    });

    response.status(200).json({ seasonStats });
  },
);

adminPlayersRouter.post('/', parsePlayerImage, async (request, response) => {
  const parsed = createPlayerSchema.safeParse(request.body);
  if (!parsed.success) {
    invalidPlayerResponse(response);
    return;
  }

  let uploadedImage: Awaited<ReturnType<typeof uploadPlayerImage>> | null =
    null;

  try {
    if (request.file) {
      uploadedImage = await uploadPlayerImage(request.file.buffer);
    }

    const player = await runSerializableTransaction(async (transaction) => {
      if (
        parsed.data.isActiveSquad &&
        !parsed.data.isOnBench &&
        parsed.data.position
      ) {
        await requireFormationSpace(transaction, parsed.data.position);
      }

      return transaction.player.create({
        data: {
          ...parsed.data,
          profilePicturePublicId: uploadedImage?.publicId,
          profilePictureUrl: uploadedImage?.url,
        },
        select: playerSummarySelect,
      });
    });

    response.status(201).json({ player });
  } catch (error) {
    await removeStoredImage(uploadedImage?.publicId ?? null);

    if (error instanceof ImageStorageConfigurationError) {
      response.status(503).json({
        error: {
          code: 'IMAGE_STORAGE_NOT_CONFIGURED',
          message: 'Player image storage is not configured.',
        },
      });
      return;
    }

    if (error instanceof FormationPositionFullError) {
      response.status(409).json({
        error: {
          code: 'FORMATION_POSITION_FULL',
          message: 'That position is already full in the active formation.',
        },
      });
      return;
    }

    throw error;
  }
});

adminPlayersRouter.put(
  '/:playerId',
  parsePlayerImage,
  async (request, response) => {
    const parsed = updatePlayerSchema.safeParse(request.body);
    if (!parsed.success) {
      invalidPlayerResponse(response);
      return;
    }

    const playerId = playerIdSchema.safeParse(request.params.playerId);
    if (!playerId.success) {
      response.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'Player not found.',
        },
      });
      return;
    }

    const existingPlayer = await prisma.player.findUnique({
      where: { id: playerId.data },
      select: { id: true, profilePicturePublicId: true },
    });

    if (!existingPlayer) {
      response.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'Player not found.',
        },
      });
      return;
    }

    let uploadedImage: Awaited<ReturnType<typeof uploadPlayerImage>> | null =
      null;
    const shouldRemoveExistingImage =
      parsed.data.removeProfilePicture || Boolean(request.file);

    try {
      if (request.file) {
        uploadedImage = await uploadPlayerImage(request.file.buffer);
      }

      const { removeProfilePicture: _removeProfilePicture, ...playerData } =
        parsed.data;
      const player = await runSerializableTransaction(async (transaction) => {
        if (
          playerData.isActiveSquad &&
          !playerData.isOnBench &&
          playerData.position
        ) {
          await requireFormationSpace(
            transaction,
            playerData.position,
            existingPlayer.id,
          );
        }

        return transaction.player.update({
          where: { id: existingPlayer.id },
          data: {
            ...playerData,
            ...(shouldRemoveExistingImage
              ? {
                  profilePicturePublicId: uploadedImage?.publicId ?? null,
                  profilePictureUrl: uploadedImage?.url ?? null,
                }
              : {}),
          },
          select: playerSummarySelect,
        });
      });

      if (shouldRemoveExistingImage) {
        await removeStoredImage(existingPlayer.profilePicturePublicId);
      }

      response.status(200).json({ player });
    } catch (error) {
      await removeStoredImage(uploadedImage?.publicId ?? null);

      if (error instanceof ImageStorageConfigurationError) {
        response.status(503).json({
          error: {
            code: 'IMAGE_STORAGE_NOT_CONFIGURED',
            message: 'Player image storage is not configured.',
          },
        });
        return;
      }

      if (error instanceof FormationPositionFullError) {
        response.status(409).json({
          error: {
            code: 'FORMATION_POSITION_FULL',
            message: 'That position is already full in the active formation.',
          },
        });
        return;
      }

      throw error;
    }
  },
);
