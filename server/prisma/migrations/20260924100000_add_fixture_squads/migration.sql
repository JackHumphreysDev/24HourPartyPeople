CREATE TABLE "FixtureSquadEntry" (
    "id" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "position" "PlayerPosition",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureSquadEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FixtureSquadEntry_starter_position_check"
        CHECK (("isStarter" AND "position" IS NOT NULL) OR (NOT "isStarter" AND "position" IS NULL))
);

CREATE UNIQUE INDEX "FixtureSquadEntry_fixtureId_playerId_key"
ON "FixtureSquadEntry"("fixtureId", "playerId");

CREATE INDEX "FixtureSquadEntry_fixtureId_isStarter_position_idx"
ON "FixtureSquadEntry"("fixtureId", "isStarter", "position");

CREATE INDEX "FixtureSquadEntry_playerId_fixtureId_idx"
ON "FixtureSquadEntry"("playerId", "fixtureId");

ALTER TABLE "FixtureSquadEntry"
ADD CONSTRAINT "FixtureSquadEntry_fixtureId_fkey"
FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FixtureSquadEntry"
ADD CONSTRAINT "FixtureSquadEntry_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
