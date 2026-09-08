CREATE TABLE "TeamProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeamProfile_singleton" CHECK ("id" = 1)
);

INSERT INTO "TeamProfile" ("description")
VALUES ('The home of 24 Hour Party People—bringing the squad, statistics, fixtures, results, and club history together.');
