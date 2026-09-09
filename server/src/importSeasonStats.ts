import { pathToFileURL } from 'node:url';

import type { Prisma } from './generated/prisma/client.js';
import { prisma } from './lib/prisma.js';
import { historicalSeasons } from './statistics/historicalData.js';

const historicalDescription =
  'Historical player. Profile details can be updated by an administrator.';
const playerAliases: Record<string, string[]> = {
  Broomhead: ['Broom'],
  Bobo: ['Bobo Balde'],
  Doug: ['Dougie'],
  Kraus: ['Matt K'],
  Kyle: ['Birch'],
  Matt: ['Bart'],
  'Matt W': ['Matt W.', 'Matt Waterhouse'],
};

function normaliseName(value: string): string {
  return value.trim().toLocaleLowerCase('en-GB');
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function statisticValue(value: number | undefined): number {
  return Math.floor(value ?? 0);
}

type PlayerMatch = { id: string; name: string };

function indexPlayers(players: PlayerMatch[]): Map<string, PlayerMatch[]> {
  const indexed = new Map<string, PlayerMatch[]>();
  for (const player of players) {
    const name = normaliseName(player.name);
    indexed.set(name, [...(indexed.get(name) ?? []), player]);
  }
  return indexed;
}

function findPlayer(
  importedName: string,
  indexedPlayers: Map<string, PlayerMatch[]>,
): PlayerMatch | undefined {
  const exactMatches = indexedPlayers.get(normaliseName(importedName)) ?? [];
  const matches =
    exactMatches.length > 0
      ? exactMatches
      : (playerAliases[importedName] ?? []).flatMap(
          (candidate) => indexedPlayers.get(normaliseName(candidate)) ?? [],
        );
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous player match for ${importedName}: ${matches.map((player) => player.name).join(', ')}`,
    );
  }
  return matches[0];
}

async function mergePlayerAlias(
  transaction: Prisma.TransactionClient,
  targetName: string,
  sourceName: string,
): Promise<boolean> {
  const [targets, sources] = await Promise.all([
    transaction.player.findMany({
      where: { name: { equals: targetName, mode: 'insensitive' } },
    }),
    transaction.player.findMany({
      where: { name: { equals: sourceName, mode: 'insensitive' } },
    }),
  ]);
  if (targets.length > 1 || sources.length > 1) {
    throw new Error(
      `Multiple player profiles match ${targetName}/${sourceName}.`,
    );
  }
  const source = sources[0];
  if (!source || source.id === targets[0]?.id) return false;
  const target = targets[0];
  if (!target) {
    await transaction.player.update({
      data: { name: targetName },
      where: { id: source.id },
    });
    return true;
  }

  const linkedUsers = await transaction.user.findMany({
    select: { id: true, playerId: true, requestedPlayerId: true },
    where: {
      OR: [
        { playerId: { in: [target.id, source.id] } },
        { requestedPlayerId: { in: [target.id, source.id] } },
      ],
    },
  });
  if (new Set(linkedUsers.map((user) => user.id)).size > 1) {
    throw new Error(
      `${targetName} and ${sourceName} are linked to different accounts and require manual review.`,
    );
  }
  const linkedUser = linkedUsers[0];
  if (linkedUser?.playerId) {
    await transaction.user.update({
      data: { playerId: target.id, requestedPlayerId: null },
      where: { id: linkedUser.id },
    });
  } else if (linkedUser?.requestedPlayerId === source.id) {
    await transaction.user.update({
      data: { requestedPlayerId: target.id },
      where: { id: linkedUser.id },
    });
  }

  const sourceSeasonStats = await transaction.playerSeasonStat.findMany({
    where: { playerId: source.id },
  });
  for (const sourceStat of sourceSeasonStats) {
    const targetStat = await transaction.playerSeasonStat.findUnique({
      where: {
        playerId_seasonId: {
          playerId: target.id,
          seasonId: sourceStat.seasonId,
        },
      },
    });
    if (targetStat) {
      await transaction.playerSeasonStat.update({
        data: {
          assists: targetStat.assists + sourceStat.assists,
          cleanSheets: targetStat.cleanSheets + sourceStat.cleanSheets,
          gamesPlayed:
            targetStat.gamesPlayed === null && sourceStat.gamesPlayed === null
              ? null
              : (targetStat.gamesPlayed ?? 0) + (sourceStat.gamesPlayed ?? 0),
          goals: targetStat.goals + sourceStat.goals,
          note:
            [targetStat.note, sourceStat.note].filter(Boolean).join(' ') ||
            null,
        },
        where: { id: targetStat.id },
      });
      await transaction.playerSeasonStat.delete({
        where: { id: sourceStat.id },
      });
    } else {
      await transaction.playerSeasonStat.update({
        data: { playerId: target.id },
        where: { id: sourceStat.id },
      });
    }
  }

  const sourceGameStats = await transaction.gamePlayerStat.findMany({
    where: { playerId: source.id },
  });
  for (const sourceStat of sourceGameStats) {
    const targetStat = await transaction.gamePlayerStat.findUnique({
      where: {
        gameResultId_playerId: {
          gameResultId: sourceStat.gameResultId,
          playerId: target.id,
        },
      },
    });
    if (targetStat) {
      await transaction.gamePlayerStat.update({
        data: {
          assists: targetStat.assists + sourceStat.assists,
          cleanSheet: targetStat.cleanSheet || sourceStat.cleanSheet,
          goals: targetStat.goals + sourceStat.goals,
        },
        where: { id: targetStat.id },
      });
      await transaction.gamePlayerStat.delete({ where: { id: sourceStat.id } });
    } else {
      await transaction.gamePlayerStat.update({
        data: { playerId: target.id },
        where: { id: sourceStat.id },
      });
    }
  }

  const sourceSquads = await transaction.seasonSquadEntry.findMany({
    where: { playerId: source.id },
  });
  for (const sourceEntry of sourceSquads) {
    const targetEntry = await transaction.seasonSquadEntry.findUnique({
      where: {
        seasonId_playerId: {
          playerId: target.id,
          seasonId: sourceEntry.seasonId,
        },
      },
    });
    if (targetEntry) {
      await transaction.seasonSquadEntry.update({
        data: {
          isStarter: targetEntry.isStarter || sourceEntry.isStarter,
          position:
            sourceEntry.isStarter && !targetEntry.isStarter
              ? sourceEntry.position
              : targetEntry.position,
        },
        where: { id: targetEntry.id },
      });
      await transaction.seasonSquadEntry.delete({
        where: { id: sourceEntry.id },
      });
    } else {
      await transaction.seasonSquadEntry.update({
        data: { playerId: target.id },
        where: { id: sourceEntry.id },
      });
    }
  }

  await transaction.player.update({
    data: {
      additionalPositions: [
        ...new Set([
          ...target.additionalPositions,
          ...source.additionalPositions,
        ]),
      ].filter((position) => position !== (target.position ?? source.position)),
      description:
        target.description === historicalDescription
          ? source.description
          : target.description,
      isActiveSquad: target.isActiveSquad || source.isActiveSquad,
      isOnBench:
        (target.isActiveSquad || source.isActiveSquad) &&
        (target.isOnBench || source.isOnBench),
      position: target.position ?? source.position,
      profilePicturePublicId:
        target.profilePicturePublicId ?? source.profilePicturePublicId,
      profilePictureUrl: target.profilePictureUrl ?? source.profilePictureUrl,
    },
    where: { id: target.id },
  });
  await transaction.player.delete({ where: { id: source.id } });
  return true;
}

function validateData(): void {
  const seasonNames = new Set<string>();
  for (const season of historicalSeasons) {
    if (seasonNames.has(season.name)) {
      throw new Error(`Duplicate season: ${season.name}`);
    }
    seasonNames.add(season.name);
    if (!season.current && (!season.startDate || !season.endDate)) {
      throw new Error(`Historical season dates are missing: ${season.name}`);
    }
    const playerNames = new Set<string>();
    for (const stat of season.stats) {
      const name = normaliseName(stat.player);
      if (playerNames.has(name)) {
        throw new Error(`Duplicate player in ${season.name}: ${stat.player}`);
      }
      playerNames.add(name);
      for (const value of [stat.goals, stat.assists, stat.cleanSheets]) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
          throw new Error(
            `Invalid statistic for ${stat.player} in ${season.name}`,
          );
        }
      }
      if ((stat.note?.length ?? 0) > 500) {
        throw new Error(
          `Statistic note is too long for ${stat.player} in ${season.name}`,
        );
      }
    }
  }
}

export async function buildPreview() {
  const existingPlayers = await prisma.player.findMany({
    select: { id: true, name: true },
  });
  const existingByName = indexPlayers(existingPlayers);
  const importedNames = [
    ...new Set(
      historicalSeasons.flatMap((season) =>
        season.stats.map((stat) => stat.player),
      ),
    ),
  ];
  const matchFor = (name: string) => findPlayer(name, existingByName);
  return {
    mergeAliases: Object.entries(playerAliases).flatMap(
      ([canonical, aliases]) => aliases.map((alias) => ({ alias, canonical })),
    ),
    createHistoricalPlayers: importedNames.filter((name) => !matchFor(name)),
    matchedPlayers: importedNames
      .map((name) => ({ imported: name, existing: matchFor(name)?.name }))
      .filter((match) => match.existing),
    seasonCount: historicalSeasons.length,
    statisticRows: historicalSeasons.reduce(
      (total, season) => total + season.stats.length,
      0,
    ),
  };
}

export async function applyImport() {
  return prisma.$transaction(
    async (transaction) => {
      let playersMerged = 0;
      for (const [canonical, aliases] of Object.entries(playerAliases)) {
        for (const alias of aliases) {
          if (await mergePlayerAlias(transaction, canonical, alias)) {
            playersMerged += 1;
          }
        }
      }
      const currentInput = historicalSeasons.find((season) => season.current);
      const currentSeason = await transaction.season.findFirst({
        select: { id: true, name: true },
        where: { isCurrent: true },
      });
      if (!currentInput || !currentSeason) {
        throw new Error(
          'A current season is required before importing statistics.',
        );
      }
      if (
        normaliseName(currentSeason.name) !== normaliseName(currentInput.name)
      ) {
        throw new Error(
          `Expected the current season to be ${currentInput.name}, found ${currentSeason.name}.`,
        );
      }
      const existingGameStatistics = await transaction.gamePlayerStat.count({
        where: { gameResult: { seasonId: currentSeason.id } },
      });
      if (existingGameStatistics > 0) {
        throw new Error(
          `${currentSeason.name} already has per-game player statistics and cannot be converted to historical totals.`,
        );
      }

      await transaction.playerSeasonStat.updateMany({
        data: { gamesPlayed: null },
        where: { seasonId: currentSeason.id },
      });
      await transaction.season.update({
        data: { isClubHistoryEligible: true, tracksGamesPlayed: false },
        where: { id: currentSeason.id },
      });

      const seasonIds = new Map<string, string>([
        [currentInput.name, currentSeason.id],
      ]);
      for (const season of historicalSeasons.filter((item) => !item.current)) {
        const matchingSeasons = await transaction.season.findMany({
          select: { id: true },
          where: { name: { equals: season.name, mode: 'insensitive' } },
        });
        if (matchingSeasons.length > 1) {
          throw new Error(`Multiple seasons are named ${season.name}.`);
        }
        const existing = matchingSeasons[0];
        const data = {
          endDate: dateFromInput(season.endDate!),
          isClubHistoryEligible: false,
          isCurrent: false,
          name: season.name,
          startDate: dateFromInput(season.startDate!),
          tracksGamesPlayed: false,
        };
        const saved = existing
          ? await transaction.season.update({
              data,
              select: { id: true },
              where: { id: existing.id },
            })
          : await transaction.season.create({ data, select: { id: true } });
        seasonIds.set(season.name, saved.id);
      }

      await transaction.playerSeasonStat.deleteMany({
        where: { seasonId: { in: [...seasonIds.values()] } },
      });

      const players = await transaction.player.findMany({
        select: { id: true, name: true },
      });
      const playersByName = indexPlayers(players);
      let playersCreated = 0;
      let statisticsSaved = 0;
      for (const season of historicalSeasons) {
        const seasonId = seasonIds.get(season.name)!;
        for (const stat of season.stats) {
          let player = findPlayer(stat.player, playersByName);
          if (!player) {
            player = await transaction.player.create({
              data: {
                additionalPositions: [],
                description: historicalDescription,
                isActiveSquad: false,
                name: stat.player,
                position: null,
              },
              select: { id: true, name: true },
            });
            const normalisedPlayerName = normaliseName(player.name);
            playersByName.set(normalisedPlayerName, [
              ...(playersByName.get(normalisedPlayerName) ?? []),
              player,
            ]);
            playersCreated += 1;
          }
          await transaction.playerSeasonStat.upsert({
            create: {
              assists: statisticValue(stat.assists),
              cleanSheets: statisticValue(stat.cleanSheets),
              gamesPlayed: null,
              goals: statisticValue(stat.goals),
              note: stat.note ?? null,
              playerId: player.id,
              seasonId,
            },
            update: {
              assists: statisticValue(stat.assists),
              cleanSheets: statisticValue(stat.cleanSheets),
              gamesPlayed: null,
              goals: statisticValue(stat.goals),
              note: stat.note ?? null,
            },
            where: { playerId_seasonId: { playerId: player.id, seasonId } },
          });
          statisticsSaved += 1;
        }
      }
      return { playersCreated, playersMerged, statisticsSaved };
    },
    { isolationLevel: 'Serializable', timeout: 30_000 },
  );
}

async function main(): Promise<void> {
  try {
    validateData();
    const preview = await buildPreview();
    console.log(
      JSON.stringify(
        {
          mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
          ...preview,
        },
        null,
        2,
      ),
    );
    if (process.argv.includes('--apply')) {
      console.log(JSON.stringify(await applyImport(), null, 2));
    } else {
      console.log(
        'No changes made. Run again with --apply after reviewing this preview.',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
