import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/auth/session.js';
import { prisma } from '../src/lib/prisma.js';

const password = 'correct horse battery staple';

async function clearDatabase() {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
}

async function createUser(
  role: 'ADMIN' | 'PLAYER',
  email: string,
  data: { playerId?: string; requestedPlayerId?: string } = {},
) {
  const user = await prisma.user.create({
    data: {
      ...data,
      email,
      name: role === 'ADMIN' ? 'Jack' : email.split('@')[0]!,
      passwordHash: await hashPassword(password),
      role,
    },
  });
  const token = await createSession(user.id);
  return { cookie: `${SESSION_COOKIE_NAME}=${token}`, user };
}

async function createPlayer(name: string, position: 'GK' | 'DEF') {
  return prisma.player.create({
    data: { description: `${name} profile.`, name, position },
  });
}

beforeAll(async () => {
  await prisma.$connect();
});
afterEach(clearDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('player account administration', () => {
  it('approves and rejects pending Player profile requests', async () => {
    const firstPlayer = await createPlayer('Gary Gloves', 'GK');
    const secondPlayer = await createPlayer('Dan Defence', 'DEF');
    const admin = await createUser('ADMIN', 'admin@example.test');
    const firstAccount = await createUser('PLAYER', 'first@example.test', {
      requestedPlayerId: firstPlayer.id,
    });
    const secondAccount = await createUser('PLAYER', 'second@example.test', {
      requestedPlayerId: secondPlayer.id,
    });

    const listing = await request(createApp())
      .get('/api/admin/accounts')
      .set('Cookie', admin.cookie);
    expect(listing.status).toBe(200);
    expect(listing.body.accounts).toHaveLength(2);
    expect(listing.body.accounts[0].requestedPlayer).toEqual({
      id: firstPlayer.id,
      name: firstPlayer.name,
    });

    const approved = await request(createApp())
      .post(`/api/admin/accounts/${firstAccount.user.id}/approve`)
      .set('Cookie', admin.cookie);
    expect(approved.status).toBe(200);
    expect(approved.body.account.player.id).toBe(firstPlayer.id);
    expect(approved.body.account.requestedPlayer).toBeNull();

    const rejected = await request(createApp())
      .post(`/api/admin/accounts/${secondAccount.user.id}/reject`)
      .set('Cookie', admin.cookie);
    expect(rejected.status).toBe(204);
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: secondAccount.user.id } }),
    ).resolves.toMatchObject({ playerId: null, requestedPlayerId: null });
  });

  it('allows manual assignment and prevents profiles being shared', async () => {
    const player = await createPlayer('Gary Gloves', 'GK');
    const admin = await createUser('ADMIN', 'admin@example.test');
    const firstAccount = await createUser('PLAYER', 'first@example.test');
    const secondAccount = await createUser('PLAYER', 'second@example.test');

    const assigned = await request(createApp())
      .put(`/api/admin/accounts/${firstAccount.user.id}/player`)
      .set('Cookie', admin.cookie)
      .send({ playerId: player.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.account.player.id).toBe(player.id);

    const duplicate = await request(createApp())
      .put(`/api/admin/accounts/${secondAccount.user.id}/player`)
      .set('Cookie', admin.cookie)
      .send({ playerId: player.id });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('PLAYER_UNAVAILABLE');

    const unassigned = await request(createApp())
      .put(`/api/admin/accounts/${firstAccount.user.id}/player`)
      .set('Cookie', admin.cookie)
      .send({ playerId: null });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.account.player).toBeNull();
  });

  it('requires administrator access for account management', async () => {
    const playerAccount = await createUser('PLAYER', 'player@example.test');
    const response = await request(createApp())
      .get('/api/admin/accounts')
      .set('Cookie', playerAccount.cookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ADMIN_REQUIRED');
  });
});

describe('administrator account settings', () => {
  it('updates the administrator email and password after password confirmation', async () => {
    const admin = await createUser('ADMIN', 'old@example.test');
    const invalid = await request(createApp())
      .put('/api/admin/account')
      .set('Cookie', admin.cookie)
      .send({
        currentPassword: 'incorrect password',
        email: 'owner.new@example.test',
        name: 'Jack Humphreys',
        newPassword: null,
      });
    expect(invalid.status).toBe(403);

    const updated = await request(createApp())
      .put('/api/admin/account')
      .set('Cookie', admin.cookie)
      .send({
        currentPassword: password,
        email: 'owner.new@example.test',
        name: 'Jack Humphreys',
        newPassword: 'a newly changed secure password',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({
      email: 'owner.new@example.test',
      name: 'Jack Humphreys',
      role: 'ADMIN',
    });

    const login = await request(createApp()).post('/api/auth/login').send({
      email: 'owner.new@example.test',
      password: 'a newly changed secure password',
    });
    expect(login.status).toBe(200);
  });
});
