import express from 'express';
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
import { requireAdmin, requireAuthentication } from '../src/auth/middleware.js';
import { hashPassword } from '../src/auth/password.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/auth/session.js';
import { prisma } from '../src/lib/prisma.js';

const setupKey = 'a-long-test-only-administrator-setup-key';
const originalSetupKey = process.env.ADMIN_SETUP_KEY;

async function clearAuthenticationData() {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

function registrationPayload() {
  return {
    name: ' Club Admin ',
    email: ' ADMIN@EXAMPLE.TEST ',
    password: 'correct horse battery staple',
    setupKey,
  };
}

beforeAll(async () => {
  process.env.ADMIN_SETUP_KEY = setupKey;
  await prisma.$connect();
});

beforeEach(clearAuthenticationData);
afterEach(clearAuthenticationData);

afterAll(async () => {
  if (originalSetupKey === undefined) {
    delete process.env.ADMIN_SETUP_KEY;
  } else {
    process.env.ADMIN_SETUP_KEY = originalSetupKey;
  }

  await prisma.$disconnect();
});

describe('authentication API', () => {
  it('creates the first account as an administrator and starts a secure session', async () => {
    const response = await request(createApp())
      .post('/api/auth/register')
      .send(registrationPayload());

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        name: 'Club Admin',
        email: 'admin@example.test',
        role: 'ADMIN',
      },
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const [sessionCookie] = response.headers['set-cookie'] ?? [];
    expect(sessionCookie).toBeDefined();
    if (!sessionCookie) {
      throw new Error(
        'The registration response did not set a session cookie.',
      );
    }

    expect(sessionCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Path=/');

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.test' },
    });
    expect(user.role).toBe('ADMIN');
    expect(user.passwordHash).not.toBe(registrationPayload().password);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    const cookieSeparator = sessionCookie.indexOf(';');
    const cookiePair =
      cookieSeparator === -1
        ? sessionCookie
        : sessionCookie.slice(0, cookieSeparator);
    const cookieToken = cookiePair.slice(`${SESSION_COOKIE_NAME}=`.length);
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session.tokenHash).not.toBe(cookieToken);
  });

  it('closes administrator registration after the first account', async () => {
    const app = createApp();

    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .send(registrationPayload())
      ).status,
    ).toBe(201);

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        ...registrationPayload(),
        email: 'second@example.test',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'REGISTRATION_CLOSED',
        message: 'Administrator setup has already been completed.',
      },
    });
    await expect(prisma.user.count()).resolves.toBe(1);
  });

  it('uses one generic failure for unknown emails and incorrect passwords', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');
    await prisma.user.create({
      data: {
        name: 'Club Admin',
        email: 'admin@example.test',
        passwordHash,
        role: 'ADMIN',
      },
    });

    const unknownUser = await request(createApp())
      .post('/api/auth/login')
      .send({
        email: 'missing@example.test',
        password: 'incorrect password',
      });
    const incorrectPassword = await request(createApp())
      .post('/api/auth/login')
      .send({
        email: 'ADMIN@EXAMPLE.TEST',
        password: 'incorrect password',
      });

    expect(unknownUser.status).toBe(401);
    expect(incorrectPassword.status).toBe(401);
    expect(unknownUser.body).toEqual(incorrectPassword.body);
    expect(unknownUser.body.error.code).toBe('INVALID_CREDENTIALS');

    const validLogin = await request(createApp()).post('/api/auth/login').send({
      email: ' ADMIN@EXAMPLE.TEST ',
      password: 'correct horse battery staple',
    });
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.user.email).toBe('admin@example.test');
  });

  it('restores the current user and revokes the session on logout', async () => {
    const agent = request.agent(createApp());
    const registration = await agent
      .post('/api/auth/register')
      .send(registrationPayload());
    expect(registration.status).toBe(201);

    const currentUser = await agent.get('/api/auth/me');
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user.email).toBe('admin@example.test');

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    await expect(prisma.session.count()).resolves.toBe(0);

    const signedOutUser = await agent.get('/api/auth/me');
    expect(signedOutUser.status).toBe(401);
    expect(signedOutUser.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });
});

describe('authorization middleware', () => {
  it('requires an authenticated administrator', async () => {
    const app = express();
    app.get(
      '/admin',
      requireAuthentication,
      requireAdmin,
      (_request, response) => response.status(200).json({ allowed: true }),
    );

    const anonymous = await request(app).get('/admin');
    expect(anonymous.status).toBe(401);

    const passwordHash = await hashPassword('correct horse battery staple');
    const player = await prisma.user.create({
      data: {
        name: 'Test Player',
        email: 'player@example.test',
        passwordHash,
        role: 'PLAYER',
      },
    });
    const playerToken = await createSession(player.id);
    const forbidden = await request(app)
      .get('/admin')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${playerToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('ADMIN_REQUIRED');

    const admin = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: 'another-admin@example.test',
        passwordHash,
        role: 'ADMIN',
      },
    });
    const adminToken = await createSession(admin.id);
    const allowed = await request(app)
      .get('/admin')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ allowed: true });
  });
});
