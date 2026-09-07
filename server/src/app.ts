import cors from 'cors';
import express from 'express';

import { authRouter } from './auth/router.js';
import {
  adminFixturesRouter,
  publicFixturesRouter,
} from './fixtures/router.js';
import { adminGamesRouter, publicGamesRouter } from './games/router.js';
import { adminPlayersRouter, publicPlayersRouter } from './players/router.js';
import { adminSeasonsRouter } from './seasons/router.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      credentials: true,
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/fixtures', publicFixturesRouter);
  app.use('/api/games', publicGamesRouter);
  app.use('/api/players', publicPlayersRouter);
  app.use('/api/admin/fixtures', adminFixturesRouter);
  app.use('/api/admin/games', adminGamesRouter);
  app.use('/api/admin/players', adminPlayersRouter);
  app.use('/api/admin/seasons', adminSeasonsRouter);

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('Unhandled request error.', error);
      response.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong.',
        },
      });
    },
  );

  return app;
}
