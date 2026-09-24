-- Preserve the completed Summer 2026 league before switching the scraper to
-- Autumn 2026. The values below were verified against the two supplied live
-- Powerleague pages on 24 September 2026.

UPDATE "Season"
SET "isCurrent" = false;

UPDATE "Season"
SET "endDate" = DATE '2026-09-15'
WHERE LOWER("name") = 'summer 2026';

DELETE FROM "SeasonStanding"
WHERE "seasonId" = (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'summer 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
);

INSERT INTO "SeasonStanding" (
    "id", "seasonId", "position", "clubName", "played", "won", "drawn",
    "lost", "gf", "ga", "gd", "points", "walkoverGames", "scrapedAt"
)
SELECT
    snapshot."id"::uuid,
    season."id",
    snapshot."position",
    snapshot."clubName",
    snapshot."played",
    snapshot."won",
    snapshot."drawn",
    snapshot."lost",
    snapshot."gf",
    snapshot."ga",
    snapshot."gd",
    snapshot."points",
    0,
    TIMESTAMPTZ '2026-09-24 12:00:00+00'
FROM (
    VALUES
        ('a0260915-2000-4000-8000-000000000001', 1, 'Maradonner Kebab', 18, 15, 0, 3, 69, 15, 54, 45),
        ('a0260915-2000-4000-8000-000000000002', 2, '24 Hour Party People', 18, 14, 0, 4, 55, 16, 39, 42),
        ('a0260915-2000-4000-8000-000000000003', 3, 'Chaps on Tap FC', 18, 12, 0, 6, 57, 33, 24, 36),
        ('a0260915-2000-4000-8000-000000000004', 4, 'Work In Morning FC', 18, 10, 1, 7, 49, 47, 2, 31),
        ('a0260915-2000-4000-8000-000000000005', 5, 'JimRobs FC', 18, 9, 1, 8, 52, 29, 23, 28),
        ('a0260915-2000-4000-8000-000000000006', 6, 'JamJars United', 18, 9, 1, 8, 40, 48, -8, 28),
        ('a0260915-2000-4000-8000-000000000007', 7, '99Problems But A Pitch Aint 1', 18, 9, 0, 9, 49, 42, 7, 27),
        ('a0260915-2000-4000-8000-000000000008', 8, 'Porter Saint Germain', 18, 5, 2, 11, 33, 53, -20, 17),
        ('a0260915-2000-4000-8000-000000000009', 9, 'Still No Chansiri', 15, 2, 1, 12, 17, 58, -41, 7),
        ('a0260915-2000-4000-8000-000000000010', 10, 'Plover fc', 18, 1, 2, 15, 26, 91, -65, 5)
) AS snapshot(
    "id", "position", "clubName", "played", "won", "drawn", "lost",
    "gf", "ga", "gd", "points"
)
CROSS JOIN LATERAL (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'summer 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
) AS season;

UPDATE "ClubHistory"
SET "position" = 2,
    "played" = 18,
    "won" = 14,
    "drawn" = 0,
    "lost" = 4,
    "gf" = 55,
    "ga" = 16,
    "gd" = 39,
    "points" = 42,
    "walkoverGames" = 0
WHERE "seasonId" = (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'summer 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
);

INSERT INTO "OpponentClub" ("id", "name")
VALUES ('a0260915-1000-4000-8000-000000000001', 'JamJars United')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Fixture" (
    "id", "seasonId", "opponentClubId", "competition", "scheduledDate",
    "scheduledTime", "venue", "status", "source"
)
SELECT
    'a0260915-3000-4000-8000-000000000001'::uuid,
    season."id",
    opponent."id",
    'LEAGUE'::"Competition",
    DATE '2026-09-15',
    NULL,
    NULL,
    'PLAYED'::"FixtureStatus",
    'scrape'::"FixtureSource"
FROM (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'summer 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
) AS season
CROSS JOIN LATERAL (
    SELECT "id" FROM "OpponentClub"
    WHERE LOWER("name") = LOWER('JamJars United')
    ORDER BY "id"
    LIMIT 1
) AS opponent
WHERE NOT EXISTS (
    SELECT 1 FROM "Fixture"
    WHERE "seasonId" = season."id"
      AND "opponentClubId" = opponent."id"
      AND "competition" = 'LEAGUE'
      AND "scheduledDate" = DATE '2026-09-15'
);

UPDATE "Fixture"
SET "status" = 'PLAYED'
WHERE "seasonId" = (
        SELECT "id" FROM "Season"
        WHERE LOWER("name") = 'summer 2026'
        ORDER BY "startDate" DESC
        LIMIT 1
    )
  AND "opponentClubId" IN (
        SELECT "id" FROM "OpponentClub"
        WHERE LOWER("name") = LOWER('JamJars United')
    )
  AND "competition" = 'LEAGUE'
  AND "scheduledDate" = DATE '2026-09-15';

INSERT INTO "GameResult" (
    "id", "fixtureId", "seasonId", "competition", "datePlayed",
    "opponentClubId", "ourScore", "opponentScore", "isWalkover"
)
SELECT
    'a0260915-4000-4000-8000-000000000001'::uuid,
    fixture."id",
    fixture."seasonId",
    'LEAGUE'::"Competition",
    DATE '2026-09-15',
    fixture."opponentClubId",
    1,
    2,
    false
FROM "Fixture" AS fixture
JOIN "OpponentClub" AS opponent ON opponent."id" = fixture."opponentClubId"
JOIN "Season" AS season ON season."id" = fixture."seasonId"
WHERE LOWER(season."name") = 'summer 2026'
  AND LOWER(opponent."name") = LOWER('JamJars United')
  AND fixture."competition" = 'LEAGUE'
  AND fixture."scheduledDate" = DATE '2026-09-15'
  AND NOT EXISTS (
      SELECT 1 FROM "GameResult"
      WHERE "seasonId" = fixture."seasonId"
        AND "opponentClubId" = fixture."opponentClubId"
        AND "competition" = 'LEAGUE'
        AND "datePlayed" = DATE '2026-09-15'
  )
LIMIT 1;

UPDATE "GameResult"
SET "ourScore" = 1,
    "opponentScore" = 2,
    "isWalkover" = false,
    "walkoverReason" = NULL
WHERE "seasonId" = (
        SELECT "id" FROM "Season"
        WHERE LOWER("name") = 'summer 2026'
        ORDER BY "startDate" DESC
        LIMIT 1
    )
  AND "opponentClubId" IN (
        SELECT "id" FROM "OpponentClub"
        WHERE LOWER("name") = LOWER('JamJars United')
    )
  AND "competition" = 'LEAGUE'
  AND "datePlayed" = DATE '2026-09-15';

INSERT INTO "Season" (
    "id", "name", "startDate", "endDate", "isCurrent",
    "tracksGamesPlayed", "isClubHistoryEligible"
)
SELECT
    'a0260922-0000-4000-8000-000000000001'::uuid,
    'Autumn 2026',
    DATE '2026-09-22',
    DATE '2026-12-22',
    true,
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM "Season" WHERE LOWER("name") = 'autumn 2026'
);

UPDATE "Season"
SET "startDate" = DATE '2026-09-22',
    "endDate" = DATE '2026-12-22',
    "isCurrent" = CASE
        WHEN "id" = (
            SELECT "id" FROM "Season"
            WHERE LOWER("name") = 'autumn 2026'
            ORDER BY "startDate" DESC
            LIMIT 1
        ) THEN true
        ELSE false
    END,
    "tracksGamesPlayed" = true,
    "isClubHistoryEligible" = true
WHERE LOWER("name") = 'autumn 2026';

DELETE FROM "SeasonStanding"
WHERE "seasonId" = (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'autumn 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
);

INSERT INTO "SeasonStanding" (
    "id", "seasonId", "position", "clubName", "played", "won", "drawn",
    "lost", "gf", "ga", "gd", "points", "walkoverGames", "scrapedAt"
)
SELECT
    snapshot."id"::uuid,
    season."id",
    snapshot."position",
    snapshot."clubName",
    snapshot."played",
    snapshot."won",
    snapshot."drawn",
    snapshot."lost",
    snapshot."gf",
    snapshot."ga",
    snapshot."gd",
    snapshot."points",
    0,
    TIMESTAMPTZ '2026-09-24 12:00:00+00'
FROM (
    VALUES
        ('a0260922-2000-4000-8000-000000000001', 1, 'Maradonner Kebab', 1, 1, 0, 0, 7, 0, 7, 3),
        ('a0260922-2000-4000-8000-000000000002', 2, 'Chaps on Tap FC', 1, 1, 0, 0, 5, 0, 5, 3),
        ('a0260922-2000-4000-8000-000000000003', 3, '99Problems But A Pitch Aint 1', 1, 1, 0, 0, 5, 0, 5, 3),
        ('a0260922-2000-4000-8000-000000000004', 4, 'Declan Crooks FC', 1, 1, 0, 0, 1, 0, 1, 3),
        ('a0260922-2000-4000-8000-000000000005', 5, '24 Hour Party People', 1, 0, 0, 1, 0, 1, -1, 0),
        ('a0260922-2000-4000-8000-000000000006', 6, 'Still No Chansiri', 1, 0, 0, 1, 0, 5, -5, 0),
        ('a0260922-2000-4000-8000-000000000007', 7, 'Plover fc', 1, 0, 0, 1, 0, 5, -5, 0),
        ('a0260922-2000-4000-8000-000000000008', 8, 'Work In Morning FC', 1, 0, 0, 1, 0, 7, -7, 0)
) AS snapshot(
    "id", "position", "clubName", "played", "won", "drawn", "lost",
    "gf", "ga", "gd", "points"
)
CROSS JOIN LATERAL (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'autumn 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
) AS season;

INSERT INTO "OpponentClub" ("id", "name")
VALUES
    ('a0260922-1000-4000-8000-000000000001', 'Maradonner Kebab'),
    ('a0260922-1000-4000-8000-000000000002', 'Chaps on Tap FC'),
    ('a0260922-1000-4000-8000-000000000003', '99Problems But A Pitch Aint 1'),
    ('a0260922-1000-4000-8000-000000000004', 'Declan Crooks FC'),
    ('a0260922-1000-4000-8000-000000000005', 'Still No Chansiri'),
    ('a0260922-1000-4000-8000-000000000006', 'Plover fc'),
    ('a0260922-1000-4000-8000-000000000007', 'Work In Morning FC')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Fixture" (
    "id", "seasonId", "opponentClubId", "competition", "scheduledDate",
    "scheduledTime", "venue", "status", "source"
)
SELECT
    fixture."id"::uuid,
    season."id",
    opponent."id",
    'LEAGUE'::"Competition",
    fixture."scheduledDate"::date,
    fixture."scheduledTime"::time,
    fixture."venue",
    'SCHEDULED'::"FixtureStatus",
    'scrape'::"FixtureSource"
FROM (
    VALUES
        ('a0260922-3000-4000-8000-000000000001', 'Work In Morning FC', '2026-09-29', '19:00', 'Pitch 2'),
        ('a0260922-3000-4000-8000-000000000002', 'Plover fc', '2026-10-06', '19:00', 'Pitch 2'),
        ('a0260922-3000-4000-8000-000000000003', 'Still No Chansiri', '2026-10-13', '19:40', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000004', 'Chaps on Tap FC', '2026-10-20', '19:00', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000005', '99Problems But A Pitch Aint 1', '2026-10-27', '19:00', 'Pitch 2'),
        ('a0260922-3000-4000-8000-000000000006', 'Maradonner Kebab', '2026-11-03', '19:00', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000007', 'Declan Crooks FC', '2026-11-10', '19:00', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000008', 'Work In Morning FC', '2026-11-17', '19:00', 'Pitch 2'),
        ('a0260922-3000-4000-8000-000000000009', 'Plover fc', '2026-11-24', '19:00', 'Pitch 2'),
        ('a0260922-3000-4000-8000-000000000010', 'Still No Chansiri', '2026-12-01', '19:40', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000011', 'Chaps on Tap FC', '2026-12-08', '19:00', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000012', '99Problems But A Pitch Aint 1', '2026-12-15', '19:40', 'Pitch 1'),
        ('a0260922-3000-4000-8000-000000000013', 'Maradonner Kebab', '2026-12-22', '19:00', 'Pitch 1')
) AS fixture("id", "opponentName", "scheduledDate", "scheduledTime", "venue")
CROSS JOIN LATERAL (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'autumn 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
) AS season
CROSS JOIN LATERAL (
    SELECT "id" FROM "OpponentClub"
    WHERE LOWER("name") = LOWER(fixture."opponentName")
    ORDER BY "id"
    LIMIT 1
) AS opponent
WHERE NOT EXISTS (
    SELECT 1 FROM "Fixture" AS existing
    WHERE existing."seasonId" = season."id"
      AND existing."opponentClubId" = opponent."id"
      AND existing."competition" = 'LEAGUE'
      AND existing."scheduledDate" = fixture."scheduledDate"::date
);

INSERT INTO "Fixture" (
    "id", "seasonId", "opponentClubId", "competition", "scheduledDate",
    "scheduledTime", "venue", "status", "source"
)
SELECT
    'a0260922-3000-4000-8000-000000000014'::uuid,
    season."id",
    opponent."id",
    'LEAGUE'::"Competition",
    DATE '2026-09-22',
    NULL,
    NULL,
    'PLAYED'::"FixtureStatus",
    'scrape'::"FixtureSource"
FROM (
    SELECT "id" FROM "Season"
    WHERE LOWER("name") = 'autumn 2026'
    ORDER BY "startDate" DESC
    LIMIT 1
) AS season
CROSS JOIN LATERAL (
    SELECT "id" FROM "OpponentClub"
    WHERE LOWER("name") = LOWER('Declan Crooks FC')
    ORDER BY "id"
    LIMIT 1
) AS opponent
WHERE NOT EXISTS (
    SELECT 1 FROM "Fixture"
    WHERE "seasonId" = season."id"
      AND "opponentClubId" = opponent."id"
      AND "competition" = 'LEAGUE'
      AND "scheduledDate" = DATE '2026-09-22'
);

UPDATE "Fixture"
SET "status" = 'PLAYED'
WHERE "seasonId" = (
        SELECT "id" FROM "Season"
        WHERE LOWER("name") = 'autumn 2026'
        ORDER BY "startDate" DESC
        LIMIT 1
    )
  AND "opponentClubId" IN (
        SELECT "id" FROM "OpponentClub"
        WHERE LOWER("name") = LOWER('Declan Crooks FC')
    )
  AND "competition" = 'LEAGUE'
  AND "scheduledDate" = DATE '2026-09-22';

INSERT INTO "GameResult" (
    "id", "fixtureId", "seasonId", "competition", "datePlayed",
    "opponentClubId", "ourScore", "opponentScore", "isWalkover"
)
SELECT
    'a0260922-4000-4000-8000-000000000001'::uuid,
    fixture."id",
    fixture."seasonId",
    'LEAGUE'::"Competition",
    DATE '2026-09-22',
    fixture."opponentClubId",
    0,
    1,
    false
FROM "Fixture" AS fixture
JOIN "OpponentClub" AS opponent ON opponent."id" = fixture."opponentClubId"
JOIN "Season" AS season ON season."id" = fixture."seasonId"
WHERE LOWER(season."name") = 'autumn 2026'
  AND LOWER(opponent."name") = LOWER('Declan Crooks FC')
  AND fixture."competition" = 'LEAGUE'
  AND fixture."scheduledDate" = DATE '2026-09-22'
  AND NOT EXISTS (
      SELECT 1 FROM "GameResult"
      WHERE "seasonId" = fixture."seasonId"
        AND "opponentClubId" = fixture."opponentClubId"
        AND "competition" = 'LEAGUE'
        AND "datePlayed" = DATE '2026-09-22'
  )
LIMIT 1;

UPDATE "GameResult"
SET "ourScore" = 0,
    "opponentScore" = 1,
    "isWalkover" = false,
    "walkoverReason" = NULL
WHERE "seasonId" = (
        SELECT "id" FROM "Season"
        WHERE LOWER("name") = 'autumn 2026'
        ORDER BY "startDate" DESC
        LIMIT 1
    )
  AND "opponentClubId" IN (
        SELECT "id" FROM "OpponentClub"
        WHERE LOWER("name") = LOWER('Declan Crooks FC')
    )
  AND "competition" = 'LEAGUE'
  AND "datePlayed" = DATE '2026-09-22';

INSERT INTO "ScrapeStatus" (
    "id", "lastAttemptedAt", "lastSucceededAt", "lastError"
)
VALUES (
    1,
    TIMESTAMPTZ '2026-09-24 12:00:00+00',
    TIMESTAMPTZ '2026-09-24 12:00:00+00',
    NULL
)
ON CONFLICT ("id") DO UPDATE
SET "lastAttemptedAt" = EXCLUDED."lastAttemptedAt",
    "lastSucceededAt" = EXCLUDED."lastSucceededAt",
    "lastError" = NULL;
