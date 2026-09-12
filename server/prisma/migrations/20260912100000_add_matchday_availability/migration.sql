ALTER TYPE "FixtureStatus" ADD VALUE 'CANCELLED';

CREATE TYPE "AvailabilityResponse" AS ENUM ('AVAILABLE', 'UNSURE', 'UNAVAILABLE');

CREATE TABLE "FixtureAvailability" (
    "id" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "response" "AvailabilityResponse" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "FixtureAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FixtureAvailability_fixtureId_playerId_key" ON "FixtureAvailability"("fixtureId", "playerId");
CREATE INDEX "FixtureAvailability_playerId_fixtureId_idx" ON "FixtureAvailability"("playerId", "fixtureId");

ALTER TABLE "FixtureAvailability" ADD CONSTRAINT "FixtureAvailability_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FixtureAvailability" ADD CONSTRAINT "FixtureAvailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
