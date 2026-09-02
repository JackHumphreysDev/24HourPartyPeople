import cors from 'cors';
import express from 'express';

import { authRouter } from './auth/router.js';

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
