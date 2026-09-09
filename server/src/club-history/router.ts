import { Router, type Response } from 'express';
import { z } from 'zod';

import type { PlayerPosition, Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';

const TEAM_NAME = '24 Hour Party People';
const seasonIdSchema = z.uuid();
const positionSchema = z.enum(['GK', 'DEF', 'MID', 'FWD']);
const squadSchema = z.object({
  entries: z
    .array(
      z.object({
        isStarter: z.boolean(),
        playerId: z.uuid(),
        position: positionSchema,
      }),
    )
    .max(50),
});

const FORMATION_SLOTS: Record<PlayerPosition, number> = {
  DEF: 3,
  FWD: 1,
  GK: 1,
  MID: 1,
};

const historySquadEntrySelect = {
  id: true,
  isStarter: true,
  player: {
    select: { id: true, name: true, profilePictureUrl: true },
  },
  playerId: true,
  position: true,
} satisfies Prisma.SeasonSquadEntrySelect;

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
      gameResults: {
        select: {
          playerStats: {
            select: {
              assists: true,
              cleanSheet: true,
              goals: true,
              player: { select: { id: true, name: true } },
            },
          },
        },
      },
      id: true,
      name: true,
      playerStats: {
        select: {
          assists: true,
          cleanSheets: true,
          goals: true,
          player: { select: { id: true, name: true } },
        },
      },
      squadEntries: {
        orderBy: [
          { isStarter: 'desc' },
          { position: 'asc' },
          { player: { name: 'asc' } },
        ],
        select: historySquadEntrySelect,
      },
      startDate: true,
      tracksGamesPlayed: true,
    },
  },
  walkoverGames: true,
  won: true,
  drawn: true,
} satisfies Prisma.ClubHistorySelect;

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

const historyPlayerSelect = {
  id: true,
  isActiveSquad: true,
  isOnBench: true,
  name: true,
  position: true,
  profilePictureUrl: true,
} as const;

type PlayerTotal = {
  assists: number;
  cleanSheets: number;
  goals: number;
  player: { id: string; name: string };
};

class SeasonNotFoundError extends Error {}
class SeasonNotEndedError extends Error {}
class SeasonPredatesHistoryError extends Error {}
class HistoryAlreadyFinalisedError extends Error {}
class TeamStandingRequiredError extends Error {}
class SeasonSquadRequiredError extends Error {}

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

function hasValidFormation(
  entries: Array<{
    isStarter: boolean;
    playerId: string;
    position: PlayerPosition;
  }>,
): boolean {
  if (new Set(entries.map((entry) => entry.playerId)).size !== entries.length) {
    return false;
  }
  const starters = entries.filter((entry) => entry.isStarter);
  return (
    starters.length === 6 &&
    Object.entries(FORMATION_SLOTS).every(
      ([position, slots]) =>
        starters.filter((entry) => entry.position === position).length ===
        slots,
    )
  );
}

function awardFor(
  totals: PlayerTotal[],
  key: keyof Omit<PlayerTotal, 'player'>,
) {
  const value = Math.max(0, ...totals.map((total) => total[key]));
  return {
    players:
      value === 0
        ? []
        : totals
            .filter((total) => total[key] === value)
            .map((total) => total.player)
            .sort((left, right) =>
              left.name.localeCompare(right.name, 'en-GB'),
            ),
    value,
  };
}

function totalsForSeason(
  season: Prisma.ClubHistoryGetPayload<{
    select: typeof historySelect;
  }>['season'],
): PlayerTotal[] {
  if (!season.tracksGamesPlayed) {
    return season.playerStats.map((stat) => ({
      assists: stat.assists,
      cleanSheets: stat.cleanSheets,
      goals: stat.goals,
      player: stat.player,
    }));
  }

  const totals = new Map<string, PlayerTotal>();
  for (const game of season.gameResults) {
    for (const stat of game.playerStats) {
      const existing = totals.get(stat.player.id);
      if (existing) {
        existing.assists += stat.assists;
        existing.cleanSheets += stat.cleanSheet ? 1 : 0;
        existing.goals += stat.goals;
      } else {
        totals.set(stat.player.id, {
          assists: stat.assists,
          cleanSheets: stat.cleanSheet ? 1 : 0,
          goals: stat.goals,
          player: stat.player,
        });
      }
    }
  }
  return [...totals.values()];
}

function withHistoryDetails(
  history: Prisma.ClubHistoryGetPayload<{ select: typeof historySelect }>,
) {
  const totals = totalsForSeason(history.season);
  const {
    gameResults: _gameResults,
    playerStats: _playerStats,
    squadEntries,
    tracksGamesPlayed: _tracksGamesPlayed,
    ...season
  } = history.season;
  return {
    ...history,
    awards: {
      assistKing: awardFor(totals, 'assists'),
      goldenBoot: awardFor(totals, 'goals'),
      goldenGlove: awardFor(totals, 'cleanSheets'),
    },
    clubName: TEAM_NAME,
    season,
    squad: squadEntries,
  };
}

async function getFinalisedHistory() {
  const history = await prisma.clubHistory.findMany({
    orderBy: { season: { endDate: 'desc' } },
    select: historySelect,
    where: { finalisedAt: { not: null } },
  });
  return history.map(withHistoryDetails);
}

async function suggestedSquadForSeason(season: {
  id: string;
  tracksGamesPlayed: boolean;
}) {
  const players = await prisma.player.findMany({
    select: historyPlayerSelect,
    where: season.tracksGamesPlayed
      ? { gameStats: { some: { gameResult: { seasonId: season.id } } } }
      : { isActiveSquad: true },
  });
  const appearances = season.tracksGamesPlayed
    ? await prisma.gamePlayerStat.groupBy({
        _count: { _all: true },
        by: ['playerId'],
        where: { gameResult: { seasonId: season.id } },
      })
    : [];
  const appearanceByPlayer = new Map(
    appearances.map((entry) => [entry.playerId, entry._count._all]),
  );
  const positionedPlayers = players
    .filter(
      (player): player is typeof player & { position: PlayerPosition } =>
        player.position !== null,
    )
    .sort(
      (left, right) =>
        (appearanceByPlayer.get(right.id) ?? 0) -
          (appearanceByPlayer.get(left.id) ?? 0) ||
        left.name.localeCompare(right.name, 'en-GB'),
    );
  const starterIds = new Set<string>();
  for (const [position, slots] of Object.entries(FORMATION_SLOTS)) {
    positionedPlayers
      .filter((player) => player.position === position)
      .slice(0, slots)
      .forEach((player) => starterIds.add(player.id));
  }

  return positionedPlayers.map((player) => ({
    isStarter: season.tracksGamesPlayed
      ? starterIds.has(player.id)
      : !player.isOnBench,
    player,
    playerId: player.id,
    position: player.position,
  }));
}

async function getHistorySeasons() {
  const seasons = await prisma.season.findMany({
    orderBy: { endDate: 'desc' },
    select: {
      endDate: true,
      id: true,
      isCurrent: true,
      name: true,
      squadEntries: {
        orderBy: [
          { isStarter: 'desc' },
          { position: 'asc' },
          { player: { name: 'asc' } },
        ],
        select: historySquadEntrySelect,
      },
      standings: {
        select: standingSelect,
        where: { clubName: { equals: TEAM_NAME, mode: 'insensitive' } },
      },
      startDate: true,
      tracksGamesPlayed: true,
    },
    where: { clubHistory: null, isClubHistoryEligible: true },
  });

  return Promise.all(
    seasons.map(async ({ standings, ...season }) => ({
      ...season,
      canFinalise: season.endDate < sheffieldToday(),
      standing: standings[0] ?? null,
      suggestedSquad:
        season.squadEntries.length === 0
          ? await suggestedSquadForSeason(season)
          : [],
    })),
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
      if (hasErrorCode(error, 'P2034') && attempt === 0) continue;
      throw error;
    }
  }
  throw new Error('Club history could not be updated.');
}

function handleHistoryError(error: unknown, response: Response): boolean {
  const errors: Array<[new () => Error, number, string, string]> = [
    [SeasonNotFoundError, 404, 'SEASON_NOT_FOUND', 'Season not found.'],
    [
      SeasonNotEndedError,
      409,
      'SEASON_NOT_ENDED',
      'Club history can only be finalised after the season ends.',
    ],
    [
      SeasonPredatesHistoryError,
      409,
      'SEASON_PREDATES_CLUB_HISTORY',
      'That season predates the club history record.',
    ],
    [
      TeamStandingRequiredError,
      409,
      'TEAM_STANDING_REQUIRED',
      'Save a 24 Hour Party People standings row before finalising this season.',
    ],
    [
      SeasonSquadRequiredError,
      409,
      'SEASON_SQUAD_REQUIRED',
      'Save a complete 1–3–1–1 season formation before finalising this season.',
    ],
  ];
  for (const [ErrorType, status, code, message] of errors) {
    if (error instanceof ErrorType) {
      response.status(status).json({ error: { code, message } });
      return true;
    }
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
  return false;
}

export const publicClubHistoryRouter = Router();

publicClubHistoryRouter.get('/', async (_request, response) => {
  response.status(200).json({ history: await getFinalisedHistory() });
});

export const adminClubHistoryRouter = Router();

adminClubHistoryRouter.use(requireAuthentication, requireAdmin);

adminClubHistoryRouter.get('/', async (_request, response) => {
  const [history, seasons, players] = await Promise.all([
    getFinalisedHistory(),
    getHistorySeasons(),
    prisma.player.findMany({
      orderBy: { name: 'asc' },
      select: historyPlayerSelect,
    }),
  ]);
  response.status(200).json({ history, players, seasons });
});

adminClubHistoryRouter.put('/:seasonId/squad', async (request, response) => {
  const seasonId = seasonIdSchema.safeParse(request.params.seasonId);
  const parsed = squadSchema.safeParse(request.body);
  if (
    !seasonId.success ||
    !parsed.success ||
    !hasValidFormation(parsed.data.entries)
  ) {
    response.status(400).json({
      error: {
        code: 'INVALID_SEASON_SQUAD',
        message:
          'Choose one goalkeeper, three defenders, one midfielder, one attacker, and any bench players.',
      },
    });
    return;
  }

  try {
    const entries = await runSerializableTransaction(async (transaction) => {
      const season = await transaction.season.findUnique({
        select: {
          clubHistory: { select: { id: true } },
          id: true,
          isClubHistoryEligible: true,
        },
        where: { id: seasonId.data },
      });
      if (!season) throw new SeasonNotFoundError();
      if (!season.isClubHistoryEligible) throw new SeasonPredatesHistoryError();
      if (season.clubHistory) throw new HistoryAlreadyFinalisedError();

      const playerCount = await transaction.player.count({
        where: {
          id: { in: parsed.data.entries.map((entry) => entry.playerId) },
        },
      });
      if (playerCount !== parsed.data.entries.length)
        throw new SeasonSquadRequiredError();

      await transaction.seasonSquadEntry.deleteMany({
        where: { seasonId: season.id },
      });
      await transaction.seasonSquadEntry.createMany({
        data: parsed.data.entries.map((entry) => ({
          ...entry,
          seasonId: season.id,
        })),
      });
      return transaction.seasonSquadEntry.findMany({
        orderBy: [
          { isStarter: 'desc' },
          { position: 'asc' },
          { player: { name: 'asc' } },
        ],
        select: historySquadEntrySelect,
        where: { seasonId: season.id },
      });
    });
    response.status(200).json({ entries });
  } catch (error) {
    if (!handleHistoryError(error, response)) throw error;
  }
});

adminClubHistoryRouter.post(
  '/:seasonId/finalise',
  async (request, response) => {
    const seasonId = seasonIdSchema.safeParse(request.params.seasonId);
    if (!seasonId.success) {
      handleHistoryError(new SeasonNotFoundError(), response);
      return;
    }

    try {
      const history = await runSerializableTransaction(async (transaction) => {
        const season = await transaction.season.findUnique({
          select: {
            clubHistory: { select: { id: true } },
            endDate: true,
            id: true,
            isClubHistoryEligible: true,
            squadEntries: {
              select: { isStarter: true, playerId: true, position: true },
            },
            standings: {
              select: standingSelect,
              where: { clubName: { equals: TEAM_NAME, mode: 'insensitive' } },
            },
          },
          where: { id: seasonId.data },
        });
        if (!season) throw new SeasonNotFoundError();
        if (season.endDate >= sheffieldToday()) throw new SeasonNotEndedError();
        if (!season.isClubHistoryEligible)
          throw new SeasonPredatesHistoryError();
        if (season.clubHistory) throw new HistoryAlreadyFinalisedError();
        if (!hasValidFormation(season.squadEntries))
          throw new SeasonSquadRequiredError();
        const standing = season.standings[0];
        if (!standing) throw new TeamStandingRequiredError();

        return transaction.clubHistory.create({
          data: { ...standing, finalisedAt: new Date(), seasonId: season.id },
          select: historySelect,
        });
      });
      response.status(201).json({ history: withHistoryDetails(history) });
    } catch (error) {
      if (!handleHistoryError(error, response)) throw error;
    }
  },
);
