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

import type { PlayerPosition } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/auth/session.js';
import { prisma } from '../src/lib/prisma.js';

const TEAM_NAME = '24 Hour Party People';
const starterPositions: PlayerPosition[] = [
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'FWD',
];

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
  isClubHistoryEligible?: boolean;
  isCurrent?: boolean;
  name?: string;
  tracksGamesPlayed?: boolean;
}) {
  return prisma.season.create({
    data: {
      endDate: new Date(`${values?.endDate ?? '2026-08-31'}T00:00:00.000Z`),
      isClubHistoryEligible: values?.isClubHistoryEligible ?? true,
      isCurrent: values?.isCurrent ?? false,
      name: values?.name ?? 'Summer 2026',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      tracksGamesPlayed: values?.tracksGamesPlayed ?? false,
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
      scrapedAt: new Date('2026-08-31T20:00:00.000Z'),
      seasonId,
      walkoverGames: 1,
      won: 7,
    },
  });
}

async function createFormation(seasonId: string, withBench = false) {
  const players = [];
  for (const [index, position] of starterPositions.entries()) {
    players.push(
      await prisma.player.create({
        data: {
          description: `Season player ${index + 1}.`,
          name: `Player ${index + 1}`,
          position,
        },
      }),
    );
  }
  if (withBench) {
    players.push(
      await prisma.player.create({
        data: {
          description: 'Season substitute.',
          isOnBench: true,
          name: 'Bench Player',
          position: 'MID',
        },
      }),
    );
  }
  const entries = players.map((player, index) => ({
    isStarter: index < starterPositions.length,
    playerId: player.id,
    position: player.position!,
  }));
  await prisma.seasonSquadEntry.createMany({
    data: entries.map((entry) => ({ ...entry, seasonId })),
  });
  return { entries, players };
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
    expect((await request(app).get('/api/admin/club-history')).status).toBe(
      401,
    );

    const playerCookie = await createUserSession('PLAYER');
    const response = await request(app)
      .post(
        '/api/admin/club-history/21aff50f-8385-4721-844d-d2615f882985/finalise',
      )
      .set('Cookie', playerCookie);
    expect(response.status).toBe(403);
  });

  it('lists eligible seasons from Summer 2026 onwards', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const summer = await createSeason({ isCurrent: true });
    await createTeamStanding(summer.id);
    await createSeason({
      isClubHistoryEligible: false,
      name: 'Spring 2026',
    });
    const future = await createSeason({
      endDate: '2999-12-31',
      name: 'Autumn 2026',
    });

    const response = await request(createApp())
      .get('/api/admin/club-history')
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.history).toEqual([]);
    expect(response.body.seasons).toHaveLength(2);
    expect(response.body.seasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canFinalise: true,
          id: summer.id,
          standing: expect.objectContaining({ points: 23, position: 2 }),
        }),
        expect.objectContaining({ canFinalise: false, id: future.id }),
      ]),
    );
  });

  it('suggests the active Summer 2026 formation and preserves bench players', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason({ isCurrent: true });
    const { players } = await createFormation(season.id, true);
    await prisma.seasonSquadEntry.deleteMany({
      where: { seasonId: season.id },
    });

    const response = await request(createApp())
      .get('/api/admin/club-history')
      .set('Cookie', adminCookie);

    const suggested = response.body.seasons[0].suggestedSquad;
    expect(suggested).toHaveLength(7);
    expect(
      suggested.find(
        (entry: { playerId: string }) => entry.playerId === players[6]!.id,
      ),
    ).toMatchObject({ isStarter: false, position: 'MID' });
  });

  it('suggests future season starters from recorded appearances', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason({
      name: 'Autumn 2026',
      tracksGamesPlayed: true,
    });
    const { players } = await createFormation(season.id, true);
    await prisma.seasonSquadEntry.deleteMany({
      where: { seasonId: season.id },
    });
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Appearances Opponent' },
    });
    await prisma.gameResult.create({
      data: {
        competition: 'LEAGUE',
        datePlayed: new Date('2026-07-01T00:00:00.000Z'),
        opponentClubId: opponent.id,
        opponentScore: 1,
        ourScore: 2,
        playerStats: {
          create: players.map((player) => ({ playerId: player.id })),
        },
        seasonId: season.id,
      },
    });
    await prisma.gameResult.create({
      data: {
        competition: 'LEAGUE',
        datePlayed: new Date('2026-07-08T00:00:00.000Z'),
        opponentClubId: opponent.id,
        opponentScore: 0,
        ourScore: 1,
        playerStats: { create: { playerId: players[6]!.id } },
        seasonId: season.id,
      },
    });

    const response = await request(createApp())
      .get('/api/admin/club-history')
      .set('Cookie', adminCookie);

    const suggested = response.body.seasons[0].suggestedSquad;
    expect(
      suggested.find(
        (entry: { playerId: string }) => entry.playerId === players[6]!.id,
      ),
    ).toMatchObject({ isStarter: true, position: 'MID' });
    expect(
      suggested.find(
        (entry: { playerId: string }) => entry.playerId === players[4]!.id,
      ),
    ).toMatchObject({ isStarter: false, position: 'MID' });
  });

  it('saves one 1–3–1–1 formation plus any bench players', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    const { entries } = await createFormation(season.id, true);
    await prisma.seasonSquadEntry.deleteMany({
      where: { seasonId: season.id },
    });
    const app = createApp();

    const invalid = await request(app)
      .put(`/api/admin/club-history/${season.id}/squad`)
      .set('Cookie', adminCookie)
      .send({ entries: entries.slice(0, 5) });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_SEASON_SQUAD');

    const saved = await request(app)
      .put(`/api/admin/club-history/${season.id}/squad`)
      .set('Cookie', adminCookie)
      .send({ entries });
    expect(saved.status).toBe(200);
    expect(saved.body.entries).toHaveLength(7);
    expect(
      saved.body.entries.filter(
        (entry: { isStarter: boolean }) => entry.isStarter,
      ),
    ).toHaveLength(6);
    await expect(
      prisma.seasonSquadEntry.count({ where: { seasonId: season.id } }),
    ).resolves.toBe(7);
  });

  it('copies the final standing, formation and awards into club history', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason();
    await createTeamStanding(season.id);
    const { players } = await createFormation(season.id, true);
    await prisma.playerSeasonStat.createMany({
      data: [
        {
          assists: 1,
          cleanSheets: 4,
          goals: 0,
          playerId: players[0]!.id,
          seasonId: season.id,
        },
        {
          assists: 5,
          cleanSheets: 0,
          goals: 2,
          playerId: players[4]!.id,
          seasonId: season.id,
        },
        {
          assists: 1,
          cleanSheets: 0,
          goals: 8,
          playerId: players[5]!.id,
          seasonId: season.id,
        },
      ],
    });
    const app = createApp();

    const created = await request(app)
      .post(`/api/admin/club-history/${season.id}/finalise`)
      .set('Cookie', adminCookie);

    expect(created.status).toBe(201);
    expect(created.body.history).toMatchObject({
      awards: {
        assistKing: { players: [{ name: 'Player 5' }], value: 5 },
        goldenBoot: { players: [{ name: 'Player 6' }], value: 8 },
        goldenGlove: { players: [{ name: 'Player 1' }], value: 4 },
      },
      clubName: TEAM_NAME,
      points: 23,
      position: 2,
      season: { id: season.id, name: 'Summer 2026' },
    });
    expect(created.body.history.squad).toHaveLength(7);

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

  it('requires an ended season, a saved formation and a team standing', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const future = await createSeason({
      endDate: '2999-12-31',
      name: 'Future season',
    });
    await createTeamStanding(future.id);
    await createFormation(future.id);
    const missingFormation = await createSeason({ name: 'Missing formation' });
    await createTeamStanding(missingFormation.id);
    const missingStanding = await createSeason({ name: 'Missing table' });
    await createFormation(missingStanding.id);
    const app = createApp();

    const futureResponse = await request(app)
      .post(`/api/admin/club-history/${future.id}/finalise`)
      .set('Cookie', adminCookie);
    expect(futureResponse.body.error.code).toBe('SEASON_NOT_ENDED');

    const formationResponse = await request(app)
      .post(`/api/admin/club-history/${missingFormation.id}/finalise`)
      .set('Cookie', adminCookie);
    expect(formationResponse.body.error.code).toBe('SEASON_SQUAD_REQUIRED');

    const standingResponse = await request(app)
      .post(`/api/admin/club-history/${missingStanding.id}/finalise`)
      .set('Cookie', adminCookie);
    expect(standingResponse.body.error.code).toBe('TEAM_STANDING_REQUIRED');
  });

  it('rejects seasons from before the club history record began', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const season = await createSeason({
      isClubHistoryEligible: false,
      name: 'Spring 2026',
    });
    await createTeamStanding(season.id);

    const response = await request(createApp())
      .post(`/api/admin/club-history/${season.id}/finalise`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SEASON_PREDATES_CLUB_HISTORY');
  });
});

describe('public club history API', () => {
  it('returns finalised seasons newest first with shared tracked-season awards', async () => {
    const older = await createSeason({ name: 'Summer 2026' });
    const newer = await createSeason({
      endDate: '2027-01-31',
      name: 'Winter 2026',
      tracksGamesPlayed: true,
    });
    const { players } = await createFormation(newer.id);
    const opponent = await prisma.opponentClub.create({
      data: { name: 'History Opponent' },
    });
    await prisma.gameResult.create({
      data: {
        competition: 'LEAGUE',
        datePlayed: new Date('2027-01-01T00:00:00.000Z'),
        opponentClubId: opponent.id,
        opponentScore: 0,
        ourScore: 4,
        playerStats: {
          create: [
            { cleanSheet: true, goals: 2, playerId: players[0]!.id },
            { goals: 2, playerId: players[5]!.id },
          ],
        },
        seasonId: newer.id,
      },
    });
    await prisma.clubHistory.createMany({
      data: [
        {
          drawn: 0,
          finalisedAt: new Date('2026-09-01T10:00:00.000Z'),
          ga: 0,
          gd: 0,
          gf: 0,
          lost: 0,
          played: 0,
          points: 0,
          position: 1,
          seasonId: older.id,
          walkoverGames: 0,
          won: 0,
        },
        {
          drawn: 0,
          finalisedAt: new Date('2027-02-01T10:00:00.000Z'),
          ga: 0,
          gd: 0,
          gf: 0,
          lost: 0,
          played: 0,
          points: 0,
          position: 1,
          seasonId: newer.id,
          walkoverGames: 0,
          won: 0,
        },
      ],
    });

    const response = await request(createApp()).get('/api/club-history');

    expect(response.status).toBe(200);
    expect(
      response.body.history.map(
        (entry: { season: { name: string } }) => entry.season.name,
      ),
    ).toEqual(['Winter 2026', 'Summer 2026']);
    expect(response.body.history[0].awards.goldenBoot).toMatchObject({
      players: [{ name: 'Player 1' }, { name: 'Player 6' }],
      value: 2,
    });
    expect(response.body.history[0].awards.goldenGlove).toMatchObject({
      players: [{ name: 'Player 1' }],
      value: 1,
    });
  });
});
