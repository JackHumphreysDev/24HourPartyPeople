import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma.js';

const testDate = new Date('2026-06-01T00:00:00.000Z');

async function clearDatabase() {
  await prisma.gameResult.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.playerSeasonStat.deleteMany();
  await prisma.seasonStanding.deleteMany();
  await prisma.clubHistory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.opponentClub.deleteMany();
  await prisma.season.deleteMany();
}

beforeAll(async () => {
  await prisma.$connect();
  await clearDatabase();
});

afterEach(clearDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('core data model constraints', () => {
  it('allows one stat row per player and season and preserves referenced history', async () => {
    const season = await prisma.season.create({
      data: {
        name: 'Summer 2026',
        startDate: testDate,
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        isCurrent: true,
      },
    });
    const player = await prisma.player.create({
      data: {
        name: 'Test Player',
        description: 'Database integration test player.',
        position: 'DEF',
      },
    });

    await prisma.playerSeasonStat.create({
      data: {
        playerId: player.id,
        seasonId: season.id,
        goals: 1,
      },
    });

    await expect(
      prisma.playerSeasonStat.create({
        data: {
          playerId: player.id,
          seasonId: season.id,
          assists: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.player.delete({ where: { id: player.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('allows one result per fixture and retains the result if its fixture is removed', async () => {
    const season = await prisma.season.create({
      data: {
        name: 'Summer 2026',
        startDate: testDate,
        endDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Test Opposition' },
    });
    const fixture = await prisma.fixture.create({
      data: {
        seasonId: season.id,
        opponentClubId: opponent.id,
        competition: 'LEAGUE',
        scheduledDate: testDate,
        source: 'MANUAL',
      },
    });
    const result = await prisma.gameResult.create({
      data: {
        fixtureId: fixture.id,
        seasonId: season.id,
        opponentClubId: opponent.id,
        competition: 'LEAGUE',
        datePlayed: testDate,
        ourScore: 3,
        opponentScore: 1,
      },
    });

    await expect(
      prisma.gameResult.create({
        data: {
          fixtureId: fixture.id,
          seasonId: season.id,
          opponentClubId: opponent.id,
          competition: 'LEAGUE',
          datePlayed: testDate,
          ourScore: 2,
          opponentScore: 2,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.fixture.delete({ where: { id: fixture.id } });

    await expect(
      prisma.gameResult.findUniqueOrThrow({ where: { id: result.id } }),
    ).resolves.toMatchObject({ fixtureId: null });
  });

  it('unlinks an optional player account when its player is removed', async () => {
    const player = await prisma.player.create({
      data: {
        name: 'Linked Player',
        description: 'Player linked to a test account.',
        position: 'MID',
      },
    });
    const user = await prisma.user.create({
      data: {
        name: 'Linked User',
        email: 'linked.user@example.test',
        passwordHash: 'not-a-real-password-hash',
        playerId: player.id,
      },
    });

    await prisma.player.delete({ where: { id: player.id } });

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).resolves.toMatchObject({ playerId: null });
  });
});
