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
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.opponentClub.deleteMany();
  await prisma.season.deleteMany();
}

async function createUserSession(role: 'ADMIN' | 'PLAYER') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}@fixtures.test`,
      name: `Fixture ${role}`,
      passwordHash: 'not-used-by-this-test',
      role,
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function createSeason() {
  return prisma.season.create({
    data: {
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      isCurrent: true,
      name: 'Summer 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      tracksGamesPlayed: true,
    },
  });
}

function fixtureInput(seasonId: string) {
  return {
    competition: 'LEAGUE',
    opponentName: 'Norton Rivals',
    scheduledDate: '2026-09-15',
    scheduledTime: '20:15',
    seasonId,
    venue: 'Norton Playing Fields 3G',
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(clearDatabase);
afterEach(() => {
  vi.useRealTimers();
  return clearDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('administrator fixture API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app).get('/api/admin/fixtures');
    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const player = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', playerCookie)
      .send({});
    expect(player.status).toBe(403);
  });

  it('creates manual fixtures and reuses opponents case-insensitively', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const app = createApp();

    const first = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', adminCookie)
      .send(fixtureInput(season.id));
    const second = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', adminCookie)
      .send({
        ...fixtureInput(season.id),
        opponentName: 'norton rivals',
        scheduledDate: '2026-09-22',
        scheduledTime: null,
        venue: null,
      });

    expect(first.status).toBe(201);
    expect(first.body.fixture).toMatchObject({
      competition: 'LEAGUE',
      opponentClub: { name: 'Norton Rivals' },
      scheduledDate: '2026-09-15T00:00:00.000Z',
      scheduledTime: '1970-01-01T20:15:00.000Z',
      source: 'MANUAL',
      status: 'SCHEDULED',
      venue: 'Norton Playing Fields 3G',
    });
    expect(second.status).toBe(201);
    expect(second.body.fixture.scheduledTime).toBeNull();
    expect(second.body.fixture.venue).toBeNull();
    expect(await prisma.opponentClub.count()).toBe(1);
  });

  it('rejects invalid times, dates outside the season, and duplicate fixtures', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const app = createApp();

    const invalidTime = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', adminCookie)
      .send({ ...fixtureInput(season.id), scheduledTime: '25:00' });
    const outsideSeason = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', adminCookie)
      .send({ ...fixtureInput(season.id), scheduledDate: '2027-01-01' });
    const created = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', adminCookie)
      .send(fixtureInput(season.id));
    const duplicate = await request(app)
      .post('/api/admin/fixtures')
      .set('Cookie', adminCookie)
      .send({ ...fixtureInput(season.id), opponentName: 'norton rivals' });

    expect(invalidTime.status).toBe(400);
    expect(invalidTime.body.error.code).toBe('INVALID_FIXTURE');
    expect(outsideSeason.status).toBe(400);
    expect(outsideSeason.body.error.code).toBe('FIXTURE_OUTSIDE_SEASON');
    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_FIXTURE');
    expect(await prisma.fixture.count()).toBe(1);
  });

  it('edits only scheduled fixtures and preserves their source', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Original Opponent' },
    });
    const scheduled = await prisma.fixture.create({
      data: {
        competition: 'LEAGUE',
        opponentClubId: opponent.id,
        scheduledDate: new Date('2026-09-08T00:00:00.000Z'),
        seasonId: season.id,
        source: 'SCRAPE',
      },
    });
    const played = await prisma.fixture.create({
      data: {
        competition: 'LEAGUE',
        opponentClubId: opponent.id,
        scheduledDate: new Date('2026-09-01T00:00:00.000Z'),
        seasonId: season.id,
        source: 'MANUAL',
        status: 'PLAYED',
      },
    });
    const app = createApp();

    const updated = await request(app)
      .put(`/api/admin/fixtures/${scheduled.id}`)
      .set('Cookie', adminCookie)
      .send({
        ...fixtureInput(season.id),
        competition: 'CUP',
        opponentName: 'Corrected Opponent',
      });
    const locked = await request(app)
      .put(`/api/admin/fixtures/${played.id}`)
      .set('Cookie', adminCookie)
      .send(fixtureInput(season.id));
    const listed = await request(app)
      .get('/api/admin/fixtures')
      .set('Cookie', adminCookie);

    expect(updated.status).toBe(200);
    expect(updated.body.fixture).toMatchObject({
      competition: 'CUP',
      opponentClub: { name: 'Corrected Opponent' },
      source: 'SCRAPE',
    });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('FIXTURE_LOCKED');
    expect(listed.status).toBe(200);
    expect(listed.body.fixtures).toHaveLength(2);
    expect(listed.body.fixtures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: scheduled.id, status: 'SCHEDULED' }),
        expect.objectContaining({ id: played.id, status: 'PLAYED' }),
      ]),
    );
  });
});

describe('public upcoming fixture API', () => {
  it('returns only scheduled fixtures from today onward in date order', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00.000Z'));
    const season = await createSeason();
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Fixture Opponent' },
    });
    await prisma.fixture.createMany({
      data: [
        {
          competition: 'LEAGUE',
          opponentClubId: opponent.id,
          scheduledDate: new Date('2026-09-06T00:00:00.000Z'),
          seasonId: season.id,
          source: 'MANUAL',
        },
        {
          competition: 'LEAGUE',
          opponentClubId: opponent.id,
          scheduledDate: new Date('2026-09-07T00:00:00.000Z'),
          scheduledTime: new Date('1970-01-01T21:00:00.000Z'),
          seasonId: season.id,
          source: 'MANUAL',
        },
        {
          competition: 'CUP',
          opponentClubId: opponent.id,
          scheduledDate: new Date('2026-09-14T00:00:00.000Z'),
          scheduledTime: new Date('1970-01-01T20:00:00.000Z'),
          seasonId: season.id,
          source: 'SCRAPE',
        },
        {
          competition: 'LEAGUE',
          opponentClubId: opponent.id,
          scheduledDate: new Date('2026-09-21T00:00:00.000Z'),
          seasonId: season.id,
          source: 'MANUAL',
          status: 'PLAYED',
        },
      ],
    });

    const response = await request(createApp()).get('/api/fixtures/upcoming');

    expect(response.status).toBe(200);
    expect(response.body.fixtures).toHaveLength(2);
    expect(response.body.scrapeStatus).toEqual({
      lastAttemptedAt: null,
      lastSucceededAt: null,
      latestRefreshFailed: false,
    });
    expect(
      response.body.fixtures.map(
        (fixture: { competition: string }) => fixture.competition,
      ),
    ).toEqual(['LEAGUE', 'CUP']);
    expect(response.body.fixtures[0]).toMatchObject({
      scheduledDate: '2026-09-07T00:00:00.000Z',
      scheduledTime: '1970-01-01T21:00:00.000Z',
      status: 'SCHEDULED',
    });
  });
});
