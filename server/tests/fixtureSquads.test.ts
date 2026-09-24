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
  await prisma.session.deleteMany();
  await prisma.fixtureSquadEntry.deleteMany();
  await prisma.fixtureAvailability.deleteMany();
  await prisma.gameResult.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.opponentClub.deleteMany();
  await prisma.season.deleteMany();
}

async function createAccount(
  email: string,
  role: 'ADMIN' | 'SUB_ADMIN' | 'PLAYER',
  playerId: string | null = null,
) {
  const user = await prisma.user.create({
    data: { email, name: email, passwordHash: 'not-used', playerId, role },
  });
  return `${SESSION_COOKIE_NAME}=${await createSession(user.id)}`;
}

async function createFixture() {
  const season = await prisma.season.create({
    data: {
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      isCurrent: true,
      name: 'Summer 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  const opponent = await prisma.opponentClub.create({
    data: { name: 'Norton Rivals' },
  });
  return prisma.fixture.create({
    data: {
      competition: 'LEAGUE',
      opponentClubId: opponent.id,
      scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
      seasonId: season.id,
      source: 'SCRAPE',
    },
  });
}

async function createPlayers() {
  const players = [
    ['Keeper', 'GK'],
    ['Defender One', 'DEF'],
    ['Defender Two', 'DEF'],
    ['Defender Three', 'DEF'],
    ['Mid', 'MID'],
    ['Forward', 'FWD'],
    ['Bench', 'DEF'],
  ] as const;
  return Promise.all(
    players.map(([name, position]) =>
      prisma.player.create({ data: { description: '', name, position } }),
    ),
  );
}

function validSquad(playerIds: string[]) {
  return {
    entries: [
      { isStarter: true, playerId: playerIds[0], position: 'GK' },
      { isStarter: true, playerId: playerIds[1], position: 'DEF' },
      { isStarter: true, playerId: playerIds[2], position: 'DEF' },
      { isStarter: true, playerId: playerIds[3], position: 'DEF' },
      { isStarter: true, playerId: playerIds[4], position: 'MID' },
      { isStarter: true, playerId: playerIds[5], position: 'FWD' },
      { isStarter: false, playerId: playerIds[6], position: null },
    ],
  };
}

beforeAll(async () => {
  await prisma.$connect();
});
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
  await clearDatabase();
});
afterEach(async () => {
  await clearDatabase();
  vi.useRealTimers();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('fixture matchday squads', () => {
  it('lets only the administrator save a complete 1–3–1–1 squad', async () => {
    const fixture = await createFixture();
    const players = await createPlayers();
    const admin = await createAccount('admin@test.example', 'ADMIN');
    const subAdmin = await createAccount(
      'doug_daly@hotmail.co.uk',
      'SUB_ADMIN',
      players[0]!.id,
    );
    const app = createApp();
    const input = validSquad(players.map((player) => player.id));

    expect(
      (
        await request(app)
          .put(`/api/admin/fixtures/${fixture.id}/squad`)
          .set('Cookie', subAdmin)
          .send(input)
      ).status,
    ).toBe(403);

    const saved = await request(app)
      .put(`/api/admin/fixtures/${fixture.id}/squad`)
      .set('Cookie', admin)
      .send(input);

    expect(saved.status).toBe(200);
    expect(saved.body.fixture.id).toBe(fixture.id);
    expect(saved.body.fixture.squadEntries).toHaveLength(7);
    expect(await prisma.fixtureSquadEntry.count()).toBe(7);
  });

  it('rejects duplicate, incomplete, and inactive-player selections without replacing the saved squad', async () => {
    const fixture = await createFixture();
    const players = await createPlayers();
    const admin = await createAccount('admin@test.example', 'ADMIN');
    const app = createApp();
    const input = validSquad(players.map((player) => player.id));
    await request(app)
      .put(`/api/admin/fixtures/${fixture.id}/squad`)
      .set('Cookie', admin)
      .send(input);

    const duplicate = await request(app)
      .put(`/api/admin/fixtures/${fixture.id}/squad`)
      .set('Cookie', admin)
      .send({
        entries: input.entries.map((entry, index) =>
          index === 1 ? { ...entry, playerId: players[0]!.id } : entry,
        ),
      });
    expect(duplicate.status).toBe(400);

    const incomplete = await request(app)
      .put(`/api/admin/fixtures/${fixture.id}/squad`)
      .set('Cookie', admin)
      .send({ entries: input.entries.slice(0, 5) });
    expect(incomplete.status).toBe(400);

    await prisma.player.update({
      data: { isActiveSquad: false },
      where: { id: players[6]!.id },
    });
    const inactive = await request(app)
      .put(`/api/admin/fixtures/${fixture.id}/squad`)
      .set('Cookie', admin)
      .send(input);
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.message).toBe(
      'Only active squad players can be selected in their recorded playing positions.',
    );
    expect(await prisma.fixtureSquadEntry.count()).toBe(7);
  });

  it('shows selected squads only to signed-in accounts with an approved player profile', async () => {
    const fixture = await createFixture();
    const players = await createPlayers();
    const admin = await createAccount('admin@test.example', 'ADMIN');
    const player = await createAccount(
      'player@test.example',
      'PLAYER',
      players[1]!.id,
    );
    const unlinked = await createAccount('unlinked@test.example', 'PLAYER');
    const app = createApp();
    await request(app)
      .put(`/api/admin/fixtures/${fixture.id}/squad`)
      .set('Cookie', admin)
      .send(validSquad(players.map((entry) => entry.id)));

    expect((await request(app).get('/api/fixtures/squads')).status).toBe(401);
    expect(
      (await request(app).get('/api/fixtures/squads').set('Cookie', unlinked))
        .status,
    ).toBe(403);

    const visible = await request(app)
      .get('/api/fixtures/squads')
      .set('Cookie', player);
    expect(visible.status).toBe(200);
    expect(visible.body.fixtures[0].squadEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isStarter: true,
          player: expect.objectContaining({ name: 'Keeper' }),
          position: 'GK',
        }),
        expect.objectContaining({
          isStarter: false,
          player: expect.objectContaining({ name: 'Bench' }),
          position: null,
        }),
      ]),
    );
  });

  it('keeps past, cancelled, and played fixture squads read-only', async () => {
    const fixture = await createFixture();
    const players = await createPlayers();
    const admin = await createAccount('admin@test.example', 'ADMIN');
    const app = createApp();
    const input = validSquad(players.map((player) => player.id));

    for (const update of [
      { scheduledDate: new Date('2026-09-01T00:00:00.000Z') },
      { status: 'CANCELLED' as const },
      { status: 'PLAYED' as const },
    ]) {
      await prisma.fixture.update({ data: update, where: { id: fixture.id } });
      const response = await request(app)
        .put(`/api/admin/fixtures/${fixture.id}/squad`)
        .set('Cookie', admin)
        .send(input);
      expect(response.status).toBe(409);
      await prisma.fixture.update({
        data: {
          scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
          status: 'SCHEDULED',
        },
        where: { id: fixture.id },
      });
    }
  });
});
