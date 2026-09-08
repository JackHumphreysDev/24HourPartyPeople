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
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.opponentClub.deleteMany();
  await prisma.season.deleteMany();
}

async function createUserSession(role: 'ADMIN' | 'PLAYER') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}@example.test`,
      name: `Test ${role}`,
      passwordHash: 'not-used-by-this-test',
      role,
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function seasonInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    endDate: '2026-08-31',
    isCurrent: true,
    name: 'Summer 2026',
    startDate: '2026-06-01',
    tracksGamesPlayed: true,
    ...overrides,
  };
}

async function createPlayer() {
  return prisma.player.create({
    data: {
      description: 'A player used by the statistics tests.',
      name: 'Statistics Player',
      position: 'MID',
    },
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(clearDatabase);
afterEach(clearDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('administrator season API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app).get('/api/admin/seasons');

    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const player = await request(app)
      .get('/api/admin/seasons')
      .set('Cookie', playerCookie);

    expect(player.status).toBe(403);
  });

  it('requires the first season to be current and to track games played', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();

    const nonCurrent = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(seasonInput({ isCurrent: false }));

    expect(nonCurrent.status).toBe(409);
    expect(nonCurrent.body.error.code).toBe('CURRENT_SEASON_REQUIRED');

    const untrackedCurrent = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(seasonInput({ tracksGamesPlayed: false }));

    expect(untrackedCurrent.status).toBe(400);
    expect(untrackedCurrent.body.error.code).toBe('INVALID_SEASON');
  });

  it('switches the current season atomically and keeps exactly one current', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();
    const firstResponse = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(seasonInput());

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(
        seasonInput({
          endDate: '2026-11-30',
          name: 'Autumn 2026',
          startDate: '2026-09-01',
        }),
      );

    expect(secondResponse.status).toBe(201);
    expect(await prisma.season.count({ where: { isCurrent: true } })).toBe(1);

    const seasons = await prisma.season.findMany({
      orderBy: { startDate: 'asc' },
      select: { isCurrent: true, name: true },
    });
    expect(seasons).toEqual([
      { isCurrent: false, name: 'Summer 2026' },
      { isCurrent: true, name: 'Autumn 2026' },
    ]);
  });

  it('does not allow the current season to be unset directly', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();
    const created = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(seasonInput());

    const response = await request(app)
      .put(`/api/admin/seasons/${created.body.season.id}`)
      .set('Cookie', adminCookie)
      .send(seasonInput({ isCurrent: false }));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CURRENT_SEASON_CANNOT_BE_UNSET');
  });

  it('preserves games-played tracking once recorded data exists', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();
    const firstResponse = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(seasonInput());
    const secondResponse = await request(app)
      .post('/api/admin/seasons')
      .set('Cookie', adminCookie)
      .send(
        seasonInput({
          endDate: '2026-11-30',
          name: 'Autumn 2026',
          startDate: '2026-09-01',
        }),
      );
    const player = await createPlayer();

    await prisma.playerSeasonStat.create({
      data: {
        gamesPlayed: 8,
        playerId: player.id,
        seasonId: firstResponse.body.season.id,
      },
    });

    const response = await request(app)
      .put(`/api/admin/seasons/${firstResponse.body.season.id}`)
      .set('Cookie', adminCookie)
      .send(seasonInput({ isCurrent: false, tracksGamesPlayed: false }));

    expect(secondResponse.status).toBe(201);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TRACKED_GAMES_EXIST');
  });
});

describe('administrator player statistics API', () => {
  it('enforces whether each season tracked games played', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const player = await createPlayer();
    const historicSeason = await prisma.season.create({
      data: {
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        name: 'Spring 2026',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        tracksGamesPlayed: false,
      },
    });
    const currentSeason = await prisma.season.create({
      data: {
        endDate: new Date('2026-08-31T00:00:00.000Z'),
        isCurrent: true,
        name: 'Summer 2026',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        tracksGamesPlayed: true,
      },
    });
    const app = createApp();

    const historicWithGames = await request(app)
      .post(`/api/admin/players/${player.id}/season-stats`)
      .set('Cookie', adminCookie)
      .send({
        assists: 1,
        cleanSheets: 2,
        gamesPlayed: 8,
        goals: 3,
        note: null,
        seasonId: historicSeason.id,
      });
    const currentWithoutGames = await request(app)
      .post(`/api/admin/players/${player.id}/season-stats`)
      .set('Cookie', adminCookie)
      .send({
        assists: 1,
        cleanSheets: 2,
        gamesPlayed: null,
        goals: 3,
        note: null,
        seasonId: currentSeason.id,
      });

    expect(historicWithGames.status).toBe(400);
    expect(historicWithGames.body.error.code).toBe('GAMES_PLAYED_NOT_TRACKED');
    expect(currentWithoutGames.status).toBe(400);
    expect(currentWithoutGames.body.error.code).toBe('GAMES_PLAYED_REQUIRED');
  });

  it('upserts non-negative statistics for inactive players', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const player = await prisma.player.create({
      data: {
        description: 'A former player whose history remains editable.',
        isActiveSquad: false,
        name: 'Former Player',
        position: 'FWD',
      },
    });
    const season = await prisma.season.create({
      data: {
        endDate: new Date('2026-08-31T00:00:00.000Z'),
        isCurrent: true,
        name: 'Summer 2026',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        tracksGamesPlayed: true,
      },
    });
    const app = createApp();
    const path = `/api/admin/players/${player.id}/season-stats`;

    const invalid = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        assists: 1,
        cleanSheets: 0,
        gamesPlayed: 2,
        goals: -1,
        note: null,
        seasonId: season.id,
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_SEASON_STATS');

    const created = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        assists: 1,
        cleanSheets: 0,
        gamesPlayed: 2,
        goals: 1,
        note: null,
        seasonId: season.id,
      });
    const updated = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        assists: 3,
        cleanSheets: 1,
        gamesPlayed: 5,
        goals: 4,
        note: 'Updated after the final fixture.',
        seasonId: season.id,
      });

    expect(created.status).toBe(200);
    expect(updated.status).toBe(200);
    expect(updated.body.seasonStats).toMatchObject({
      assists: 3,
      gamesPlayed: 5,
      goals: 4,
      seasonId: season.id,
    });
    expect(await prisma.playerSeasonStat.count()).toBe(1);

    const list = await request(app).get(path).set('Cookie', adminCookie);
    expect(list.status).toBe(200);
    expect(list.body.seasonStats).toHaveLength(1);
    expect(list.body.seasonStats[0].note).toBe(
      'Updated after the final fixture.',
    );
  });
});
