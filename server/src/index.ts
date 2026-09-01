import 'dotenv/config';

import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

function shutDown(signal: NodeJS.Signals) {
  console.log(`${signal} received; closing HTTP server.`);
  server.close((error) => {
    if (error) {
      console.error('Failed to close HTTP server cleanly.', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
