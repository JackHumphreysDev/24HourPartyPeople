import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { requestPowerleagueScrape } from './client.js';
import type { ScrapePayload } from './schema.js';

export class CurrentSeasonRequiredError extends Error {}
export class ScrapeRefreshError extends Error {}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeFromInput(value: string | null): Date | null {
  return value ? new Date(`1970-01-01T${value}:00.000Z`) : null;
}

function dateIsWithinSeason(
  date: Date,
  season: { startDate: Date; endDate: Date },
) {
  return date >= season.startDate && date <= season.endDate;
}

async function findOrCreateOpponent(
  transaction: Prisma.TransactionClient,
  name: string,
) {
  const existing = await transaction.opponentClub.findFirst({
    select: { id: true },
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  return (
    existing ??
    (await transaction.opponentClub.create({
      data: { name },
      select: { id: true },
    }))
  );
}

async function ingestPayload(
  transaction: Prisma.TransactionClient,
  payload: ScrapePayload,
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(240624)`;
  const season = await transaction.season.findFirst({
    select: { endDate: true, id: true, startDate: true },
    where: { isCurrent: true },
  });
  if (!season) {
    throw new CurrentSeasonRequiredError(
      'Create a current season before refreshing Powerleague data.',
    );
  }

  const fixtureDates = payload.fixtures.map((fixture) =>
    dateFromInput(fixture.scheduledDate),
  );
  const resultDates = payload.results.map((result) =>
    dateFromInput(result.datePlayed),
  );
  if (
    [...fixtureDates, ...resultDates].some(
      (date) => !dateIsWithinSeason(date, season),
    )
  ) {
    throw new ScrapeRefreshError(
      'Powerleague returned dates outside the current season.',
    );
  }

  const scrapedAt = new Date(payload.scrapedAt);
  await transaction.seasonStanding.deleteMany({
    where: { seasonId: season.id },
  });
  await transaction.seasonStanding.createMany({
    data: payload.standings.map((row) => ({
      ...row,
      scrapedAt,
      seasonId: season.id,
    })),
  });

  let fixturesImported = 0;
  const seenScrapedFixtureIds: string[] = [];
  for (const fixture of payload.fixtures) {
    const opponent = await findOrCreateOpponent(
      transaction,
      fixture.opponentClubName,
    );
    const scheduledDate = dateFromInput(fixture.scheduledDate);
    const existing = await transaction.fixture.findFirst({
      select: { id: true, source: true, status: true },
      where: {
        competition: fixture.competition,
        opponentClubId: opponent.id,
        result: null,
        scheduledDate,
        seasonId: season.id,
        status: { in: ['SCHEDULED', 'CANCELLED'] },
      },
    });
    if (existing) {
      if (existing.source === 'SCRAPE') {
        await transaction.fixture.update({
          data: {
            scheduledTime: timeFromInput(fixture.scheduledTime),
            status: 'SCHEDULED',
            venue: fixture.venue,
          },
          where: { id: existing.id },
        });
        seenScrapedFixtureIds.push(existing.id);
      }
      continue;
    }

    const created = await transaction.fixture.create({
      data: {
        competition: fixture.competition,
        opponentClubId: opponent.id,
        scheduledDate,
        scheduledTime: timeFromInput(fixture.scheduledTime),
        seasonId: season.id,
        source: 'SCRAPE',
        venue: fixture.venue,
      },
      select: { id: true },
    });
    seenScrapedFixtureIds.push(created.id);
    fixturesImported += 1;
  }

  await transaction.fixture.updateMany({
    data: { status: 'CANCELLED' },
    where: {
      id: { notIn: seenScrapedFixtureIds },
      result: null,
      seasonId: season.id,
      source: 'SCRAPE',
      status: 'SCHEDULED',
    },
  });

  let resultsImported = 0;
  for (const result of payload.results) {
    const opponent = await findOrCreateOpponent(
      transaction,
      result.opponentClubName,
    );
    const datePlayed = dateFromInput(result.datePlayed);
    const existingResult = await transaction.gameResult.findFirst({
      select: { id: true },
      where: {
        competition: result.competition,
        datePlayed,
        opponentClubId: opponent.id,
        seasonId: season.id,
      },
    });
    if (existingResult) {
      continue;
    }

    let fixture = await transaction.fixture.findFirst({
      select: { id: true },
      where: {
        competition: result.competition,
        opponentClubId: opponent.id,
        result: null,
        scheduledDate: datePlayed,
        seasonId: season.id,
      },
    });
    if (fixture) {
      await transaction.fixture.update({
        data: { status: 'PLAYED' },
        where: { id: fixture.id },
      });
    } else {
      fixture = await transaction.fixture.create({
        data: {
          competition: result.competition,
          opponentClubId: opponent.id,
          scheduledDate: datePlayed,
          seasonId: season.id,
          source: 'SCRAPE',
          status: 'PLAYED',
        },
        select: { id: true },
      });
    }

    await transaction.gameResult.create({
      data: {
        competition: result.competition,
        datePlayed,
        fixtureId: fixture.id,
        opponentClubId: opponent.id,
        opponentScore: result.opponentScore,
        ourScore: result.ourScore,
        seasonId: season.id,
      },
    });
    resultsImported += 1;
  }

  await transaction.scrapeStatus.upsert({
    create: {
      id: 1,
      lastAttemptedAt: scrapedAt,
      lastSucceededAt: scrapedAt,
    },
    update: {
      lastAttemptedAt: scrapedAt,
      lastError: null,
      lastSucceededAt: scrapedAt,
    },
    where: { id: 1 },
  });

  return {
    fixturesImported,
    resultsImported,
    standingsImported: payload.standings.length,
  };
}

async function recordFailure(error: unknown, attemptedAt: Date): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : 'Unknown Powerleague scrape error.';
  console.error(
    `Powerleague refresh failed at ${attemptedAt.toISOString()}.`,
    error,
  );
  await prisma.scrapeStatus.upsert({
    create: { id: 1, lastAttemptedAt: attemptedAt, lastError: message },
    update: { lastAttemptedAt: attemptedAt, lastError: message },
    where: { id: 1 },
  });
}

export async function refreshPowerleagueData() {
  const attemptedAt = new Date();
  try {
    const payload = await requestPowerleagueScrape();
    return await prisma.$transaction(
      (transaction) => ingestPayload(transaction, payload),
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  } catch (error) {
    await recordFailure(error, attemptedAt);
    if (
      error instanceof CurrentSeasonRequiredError ||
      error instanceof ScrapeRefreshError
    ) {
      throw error;
    }
    throw new ScrapeRefreshError(
      'Powerleague could not be refreshed. Existing cached data has been preserved.',
      { cause: error },
    );
  }
}
