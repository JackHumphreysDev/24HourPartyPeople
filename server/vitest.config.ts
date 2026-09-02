import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'html'],
    },
    environment: 'node',
    env: {
      DATABASE_URL:
        'postgresql://party_people_test:party_people_test@localhost:55432/party_people_test',
    },
    fileParallelism: false,
  },
});
