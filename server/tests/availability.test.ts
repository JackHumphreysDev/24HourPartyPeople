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
  playerId: string | null,
  role: 'ADMIN' | 'PLAYER' = 'PLAYER',
) {
  const user = await prisma.user.create({
    data: { email, name: email, passwordHash: 'not-used', playerId, role },
  });
  return `${SESSION_COOKIE_NAME}=${await createSession(user.id)}`;
}

async function createFixture(
  date = '2026-09-15',
  status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED',
) {
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
      scheduledDate: new Date(`${date}T00:00:00.000Z`),
      seasonId: season.id,
      source: 'SCRAPE',
      status,
    },
  });
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

describe('matchday availability', () => {
  it('requires an approved player profile to respond', async () => {
    const fixture = await createFixture();
    const app = createApp();
    const unlinked = await createAccount('unlinked@test.example', null);
    const admin = await createAccount('admin@test.example', null, 'ADMIN');

    expect((await request(app).get('/api/fixtures/availability')).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .put(`/api/fixtures/${fixture.id}/availability`)
          .set('Cookie', unlinked)
          .send({ response: 'AVAILABLE' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/fixtures/${fixture.id}/availability`)
          .set('Cookie', admin)
          .send({ response: 'AVAILABLE' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/admin/fixtures/availability')
          .set('Cookie', unlinked)
      ).status,
    ).toBe(403);
  });

  it('lets each approved player set and change only their own response while the administrator sees the named roster', async () => {
    const fixture = await createFixture();
    const firstPlayer = await prisma.player.create({
      data: { description: '', name: 'Twiggy' },
    });
    const secondPlayer = await prisma.player.create({
      data: { description: '', name: 'Kyle' },
    });
    const first = await createAccount('first@test.example', firstPlayer.id);
    const second = await createAccount('second@test.example', secondPlayer.id);
    const admin = await createAccount('admin@test.example', null, 'ADMIN');
    const app = createApp();

    const firstResponse = await request(app)
      .put(`/api/fixtures/${fixture.id}/availability`)
      .set('Cookie', first)
      .send({ response: 'AVAILABLE' });
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.availability).toEqual({
      fixtureId: fixture.id,
      response: 'AVAILABLE',
    });
    await request(app)
      .put(`/api/fixtures/${fixture.id}/availability`)
      .set('Cookie', second)
      .send({ response: 'UNSURE' });
    const changed = await request(app)
      .put(`/api/fixtures/${fixture.id}/availability`)
      .set('Cookie', first)
      .send({ response: 'UNAVAILABLE' });
    expect(changed.status).toBe(200);
    expect(await prisma.fixtureAvailability.count()).toBe(2);

    const own = await request(app)
      .get('/api/fixtures/availability')
      .set('Cookie', first);
    expect(own.body.availability).toEqual([
      { fixtureId: fixture.id, response: 'UNAVAILABLE' },
    ]);
    const roster = await request(app)
      .get('/api/admin/fixtures/availability')
      .set('Cookie', admin);
    expect(roster.status).toBe(200);
    expect(roster.body.fixtures[0]).toMatchObject({
      id: fixture.id,
      availability: [
        { player: { id: secondPlayer.id, name: 'Kyle' }, response: 'UNSURE' },
        {
          player: { id: firstPlayer.id, name: 'Twiggy' },
          response: 'UNAVAILABLE',
        },
      ],
    });
  });

  it('rejects invalid responses and fixtures that are cancelled or in the past', async () => {
    const fixture = await createFixture();
    const player = await prisma.player.create({
      data: { description: '', name: 'Twiggy' },
    });
    const cookie = await createAccount('player@test.example', player.id);
    const app = createApp();

    const invalid = await request(app)
      .put(`/api/fixtures/${fixture.id}/availability`)
      .set('Cookie', cookie)
      .send({ response: 'YES' });
    expect(invalid.status).toBe(400);
    await prisma.fixture.update({
      data: { status: 'CANCELLED' },
      where: { id: fixture.id },
    });
    const cancelled = await request(app)
      .put(`/api/fixtures/${fixture.id}/availability`)
      .set('Cookie', cookie)
      .send({ response: 'AVAILABLE' });
    expect(cancelled.status).toBe(409);
    await prisma.fixture.update({
      data: {
        scheduledDate: new Date('2026-09-01T00:00:00.000Z'),
        status: 'SCHEDULED',
      },
      where: { id: fixture.id },
    });
    const past = await request(app)
      .put(`/api/fixtures/${fixture.id}/availability`)
      .set('Cookie', cookie)
      .send({ response: 'AVAILABLE' });
    expect(past.status).toBe(409);
    expect(await prisma.fixtureAvailability.count()).toBe(0);
  });
});
