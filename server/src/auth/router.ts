import { createHash, timingSafeEqual } from 'node:crypto';

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { requireAuthentication } from './middleware.js';
import {
  hashPassword,
  verifyDummyPassword,
  verifyPassword,
} from './password.js';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionToken,
  setSessionCookie,
} from './session.js';
import type { AuthenticatedUser } from './types.js';

const authRateLimiter = rateLimit({
  handler: (_request, response) => {
    response.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many authentication attempts. Try again later.',
      },
    });
  },
  legacyHeaders: false,
  limit: process.env.NODE_ENV === 'test' ? 1_000 : 10,
  standardHeaders: 'draft-8',
  windowMs: 15 * 60 * 1000,
});

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
  setupKey: z.string().min(1),
});

const playerRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
  playerId: z.uuid(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
const playerRequestSchema = z.object({ playerId: z.uuid() });

class RegistrationClosedError extends Error {}
class PlayerRegistrationUnavailableError extends Error {}
class PlayerUnavailableError extends Error {}

function safeUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    playerId: user.playerId,
    requestedPlayerId: user.requestedPlayerId,
    role: user.role,
  };
}

function secretMatches(candidate: string, expected: string): boolean {
  const candidateHash = createHash('sha256').update(candidate).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

async function createFirstAdmin(data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AuthenticatedUser> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          if ((await transaction.user.count()) > 0) {
            throw new RegistrationClosedError();
          }

          return transaction.user.create({
            data: {
              ...data,
              role: 'ADMIN',
            },
            select: {
              id: true,
              name: true,
              email: true,
              playerId: true,
              requestedPlayerId: true,
              role: true,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (hasErrorCode(error, 'P2034') && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new RegistrationClosedError();
}

async function createPlayerUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  playerId: string;
}): Promise<AuthenticatedUser> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          if (
            (await transaction.user.count({ where: { role: 'ADMIN' } })) === 0
          ) {
            throw new PlayerRegistrationUnavailableError();
          }
          const player = await transaction.player.findFirst({
            select: { id: true },
            where: {
              id: data.playerId,
              isActiveSquad: true,
              requestedBy: null,
              user: null,
            },
          });
          if (!player) {
            throw new PlayerUnavailableError();
          }

          return transaction.user.create({
            data: {
              email: data.email,
              name: data.name,
              passwordHash: data.passwordHash,
              requestedPlayerId: player.id,
              role: 'PLAYER',
            },
            select: {
              email: true,
              id: true,
              name: true,
              playerId: true,
              requestedPlayerId: true,
              role: true,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (hasErrorCode(error, 'P2034') && attempt === 0) {
        continue;
      }
      throw error;
    }
  }

  throw new PlayerUnavailableError();
}

export const authRouter = Router();

authRouter.get('/player-registration-options', async (_request, response) => {
  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, position: true },
    where: {
      isActiveSquad: true,
      requestedBy: null,
      user: null,
    },
  });
  response.status(200).json({ players });
});

authRouter.post(
  '/player-register',
  authRateLimiter,
  async (request, response) => {
    const parsed = playerRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Enter a valid name, email, password, and player profile.',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    try {
      const user = await createPlayerUser({
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        playerId: parsed.data.playerId,
      });
      const token = await createSession(user.id);
      setSessionCookie(response, token);
      response.status(201).json({ user: safeUser(user) });
    } catch (error) {
      if (error instanceof PlayerRegistrationUnavailableError) {
        response.status(503).json({
          error: {
            code: 'PLAYER_REGISTRATION_UNAVAILABLE',
            message: 'Player registration is not available yet.',
          },
        });
        return;
      }
      if (
        error instanceof PlayerUnavailableError ||
        hasErrorCode(error, 'P2002') ||
        hasErrorCode(error, 'P2034')
      ) {
        response.status(409).json({
          error: {
            code: 'ACCOUNT_OR_PLAYER_UNAVAILABLE',
            message:
              'That email or player profile is already registered or awaiting approval.',
          },
        });
        return;
      }
      throw error;
    }
  },
);

authRouter.post('/register', authRateLimiter, async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Enter a valid name, email, password, and setup key.',
      },
    });
    return;
  }

  const setupKey = process.env.ADMIN_SETUP_KEY;
  if (!setupKey) {
    response.status(503).json({
      error: {
        code: 'SETUP_NOT_CONFIGURED',
        message: 'Administrator setup is not configured.',
      },
    });
    return;
  }

  if (!secretMatches(parsed.data.setupKey, setupKey)) {
    response.status(403).json({
      error: {
        code: 'INVALID_SETUP_KEY',
        message: 'The administrator setup key is invalid.',
      },
    });
    return;
  }

  if ((await prisma.user.count()) > 0) {
    response.status(409).json({
      error: {
        code: 'REGISTRATION_CLOSED',
        message: 'Administrator setup has already been completed.',
      },
    });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await createFirstAdmin({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    });
    const token = await createSession(user.id);
    setSessionCookie(response, token);
    response.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (
      error instanceof RegistrationClosedError ||
      hasErrorCode(error, 'P2002') ||
      hasErrorCode(error, 'P2034')
    ) {
      response.status(409).json({
        error: {
          code: 'REGISTRATION_CLOSED',
          message: 'Administrator setup has already been completed.',
        },
      });
      return;
    }

    throw error;
  }
});

authRouter.post('/login', authRateLimiter, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Enter a valid email and password.',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      name: true,
      email: true,
      playerId: true,
      requestedPlayerId: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) {
    await verifyDummyPassword(parsed.data.password);
  }

  const passwordIsValid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : false;

  if (!user || !passwordIsValid) {
    response.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password is incorrect.',
      },
    });
    return;
  }

  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      expiresAt: { lte: new Date() },
    },
  });

  const token = await createSession(user.id);
  setSessionCookie(response, token);
  response.status(200).json({ user: safeUser(user) });
});

authRouter.post('/logout', async (request, response) => {
  await deleteSession(getSessionToken(request));
  clearSessionCookie(response);
  response.status(204).send();
});

authRouter.put(
  '/me/player-request',
  requireAuthentication,
  async (request, response) => {
    const parsed = playerRequestSchema.safeParse(request.body);
    if (!parsed.success || request.authUser!.role !== 'PLAYER') {
      response.status(400).json({
        error: {
          code: 'INVALID_PLAYER_REQUEST',
          message: 'Select a valid available Player profile.',
        },
      });
      return;
    }
    if (request.authUser!.playerId) {
      response.status(409).json({
        error: {
          code: 'PLAYER_ALREADY_LINKED',
          message: 'This account is already linked to a Player profile.',
        },
      });
      return;
    }

    try {
      const user = await prisma.$transaction(
        async (transaction) => {
          const player = await transaction.player.findFirst({
            select: { id: true },
            where: {
              id: parsed.data.playerId,
              isActiveSquad: true,
              requestedBy: null,
              user: null,
            },
          });
          if (!player) throw new PlayerUnavailableError();
          return transaction.user.update({
            data: { requestedPlayerId: player.id },
            select: {
              email: true,
              id: true,
              name: true,
              playerId: true,
              requestedPlayerId: true,
              role: true,
            },
            where: { id: request.authUser!.id },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      response.status(200).json({ user: safeUser(user) });
    } catch (error) {
      if (
        error instanceof PlayerUnavailableError ||
        hasErrorCode(error, 'P2002') ||
        hasErrorCode(error, 'P2034')
      ) {
        response.status(409).json({
          error: {
            code: 'PLAYER_UNAVAILABLE',
            message: 'That Player profile is no longer available.',
          },
        });
        return;
      }
      throw error;
    }
  },
);

authRouter.get('/me', requireAuthentication, (request, response) => {
  response.status(200).json({ user: safeUser(request.authUser!) });
});
