import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const localDatabaseUrl =
  'postgresql://party_people:party_people@localhost:5432/party_people';

const migrationDatabaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

if (
  (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') &&
  !migrationDatabaseUrl
) {
  throw new Error(
    'A direct database connection is required for production migrations. Set DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrationDatabaseUrl ?? localDatabaseUrl,
  },
});
