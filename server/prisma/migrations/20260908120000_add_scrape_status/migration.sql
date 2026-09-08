CREATE TABLE "ScrapeStatus" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptedAt" TIMESTAMPTZ(3),
    "lastSucceededAt" TIMESTAMPTZ(3),
    "lastError" TEXT,

    CONSTRAINT "ScrapeStatus_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScrapeStatus"
ADD CONSTRAINT "ScrapeStatus_singleton_check" CHECK ("id" = 1);
