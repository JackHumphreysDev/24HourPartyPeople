import { prisma } from './lib/prisma.js';
import { historicalSeasons } from './statistics/historicalData.js';

const historicalDescription =
  'Historical player. Profile details can be updated by an administrator.';
const playerAliases: Record<string, string[]> = {
  Broomhead: ['Broom'],
};

function normaliseName(value: string): string {
  return value.trim().toLocaleLowerCase('en-GB');
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
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
  const matches = [importedName, ...(playerAliases[importedName] ?? [])]
    .flatMap((candidate) => indexedPlayers.get(normaliseName(candidate)) ?? [])
    .filter(
      (player, index, players) =>
        players.findIndex((candidate) => candidate.id === player.id) === index,
    );
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous player match for ${importedName}: ${matches.map((player) => player.name).join(', ')}`,
    );
  }
  return matches[0];
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
        if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
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

async function buildPreview() {
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

async function applyImport() {
  return prisma.$transaction(
    async (transaction) => {
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
        data: { tracksGamesPlayed: false },
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
              assists: stat.assists ?? 0,
              cleanSheets: stat.cleanSheets ?? 0,
              gamesPlayed: null,
              goals: stat.goals ?? 0,
              note: stat.note ?? null,
              playerId: player.id,
              seasonId,
            },
            update: {
              assists: stat.assists ?? 0,
              cleanSheets: stat.cleanSheets ?? 0,
              gamesPlayed: null,
              goals: stat.goals ?? 0,
              note: stat.note ?? null,
            },
            where: { playerId_seasonId: { playerId: player.id, seasonId } },
          });
          statisticsSaved += 1;
        }
      }
      return { playersCreated, statisticsSaved };
    },
    { isolationLevel: 'Serializable', timeout: 30_000 },
  );
}

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
