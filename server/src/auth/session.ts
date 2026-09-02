import { createHash, randomBytes } from 'node:crypto';

import type { Request, Response } from 'express';

import { prisma } from '../lib/prisma.js';
import type { AuthenticatedUser } from './types.js';

export const SESSION_COOKIE_NAME = 'party_people_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = part.slice(0, separatorIndex).trim();
    if (cookieName === name) {
      return part.slice(separatorIndex + 1).trim() || null;
    }
  }

  return null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_DURATION_MS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });

  return token;
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(response: Response): void {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  response.clearCookie(SESSION_COOKIE_NAME, options);
}

export function getSessionToken(request: Request): string | null {
  return readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
}

export async function deleteSession(token: string | null): Promise<void> {
  if (!token) {
    return;
  }

  await prisma.session.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}

export async function getUserForSession(
  token: string | null,
): Promise<AuthenticatedUser | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}
