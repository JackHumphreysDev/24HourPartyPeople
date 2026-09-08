import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/auth/session.js';
import { prisma } from '../src/lib/prisma.js';

const DEFAULT_DESCRIPTION =
  'The home of 24 Hour Party People—bringing the squad, statistics, fixtures, results, and club history together.';

async function resetTeamProfile() {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teamProfile.upsert({
    create: { id: 1, description: DEFAULT_DESCRIPTION },
    update: { description: DEFAULT_DESCRIPTION },
    where: { id: 1 },
  });
}

async function createUserSession(role: 'ADMIN' | 'PLAYER') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}@team-profile.test`,
      name: `Team profile ${role}`,
      passwordHash: 'not-used-by-this-test',
      role,
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(resetTeamProfile);

afterAll(async () => {
  await resetTeamProfile();
  await prisma.$disconnect();
});

describe('public team profile API', () => {
  it('returns the team description', async () => {
    const response = await request(createApp()).get('/api/team-profile');

    expect(response.status).toBe(200);
    expect(response.body.teamProfile).toMatchObject({
      description: DEFAULT_DESCRIPTION,
      updatedAt: expect.any(String),
    });
  });
});

describe('administrator team profile API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app).put('/api/admin/team-profile');
    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const player = await request(app)
      .get('/api/admin/team-profile')
      .set('Cookie', playerCookie);
    expect(player.status).toBe(403);
  });

  it('updates and trims the public team description', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();

    const updated = await request(app)
      .put('/api/admin/team-profile')
      .set('Cookie', adminCookie)
      .send({ description: '  Sheffield football since 2016.  ' });

    expect(updated.status).toBe(200);
    expect(updated.body.teamProfile.description).toBe(
      'Sheffield football since 2016.',
    );

    const publicResponse = await request(app).get('/api/team-profile');
    expect(publicResponse.body.teamProfile.description).toBe(
      'Sheffield football since 2016.',
    );
  });

  it('rejects an empty description', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const response = await request(createApp())
      .put('/api/admin/team-profile')
      .set('Cookie', adminCookie)
      .send({ description: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_TEAM_PROFILE');
  });
});
