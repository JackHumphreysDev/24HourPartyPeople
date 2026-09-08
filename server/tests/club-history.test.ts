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

const TEAM_NAME = '24 Hour Party People';

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
      email: `${role.toLowerCase()}@club-history.test`,
      name: `Club History ${role}`,
      passwordHash: 'not-used-by-this-test',
      role,
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function createSeason(values?: {
  endDate?: string;
  name?: string;
  tracksGamesPlayed?: boolean;
}) {
  return prisma.season.create({
    data: {
      endDate: new Date(`${values?.endDate ?? '2020-08-31'}T00:00:00.000Z`),
      isCurrent: false,
      name: values?.name ?? 'Summer 2020',
      startDate: new Date('2020-06-01T00:00:00.000Z'),
      tracksGamesPlayed: values?.tracksGamesPlayed ?? true,
    },
  });
}

async function createTeamStanding(seasonId: string) {
  return prisma.seasonStanding.create({
    data: {
      clubName: TEAM_NAME,
      drawn: 2,
      ga: 18,
      gd: 6,
      gf: 24,
      lost: 3,
      played: 12,
      points: 23,
      position: 2,
      scrapedAt: new Date('2020-08-31T20:00:00.000Z'),
      seasonId,
      walkoverGames: 1,
      won: 7,
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

describe('administrator club history API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app).get('/api/admin/club-history');
    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const player = await request(app)
      .post(
        '/api/admin/club-history/21aff50f-8385-4721-844d-d2615f882985/finalise',
      )
      .set('Cookie', playerCookie);
    expect(player.status).toBe(403);
  });

  it('lists only ended tracked seasons that have not been finalised', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const readySeason = await createSeason();
    await createTeamStanding(readySeason.id);
    await createSeason({
      name: 'Historic untracked season',
      tracksGamesPlayed: false,
    });
    await createSeason({ endDate: '2999-12-31', name: 'Future season' });

    const response = await request(createApp())
      .get('/api/admin/club-history')
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.history).toEqual([]);
    expect(response.body.candidates).toHaveLength(1);
    expect(response.body.candidates[0]).toMatchObject({
      id: readySeason.id,
      name: 'Summer 2020',
      standing: { points: 23, position: 2 },
    });
  });

  it('copies the saved team standing into immutable finalised history', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    await createTeamStanding(season.id);
    const app = createApp();

    const created = await request(app)
      .post(`/api/admin/club-history/${season.id}/finalise`)
      .set('Cookie', adminCookie);

    expect(created.status).toBe(201);
    expect(created.body.history).toMatchObject({
      clubName: TEAM_NAME,
      drawn: 2,
      ga: 18,
      gd: 6,
      gf: 24,
      lost: 3,
      played: 12,
      points: 23,
      position: 2,
      season: { id: season.id, name: 'Summer 2020' },
      walkoverGames: 1,
      won: 7,
    });
    expect(created.body.history.finalisedAt).toEqual(expect.any(String));

    await prisma.seasonStanding.update({
      data: { points: 999 },
      where: {
        seasonId_clubName: { clubName: TEAM_NAME, seasonId: season.id },
      },
    });
    const publicResponse = await request(app).get('/api/club-history');
    expect(publicResponse.body.history[0].points).toBe(23);

    const repeated = await request(app)
      .post(`/api/admin/club-history/${season.id}/finalise`)
      .set('Cookie', adminCookie);
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('HISTORY_ALREADY_FINALISED');
  });

  it('requires the season to have ended and its team standing to exist', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const futureSeason = await createSeason({
      endDate: '2999-12-31',
      name: 'Future season',
    });
    await createTeamStanding(futureSeason.id);
    const missingStandingSeason = await createSeason({ name: 'Missing table' });
    const app = createApp();

    const future = await request(app)
      .post(`/api/admin/club-history/${futureSeason.id}/finalise`)
      .set('Cookie', adminCookie);
    expect(future.status).toBe(409);
    expect(future.body.error.code).toBe('SEASON_NOT_ENDED');

    const missingStanding = await request(app)
      .post(`/api/admin/club-history/${missingStandingSeason.id}/finalise`)
      .set('Cookie', adminCookie);
    expect(missingStanding.status).toBe(409);
    expect(missingStanding.body.error.code).toBe('TEAM_STANDING_REQUIRED');
  });

  it('rejects seasons from before the club history record began', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const historicSeason = await createSeason({
      name: 'Historic untracked season',
      tracksGamesPlayed: false,
    });
    await createTeamStanding(historicSeason.id);

    const response = await request(createApp())
      .post(`/api/admin/club-history/${historicSeason.id}/finalise`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SEASON_PREDATES_CLUB_HISTORY');
    expect(await prisma.clubHistory.count()).toBe(0);
  });
});

describe('public club history API', () => {
  it('returns finalised seasons newest first and excludes unfinished rows', async () => {
    const olderSeason = await createSeason({ name: 'Summer 2020' });
    const newerSeason = await createSeason({
      endDate: '2021-08-31',
      name: 'Summer 2021',
    });
    await prisma.clubHistory.createMany({
      data: [
        {
          drawn: 1,
          finalisedAt: new Date('2020-09-01T10:00:00.000Z'),
          ga: 10,
          gd: 5,
          gf: 15,
          lost: 1,
          played: 8,
          points: 19,
          position: 2,
          seasonId: olderSeason.id,
          walkoverGames: 0,
          won: 6,
        },
        {
          drawn: 0,
          finalisedAt: new Date('2021-09-01T10:00:00.000Z'),
          ga: 8,
          gd: 12,
          gf: 20,
          lost: 1,
          played: 8,
          points: 21,
          position: 1,
          seasonId: newerSeason.id,
          walkoverGames: 1,
          won: 7,
        },
      ],
    });

    const response = await request(createApp()).get('/api/club-history');

    expect(response.status).toBe(200);
    expect(
      response.body.history.map(
        (entry: { season: { name: string } }) => entry.season.name,
      ),
    ).toEqual(['Summer 2021', 'Summer 2020']);
    expect(
      response.body.history.every(
        (entry: { clubName: string }) => entry.clubName === TEAM_NAME,
      ),
    ).toBe(true);
  });
});
