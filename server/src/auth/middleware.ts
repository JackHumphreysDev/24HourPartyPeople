import type { NextFunction, Request, Response } from 'express';

import { getSessionToken, getUserForSession } from './session.js';

export async function requireAuthentication(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getUserForSession(getSessionToken(request));

    if (!user) {
      response.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.',
        },
      });
      return;
    }

    request.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (request.authUser?.role !== 'ADMIN') {
    response.status(403).json({
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Administrator access is required.',
      },
    });
    return;
  }

  next();
}
