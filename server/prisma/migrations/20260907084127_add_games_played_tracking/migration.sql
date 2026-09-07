-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "tracksGamesPlayed" BOOLEAN NOT NULL DEFAULT false;

-- Existing current-season records belong to the games-played tracking era.
UPDATE "Season" SET "tracksGamesPlayed" = true WHERE "isCurrent" = true;
