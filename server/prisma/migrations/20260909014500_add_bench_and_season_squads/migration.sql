ALTER TABLE "Player"
ADD COLUMN "isOnBench" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Season"
ADD COLUMN "isClubHistoryEligible" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Season"
SET "isClubHistoryEligible" = "isCurrent";

CREATE TABLE "SeasonSquadEntry" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "position" "PlayerPosition" NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SeasonSquadEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonSquadEntry_seasonId_playerId_key"
ON "SeasonSquadEntry"("seasonId", "playerId");

CREATE INDEX "SeasonSquadEntry_seasonId_isStarter_position_idx"
ON "SeasonSquadEntry"("seasonId", "isStarter", "position");

CREATE INDEX "SeasonSquadEntry_playerId_idx"
ON "SeasonSquadEntry"("playerId");

ALTER TABLE "SeasonSquadEntry"
ADD CONSTRAINT "SeasonSquadEntry_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeasonSquadEntry"
ADD CONSTRAINT "SeasonSquadEntry_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
