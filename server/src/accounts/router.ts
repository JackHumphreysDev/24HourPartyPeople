import { Router } from 'express';
import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { prisma } from '../lib/prisma.js';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);
const userIdSchema = z.uuid();
const accountUpdateSchema = z.object({
  currentPassword: passwordSchema,
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  newPassword: passwordSchema.nullable(),
});
const assignmentSchema = z.object({ playerId: z.uuid().nullable() });

const accountSelect = {
  createdAt: true,
  email: true,
  id: true,
  name: true,
  player: {
    select: { id: true, name: true },
  },
  requestedPlayer: {
    select: { id: true, name: true },
  },
  role: true,
} as const;

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

async function runSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (hasErrorCode(error, 'P2034') && attempt === 0) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('The account transaction could not be completed.');
}

export const adminAccountRouter = Router();
adminAccountRouter.use(requireAuthentication, requireAdmin);

adminAccountRouter.put('/', async (request, response) => {
  const parsed = accountUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_ACCOUNT',
        message:
          'Enter a valid name, email, current password, and optional new password.',
      },
    });
    return;
  }

  const currentUser = await prisma.user.findUnique({
    select: { passwordHash: true },
    where: { id: request.authUser!.id },
  });
  if (
    !currentUser ||
    !(await verifyPassword(
      parsed.data.currentPassword,
      currentUser.passwordHash,
    ))
  ) {
    response.status(403).json({
      error: {
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'The current password is incorrect.',
      },
    });
    return;
  }

  try {
    const user = await prisma.user.update({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        ...(parsed.data.newPassword
          ? { passwordHash: await hashPassword(parsed.data.newPassword) }
          : {}),
      },
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
    response.status(200).json({ user });
  } catch (error) {
    if (hasErrorCode(error, 'P2002')) {
      response.status(409).json({
        error: {
          code: 'EMAIL_UNAVAILABLE',
          message: 'That email address is already registered.',
        },
      });
      return;
    }
    throw error;
  }
});

export const adminAccountsRouter = Router();
adminAccountsRouter.use(requireAuthentication, requireAdmin);

adminAccountsRouter.get('/', async (_request, response) => {
  const [accounts, players] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: accountSelect,
      where: { role: 'PLAYER' },
    }),
    prisma.player.findMany({
      orderBy: [{ isActiveSquad: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        isActiveSquad: true,
        name: true,
        requestedBy: { select: { id: true } },
        user: { select: { id: true } },
      },
    }),
  ]);
  response.status(200).json({ accounts, players });
});

adminAccountsRouter.post('/:userId/approve', async (request, response) => {
  const userId = userIdSchema.safeParse(request.params.userId);
  if (!userId.success) {
    response.status(404).json({
      error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' },
    });
    return;
  }

  try {
    const account = await runSerializableTransaction(async (transaction) => {
      const user = await transaction.user.findFirst({
        select: { requestedPlayerId: true },
        where: { id: userId.data, role: 'PLAYER' },
      });
      if (!user?.requestedPlayerId) {
        return null;
      }
      const player = await transaction.player.findFirst({
        select: { id: true },
        where: {
          id: user.requestedPlayerId,
          user: null,
        },
      });
      if (!player) {
        return null;
      }
      return transaction.user.update({
        data: { playerId: player.id, requestedPlayerId: null },
        select: accountSelect,
        where: { id: userId.data },
      });
    });
    if (!account) {
      response.status(409).json({
        error: {
          code: 'CLAIM_UNAVAILABLE',
          message: 'That pending player claim is no longer available.',
        },
      });
      return;
    }
    response.status(200).json({ account });
  } catch (error) {
    if (hasErrorCode(error, 'P2002') || hasErrorCode(error, 'P2034')) {
      response.status(409).json({
        error: {
          code: 'CLAIM_UNAVAILABLE',
          message: 'That pending player claim is no longer available.',
        },
      });
      return;
    }
    throw error;
  }
});

adminAccountsRouter.post('/:userId/reject', async (request, response) => {
  const userId = userIdSchema.safeParse(request.params.userId);
  if (!userId.success) {
    response.status(404).json({
      error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' },
    });
    return;
  }
  const result = await prisma.user.updateMany({
    data: { requestedPlayerId: null },
    where: {
      id: userId.data,
      requestedPlayerId: { not: null },
      role: 'PLAYER',
    },
  });
  if (result.count === 0) {
    response.status(404).json({
      error: { code: 'CLAIM_NOT_FOUND', message: 'Pending claim not found.' },
    });
    return;
  }
  response.status(204).send();
});

adminAccountsRouter.put('/:userId/player', async (request, response) => {
  const userId = userIdSchema.safeParse(request.params.userId);
  const assignment = assignmentSchema.safeParse(request.body);
  if (!userId.success || !assignment.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Select a valid account and player.',
      },
    });
    return;
  }

  try {
    const account = await runSerializableTransaction(async (transaction) => {
      const user = await transaction.user.findFirst({
        select: { id: true },
        where: { id: userId.data, role: 'PLAYER' },
      });
      if (!user) {
        return null;
      }
      if (assignment.data.playerId) {
        const player = await transaction.player.findFirst({
          select: { id: true },
          where: {
            AND: [
              { OR: [{ requestedBy: null }, { requestedBy: { id: user.id } }] },
              { OR: [{ user: null }, { user: { id: user.id } }] },
            ],
            id: assignment.data.playerId,
          },
        });
        if (!player) {
          throw new Error('PLAYER_UNAVAILABLE');
        }
      }
      return transaction.user.update({
        data: {
          playerId: assignment.data.playerId,
          requestedPlayerId: null,
        },
        select: accountSelect,
        where: { id: user.id },
      });
    });
    if (!account) {
      response.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' },
      });
      return;
    }
    response.status(200).json({ account });
  } catch (error) {
    if (
      (error instanceof Error && error.message === 'PLAYER_UNAVAILABLE') ||
      hasErrorCode(error, 'P2002') ||
      hasErrorCode(error, 'P2034')
    ) {
      response.status(409).json({
        error: {
          code: 'PLAYER_UNAVAILABLE',
          message:
            'That player profile is already assigned or awaiting approval.',
        },
      });
      return;
    }
    throw error;
  }
});
