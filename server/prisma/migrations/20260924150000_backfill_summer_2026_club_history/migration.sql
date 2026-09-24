-- The season-transition migration preserved Summer 2026's final standing,
-- but only updated an existing club-history row. Production did not yet have
-- that row, so create the finalised snapshot from the saved standing. Keep the
-- statement idempotent for databases where an administrator already created it.

INSERT INTO "ClubHistory" (
    "id", "seasonId", "position", "played", "won", "drawn", "lost",
    "gf", "ga", "gd", "points", "walkoverGames", "finalisedAt"
)
SELECT
    'b0260915-5000-4000-8000-000000000001'::uuid,
    season."id",
    standing."position",
    standing."played",
    standing."won",
    standing."drawn",
    standing."lost",
    standing."gf",
    standing."ga",
    standing."gd",
    standing."points",
    standing."walkoverGames",
    TIMESTAMPTZ '2026-09-24 12:00:00+00'
FROM "Season" AS season
JOIN "SeasonStanding" AS standing
  ON standing."seasonId" = season."id"
 AND LOWER(standing."clubName") = LOWER('24 Hour Party People')
WHERE LOWER(season."name") = 'summer 2026'
  AND season."endDate" = DATE '2026-09-15'
ON CONFLICT ("seasonId") DO UPDATE
SET "position" = EXCLUDED."position",
    "played" = EXCLUDED."played",
    "won" = EXCLUDED."won",
    "drawn" = EXCLUDED."drawn",
    "lost" = EXCLUDED."lost",
    "gf" = EXCLUDED."gf",
    "ga" = EXCLUDED."ga",
    "gd" = EXCLUDED."gd",
    "points" = EXCLUDED."points",
    "walkoverGames" = EXCLUDED."walkoverGames",
    "finalisedAt" = COALESCE("ClubHistory"."finalisedAt", EXCLUDED."finalisedAt");
