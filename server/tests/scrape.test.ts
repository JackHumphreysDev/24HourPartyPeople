import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
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

async function createAdminSession() {
  const user = await prisma.user.create({
    data: {
      email: 'admin@scrape.test',
      name: 'Scrape Administrator',
      passwordHash: 'not-used-by-this-test',
      role: 'ADMIN',
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function createCurrentSeason() {
  return prisma.season.create({
    data: {
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      isCurrent: true,
      name: 'Summer 2026',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      tracksGamesPlayed: true,
    },
  });
}

function validPayload() {
  return {
    fixtures: [
      {
        competition: 'LEAGUE',
        opponentClubName: 'Future Opponents',
        scheduledDate: '2026-09-15',
        scheduledTime: '19:40',
        venue: 'Pitch 1',
      },
    ],
    results: [
      {
        competition: 'LEAGUE',
        datePlayed: '2026-09-01',
        opponentClubName: 'League Leaders',
        opponentScore: 1,
        ourScore: 4,
      },
    ],
    scrapedAt: '2026-09-08T08:30:00.000Z',
    standings: [
      {
        clubName: 'League Leaders',
        drawn: 1,
        ga: 5,
        gd: 7,
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
        gd: 2,
        gf: 10,
        lost: 1,
        played: 4,
        points: 9,
        position: 2,
        walkoverGames: 0,
        won: 3,
      },
    ],
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await clearDatabase();
  vi.stubEnv('POWERLEAGUE_SCRAPER_URL', 'http://scraper.internal/');
  vi.stubEnv('SCRAPER_SERVICE_KEY', 'test-service-key');
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await clearDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Powerleague refresh API', () => {
  it('requires an authenticated administrator', async () => {
    const response = await request(createApp()).post(
      '/api/admin/scrape/refresh',
    );

    expect(response.status).toBe(401);
  });

  it('atomically imports standings, fixtures and new results', async () => {
    const adminCookie = await createAdminSession();
    await createCurrentSeason();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validPayload()), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(createApp())
      .post('/api/admin/scrape/refresh')
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.imported).toEqual({
      fixturesImported: 1,
      resultsImported: 1,
      standingsImported: 2,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://scraper.internal/scrape'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-service-key' },
        method: 'POST',
      }),
    );
    expect(await prisma.seasonStanding.count()).toBe(2);
    expect(await prisma.fixture.count()).toBe(2);
    expect(await prisma.gameResult.count()).toBe(1);
    expect(
      await prisma.scrapeStatus.findUnique({ where: { id: 1 } }),
    ).toMatchObject({
      lastAttemptedAt: new Date('2026-09-08T08:30:00.000Z'),
      lastError: null,
      lastSucceededAt: new Date('2026-09-08T08:30:00.000Z'),
    });
  });

  it('preserves cached data and records a failed refresh', async () => {
    const adminCookie = await createAdminSession();
    const season = await createCurrentSeason();
    await prisma.seasonStanding.create({
      data: {
        clubName: 'Cached Club',
        drawn: 0,
        ga: 0,
        gd: 1,
        gf: 1,
        lost: 0,
        played: 1,
        points: 3,
        position: 1,
        scrapedAt: new Date('2026-09-07T08:30:00.000Z'),
        seasonId: season.id,
        walkoverGames: 0,
        won: 1,
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    const response = await request(createApp())
      .post('/api/admin/scrape/refresh')
      .set('Cookie', adminCookie);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('SCRAPE_REFRESH_FAILED');
    expect(await prisma.seasonStanding.count()).toBe(1);
    expect(
      await prisma.scrapeStatus.findUnique({ where: { id: 1 } }),
    ).toMatchObject({
      lastError: 'The Powerleague scraper returned HTTP 503.',
      lastSucceededAt: null,
    });
  });

  it('allows the scheduled route only with the Vercel cron secret', async () => {
    await createCurrentSeason();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(validPayload()), { status: 200 }),
        ),
    );
    const app = createApp();

    const rejected = await request(app).get('/api/internal/scrape/refresh');
    const accepted = await request(app)
      .get('/api/internal/scrape/refresh')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(200);
  });
});
