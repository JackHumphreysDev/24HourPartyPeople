ALTER TABLE "Player"
ADD COLUMN "additionalPositions" "PlayerPosition"[] NOT NULL DEFAULT ARRAY[]::"PlayerPosition"[];
