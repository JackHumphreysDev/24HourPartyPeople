-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "PlayerPosition" AS ENUM ('GK', 'DEF', 'MID', 'FWD');

-- CreateEnum
CREATE TYPE "Competition" AS ENUM ('LEAGUE', 'CUP');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'PLAYED', 'WALKOVER');

-- CreateEnum
CREATE TYPE "FixtureSource" AS ENUM ('scrape', 'manual');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "playerId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "position" "PlayerPosition" NOT NULL,
    "isActiveSquad" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonStat" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "cleanSheets" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER,
    "note" TEXT,

    CONSTRAINT "PlayerSeasonStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentClub" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OpponentClub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "opponentClubId" UUID NOT NULL,
    "competition" "Competition" NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "scheduledTime" TIME(0),
    "venue" TEXT,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "FixtureSource" NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" UUID NOT NULL,
    "fixtureId" UUID,
    "seasonId" UUID NOT NULL,
    "competition" "Competition" NOT NULL,
    "datePlayed" DATE NOT NULL,
    "opponentClubId" UUID NOT NULL,
    "ourScore" INTEGER,
    "opponentScore" INTEGER,
    "isWalkover" BOOLEAN NOT NULL DEFAULT false,
    "walkoverReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonStanding" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "clubName" TEXT NOT NULL,
    "played" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "gf" INTEGER NOT NULL,
    "ga" INTEGER NOT NULL,
    "gd" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "walkoverGames" INTEGER NOT NULL DEFAULT 0,
    "scrapedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SeasonStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubHistory" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "gf" INTEGER NOT NULL,
    "ga" INTEGER NOT NULL,
    "gd" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "walkoverGames" INTEGER NOT NULL DEFAULT 0,
    "finalizedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ClubHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_playerId_key" ON "User"("playerId");

-- CreateIndex
CREATE INDEX "Player_isActiveSquad_position_idx" ON "Player"("isActiveSquad", "position");

-- CreateIndex
CREATE INDEX "Season_isCurrent_idx" ON "Season"("isCurrent");

-- CreateIndex
CREATE INDEX "PlayerSeasonStat_seasonId_idx" ON "PlayerSeasonStat"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStat_playerId_seasonId_key" ON "PlayerSeasonStat"("playerId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentClub_name_key" ON "OpponentClub"("name");

-- CreateIndex
CREATE INDEX "Fixture_seasonId_scheduledDate_idx" ON "Fixture"("seasonId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Fixture_status_scheduledDate_idx" ON "Fixture"("status", "scheduledDate");

-- CreateIndex
CREATE INDEX "Fixture_opponentClubId_idx" ON "Fixture"("opponentClubId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_fixtureId_key" ON "GameResult"("fixtureId");

-- CreateIndex
CREATE INDEX "GameResult_seasonId_datePlayed_idx" ON "GameResult"("seasonId", "datePlayed");

-- CreateIndex
CREATE INDEX "GameResult_opponentClubId_datePlayed_idx" ON "GameResult"("opponentClubId", "datePlayed");

-- CreateIndex
CREATE INDEX "SeasonStanding_seasonId_position_idx" ON "SeasonStanding"("seasonId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonStanding_seasonId_clubName_key" ON "SeasonStanding"("seasonId", "clubName");

-- CreateIndex
CREATE UNIQUE INDEX "ClubHistory_seasonId_key" ON "ClubHistory"("seasonId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonStat" ADD CONSTRAINT "PlayerSeasonStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonStat" ADD CONSTRAINT "PlayerSeasonStat_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_opponentClubId_fkey" FOREIGN KEY ("opponentClubId") REFERENCES "OpponentClub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_opponentClubId_fkey" FOREIGN KEY ("opponentClubId") REFERENCES "OpponentClub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubHistory" ADD CONSTRAINT "ClubHistory_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
