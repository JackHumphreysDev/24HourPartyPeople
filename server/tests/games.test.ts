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

async function createSeason() {
  return prisma.season.create({
    data: {
      endDate: new Date('2026-08-31T00:00:00.000Z'),
      isCurrent: true,
      name: 'Summer 2026',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      tracksGamesPlayed: true,
    },
  });
}

function manualResultInput(seasonId: string) {
  return {
    competition: 'LEAGUE',
    datePlayed: '2026-07-14',
    entryMode: 'manual',
    isWalkover: false,
    opponentName: 'Norton Rivals',
    opponentScore: 2,
    ourScore: 4,
    seasonId,
    walkoverReason: null,
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(clearDatabase);
afterEach(clearDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('administrator game API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app).post('/api/admin/games').send({});

    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const player = await request(app)
      .get('/api/admin/games/fixtures')
      .set('Cookie', playerCookie);

    expect(player.status).toBe(403);
  });

  it('creates same-date manual league and cup results and reuses the opponent', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const app = createApp();

    const league = await request(app)
      .post('/api/admin/games')
      .set('Cookie', adminCookie)
      .send(manualResultInput(season.id));
    const cup = await request(app)
      .post('/api/admin/games')
      .set('Cookie', adminCookie)
      .send({
        ...manualResultInput(season.id),
        competition: 'CUP',
        opponentName: 'norton rivals',
        opponentScore: 1,
        ourScore: 3,
      });

    expect(league.status).toBe(201);
    expect(league.body.standingsRefreshRequired).toBe(true);
    expect(cup.status).toBe(201);
    expect(cup.body.standingsRefreshRequired).toBe(false);
    expect(await prisma.gameResult.count()).toBe(2);
    expect(await prisma.opponentClub.count()).toBe(1);
    expect(cup.body.game.opponentClub.name).toBe('Norton Rivals');
  });

  it('validates scores, walkovers, competition, and the season date range', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const app = createApp();
    const path = '/api/admin/games';

    const missingScores = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        ...manualResultInput(season.id),
        opponentScore: null,
        ourScore: null,
      });
    const scoredWalkover = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        ...manualResultInput(season.id),
        isWalkover: true,
      });
    const cupWalkover = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        ...manualResultInput(season.id),
        competition: 'CUP',
        isWalkover: true,
        opponentScore: null,
        ourScore: null,
      });
    const negativeScore = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        ...manualResultInput(season.id),
        ourScore: -1,
      });
    const outsideSeason = await request(app)
      .post(path)
      .set('Cookie', adminCookie)
      .send({
        ...manualResultInput(season.id),
        datePlayed: '2026-09-01',
      });

    expect(missingScores.status).toBe(400);
    expect(missingScores.body.error.code).toBe('INVALID_GAME_RESULT');
    expect(scoredWalkover.status).toBe(400);
    expect(scoredWalkover.body.error.code).toBe('INVALID_GAME_RESULT');
    expect(cupWalkover.status).toBe(400);
    expect(cupWalkover.body.error.code).toBe('CUP_WALKOVER_NOT_SUPPORTED');
    expect(negativeScore.status).toBe(400);
    expect(negativeScore.body.error.code).toBe('INVALID_GAME_RESULT');
    expect(outsideSeason.status).toBe(400);
    expect(outsideSeason.body.error.code).toBe('RESULT_OUTSIDE_SEASON');
    expect(await prisma.gameResult.count()).toBe(0);
  });

  it('lists scheduled fixtures and records a result against one only once', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Fixture Opponent' },
    });
    const fixture = await prisma.fixture.create({
      data: {
        competition: 'LEAGUE',
        opponentClubId: opponent.id,
        scheduledDate: new Date('2026-07-21T00:00:00.000Z'),
        seasonId: season.id,
        source: 'MANUAL',
        venue: 'Norton Playing Fields 3G',
      },
    });
    const app = createApp();

    const fixtures = await request(app)
      .get('/api/admin/games/fixtures')
      .set('Cookie', adminCookie);
    expect(fixtures.status).toBe(200);
    expect(fixtures.body.fixtures[0]).toMatchObject({
      competition: 'LEAGUE',
      id: fixture.id,
      opponentClub: { name: 'Fixture Opponent' },
    });

    const resultInput = {
      entryMode: 'fixture',
      fixtureId: fixture.id,
      isWalkover: false,
      opponentScore: 1,
      ourScore: 2,
      walkoverReason: null,
    };
    const created = await request(app)
      .post('/api/admin/games')
      .set('Cookie', adminCookie)
      .send(resultInput);
    const duplicate = await request(app)
      .post('/api/admin/games')
      .set('Cookie', adminCookie)
      .send(resultInput);

    expect(created.status).toBe(201);
    expect(created.body.game.fixtureId).toBe(fixture.id);
    expect(created.body.game.datePlayed).toBe('2026-07-21T00:00:00.000Z');
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('FIXTURE_RESULT_EXISTS');
    expect(
      await prisma.fixture.findUnique({
        select: { status: true },
        where: { id: fixture.id },
      }),
    ).toEqual({ status: 'PLAYED' });
  });
});

describe('public game history API', () => {
  it('returns league walkover and cup results separately on the same date', async () => {
    const season = await createSeason();
    const opponent = await prisma.opponentClub.create({
      data: { name: 'History Opponent' },
    });
    const datePlayed = new Date('2026-07-28T00:00:00.000Z');

    await prisma.gameResult.createMany({
      data: [
        {
          competition: 'LEAGUE',
          datePlayed,
          isWalkover: true,
          opponentClubId: opponent.id,
          seasonId: season.id,
          walkoverReason: 'Opponent could not field a team.',
        },
        {
          competition: 'CUP',
          datePlayed,
          opponentClubId: opponent.id,
          opponentScore: 2,
          ourScore: 5,
          seasonId: season.id,
        },
      ],
    });

    const response = await request(createApp()).get('/api/games');

    expect(response.status).toBe(200);
    expect(response.body.games).toHaveLength(2);
    expect(response.body.games).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          competition: 'LEAGUE',
          isWalkover: true,
          walkoverReason: 'Opponent could not field a team.',
        }),
        expect.objectContaining({
          competition: 'CUP',
          isWalkover: false,
          opponentScore: 2,
          ourScore: 5,
        }),
      ]),
    );
  });
});
