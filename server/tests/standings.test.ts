import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createApp } from '../src/app.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/auth/session.js';
import { prisma } from '../src/lib/prisma.js';

async function clearDatabase() {
  await prisma.scrapeStatus.deleteMany();
  await prisma.session.deleteMany();
  await prisma.gameResult.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.playerSeasonStat.deleteMany();
  await prisma.seasonStanding.deleteMany();
  await prisma.clubHistory.deleteMany();
  await prisma.seasonSquadEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.opponentClub.deleteMany();
  await prisma.season.deleteMany();
}

async function createUserSession(role: 'ADMIN' | 'PLAYER') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}@standings.test`,
      name: `Standings ${role}`,
      passwordHash: 'not-used-by-this-test',
      role,
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function createSeason(isCurrent = true) {
  return prisma.season.create({
    data: {
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      isCurrent,
      name: isCurrent ? 'Summer 2026' : 'Spring 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      tracksGamesPlayed: isCurrent,
    },
  });
}

function validRows() {
  return [
    {
      clubName: 'League Leaders',
      drawn: 1,
      ga: 5,
      gf: 12,
      lost: 0,
      played: 4,
      points: 10,
      position: 1,
      walkoverGames: 0,
      won: 3,
    },
    {
      clubName: '24 Hour Party People',
      drawn: 0,
      ga: 8,
      gf: 10,
      lost: 1,
      played: 4,
      points: 9,
      position: 2,
      walkoverGames: 1,
      won: 3,
    },
  ];
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(clearDatabase);
afterEach(clearDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('administrator standings API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app).put('/api/admin/standings/current');
    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const player = await request(app)
      .get('/api/admin/standings')
      .set('Cookie', playerCookie);
    expect(player.status).toBe(403);
  });

  it('atomically replaces the current-season snapshot and computes goal difference', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const currentSeason = await createSeason();
    const historicSeason = await createSeason(false);
    const oldTimestamp = new Date('2026-09-01T10:00:00.000Z');
    await prisma.seasonStanding.createMany({
      data: [
        {
          clubName: 'Old Current Club',
          drawn: 0,
          ga: 1,
          gd: 0,
          gf: 1,
          lost: 0,
          played: 1,
          points: 3,
          position: 1,
          scrapedAt: oldTimestamp,
          seasonId: currentSeason.id,
          walkoverGames: 0,
          won: 1,
        },
        {
          clubName: 'Historic Club',
          drawn: 0,
          ga: 2,
          gd: -1,
          gf: 1,
          lost: 1,
          played: 1,
          points: 0,
          position: 1,
          scrapedAt: oldTimestamp,
          seasonId: historicSeason.id,
          walkoverGames: 0,
          won: 0,
        },
      ],
    });

    const response = await request(createApp())
      .put('/api/admin/standings/current')
      .set('Cookie', adminCookie)
      .send({ rows: validRows() });

    expect(response.status).toBe(200);
    expect(response.body.season).toEqual({
      id: currentSeason.id,
      name: 'Summer 2026',
    });
    expect(response.body.standings).toHaveLength(2);
    expect(response.body.standings[1]).toMatchObject({
      clubName: '24 Hour Party People',
      gd: 2,
      position: 2,
    });
    expect(response.body.lastUpdated).toBe(
      response.body.standings[0].scrapedAt,
    );
    expect(
      response.body.standings.every(
        (row: { scrapedAt: string }) =>
          row.scrapedAt === response.body.lastUpdated,
      ),
    ).toBe(true);
    expect(
      await prisma.seasonStanding.count({
        where: { seasonId: currentSeason.id },
      }),
    ).toBe(2);
    expect(
      await prisma.seasonStanding.count({
        where: { seasonId: historicSeason.id },
      }),
    ).toBe(1);
  });

  it('rejects incomplete and inconsistent snapshots without replacing existing data', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    await prisma.seasonStanding.create({
      data: {
        clubName: 'Existing Club',
        drawn: 0,
        ga: 0,
        gd: 1,
        gf: 1,
        lost: 0,
        played: 1,
        points: 3,
        position: 1,
        scrapedAt: new Date(),
        seasonId: season.id,
        walkoverGames: 0,
        won: 1,
      },
    });
    const rows = validRows();
    rows[1] = {
      ...rows[1]!,
      clubName: 'league leaders',
      played: 99,
      position: 1,
      walkoverGames: 100,
    };

    const response = await request(createApp())
      .put('/api/admin/standings/current')
      .set('Cookie', adminCookie)
      .send({ rows });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_STANDINGS');
    expect(
      await prisma.seasonStanding.findMany({
        select: { clubName: true },
        where: { seasonId: season.id },
      }),
    ).toEqual([{ clubName: 'Existing Club' }]);
  });

  it('requires a current season before replacing standings', async () => {
    const adminCookie = await createUserSession('ADMIN');
    await createSeason(false);

    const response = await request(createApp())
      .put('/api/admin/standings/current')
      .set('Cookie', adminCookie)
      .send({ rows: validRows() });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CURRENT_SEASON_REQUIRED');
    expect(await prisma.seasonStanding.count()).toBe(0);
  });
});

describe('public standings API', () => {
  it('returns an empty snapshot when there is no current season', async () => {
    const response = await request(createApp()).get('/api/standings/current');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      lastUpdated: null,
      scrapeStatus: {
        lastAttemptedAt: null,
        lastSucceededAt: null,
        latestRefreshFailed: false,
      },
      season: null,
      standings: [],
    });
  });

  it('returns only the current season table ordered by position', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const app = createApp();
    await request(app)
      .put('/api/admin/standings/current')
      .set('Cookie', adminCookie)
      .send({ rows: validRows().reverse() });

    const response = await request(app).get('/api/standings/current');

    expect(response.status).toBe(200);
    expect(response.body.season.id).toBe(season.id);
    expect(
      response.body.standings.map((row: { position: number }) => row.position),
    ).toEqual([1, 2]);
    expect(response.body.lastUpdated).toEqual(expect.any(String));
  });
});
