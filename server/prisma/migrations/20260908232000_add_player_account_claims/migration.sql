ALTER TABLE "User"
ADD COLUMN "requestedPlayerId" UUID;

CREATE UNIQUE INDEX "User_requestedPlayerId_key"
ON "User"("requestedPlayerId");

ALTER TABLE "User"
ADD CONSTRAINT "User_requestedPlayerId_fkey"
FOREIGN KEY ("requestedPlayerId") REFERENCES "Player"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
