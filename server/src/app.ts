import cors from 'cors';
import express from 'express';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  return app;
}
