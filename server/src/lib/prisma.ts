import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

const localDatabaseUrl =
  'postgresql://party_people:party_people@localhost:5432/party_people';
const isProduction =
  process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required in production and should use the pooled Neon connection.',
  );
}

const connectionString = process.env.DATABASE_URL ?? localDatabaseUrl;

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
