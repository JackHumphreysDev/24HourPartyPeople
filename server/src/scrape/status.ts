import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

type ScrapeStatusClient = Prisma.TransactionClient | typeof prisma;

export async function getScrapeStatus(
  client: ScrapeStatusClient = prisma,
  includeError = false,
) {
  const status = await client.scrapeStatus.findUnique({ where: { id: 1 } });
  const latestRefreshFailed = Boolean(
    status?.lastAttemptedAt &&
    (!status.lastSucceededAt ||
      status.lastAttemptedAt > status.lastSucceededAt),
  );

  return {
    lastAttemptedAt: status?.lastAttemptedAt ?? null,
    lastError: includeError ? (status?.lastError ?? null) : undefined,
    lastSucceededAt: status?.lastSucceededAt ?? null,
    latestRefreshFailed,
  };
}
