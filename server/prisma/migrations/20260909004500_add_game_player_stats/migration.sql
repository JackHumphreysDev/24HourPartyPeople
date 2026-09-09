ALTER TABLE "Player"
ALTER COLUMN "position" DROP NOT NULL;

CREATE TABLE "GamePlayerStat" (
    "id" UUID NOT NULL,
    "gameResultId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GamePlayerStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GamePlayerStat_gameResultId_playerId_key"
ON "GamePlayerStat"("gameResultId", "playerId");

CREATE INDEX "GamePlayerStat_playerId_gameResultId_idx"
ON "GamePlayerStat"("playerId", "gameResultId");

ALTER TABLE "GamePlayerStat"
ADD CONSTRAINT "GamePlayerStat_gameResultId_fkey"
FOREIGN KEY ("gameResultId") REFERENCES "GameResult"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GamePlayerStat"
ADD CONSTRAINT "GamePlayerStat_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
