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
  limit: 10,
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

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

class RegistrationClosedError extends Error {}

function safeUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
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

export const authRouter = Router();

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

authRouter.get('/me', requireAuthentication, (request, response) => {
  response.status(200).json({ user: safeUser(request.authUser!) });
});
