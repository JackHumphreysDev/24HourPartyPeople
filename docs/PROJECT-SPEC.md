# 24 Hour Party People — Team Hub Build Spec

**Current version:** `0.10.0` — see `AGENTS.md` for the versioning policy
(semver scheme, what triggers a bump, when it's confirmed/tagged) and
Section 10 below for the changelog. Keep the changelog table and this
version line up to date as work lands.

## Stack (fixed — do not change without asking)

- **Frontend:** React (functional components + hooks; TypeScript preferred,
  plain JS acceptable if the repo already uses it — match `tsconfig.json` /
  existing files).
- **Backend:** Node.js + Express.
- **Database:** PostgreSQL in production, SQLite acceptable for local/dev —
  use an ORM (Prisma or Sequelize; whichever is already present in the repo,
  otherwise default to Prisma) so the schema below can target either DB.
- **Tooling:** match whatever's already configured in `package.json`
  (npm/yarn/pnpm, Jest/Vitest).
- **Scraping module only:** Python (see Section 6) — a separate
  script/microservice invoked by the Node backend, not a replacement for
  the Express API. Everything else in the app stays Node/Express/React.
- Before generating code, check the repo for an existing ORM, test runner,
  and folder conventions, and follow them instead of introducing a second
  pattern.

## 1. Feature overview

A team hub for **24 Hour Party People**, a 6-a-side team playing in:

> BOOHOOMAN SHEFFIELD (NORTON PLAYING FIELDS 3G CS) — TUE 6-A-SIDE NEW
> SUMMER 2026 (Powerleague)

All league/fixture/results data currently lives on the Powerleague site:
https://www.powerleague.com/league?league_id=c2eba5a8-76a3-e390-ef14-d1c4c8244ceb&division_id=
Going forward this data should be **scraped** into the app rather than
looked up manually (see Section 6).

Core capabilities:

- Home page showing current league position, a short description of the
  team, and the current squad displayed in a classic 6-a-side formation.
- Player profiles with current-season stats, historic season stats, and a
  career/overall summary.
- Current league standings (scraped).
- Game submission, including the walkover → cup-game-instead flow.
- Game history (league + cup results, with the possibility of two results
  on one date when a walkover triggers a cup game).
- Fixtures (scraped, upcoming).
- Club history — our own team's end-of-season finishes, starting from the
  current season.
- Admin-managed player profiles (one admin account, initially the site
  owner) with photo + description, linked to historic stats.

## 2. Data model

**User** — id, name, email, passwordHash, role (`ADMIN` | `PLAYER`),
createdAt. Only `ADMIN` users can create/edit Player records; a `PLAYER`
account may optionally be linked to a Player record (nullable FK) so a
player can eventually log in and view their own stats, but this linkage is
not required for launch.

**TeamProfile** (one singleton row) — id, description (free text,
admin-editable), updatedAt. The implemented public Home page reads this record,
and the dedicated `/admin/home-page` editor updates it.

**ScrapeStatus** (one singleton row) — id, lastAttemptedAt,
lastSucceededAt, lastError. Express updates it after every automated or manual
refresh so failures and cached-data staleness remain visible across restarts.

**Player** — id, name, description (free text, admin-editable),
profilePictureUrl (nullable), position (primary enum: `GK` | `DEF` | `MID` |
`FWD`, used for the formation display — see Section 3), additionalPositions
(unique array of any other `PlayerPosition` values), isActiveSquad (boolean),
createdAt.

> Formation is 1 GK + 3 DEF + 1 MID + 1 FWD (six players total, confirmed
> by product owner), so the `position` enum's `DEF` value should support
> up to 3 concurrent players in the active-squad formation view, with
> `MID` and `FWD` at exactly 1 each. Additional playable positions do not
> affect formation placement or capacity; only the primary `position` does.

**Season** — id, name (e.g. "Summer 2026"), startDate, endDate,
isCurrent (boolean, exactly one season should be current at a time —
enforce in application logic, not just convention), tracksGamesPlayed
(boolean — false for seasons before attendance tracking began and true for
the current season onward).

**PlayerSeasonStat** — id, playerId (FK), seasonId (FK), goals (integer),
assists (integer), cleanSheets (integer), gamesPlayed (integer, nullable —
**null/unknown whenever the related season has `tracksGamesPlayed = false`**,
since historic games-played data was never recorded; only populate for tracked
seasons — see Section 4), note (optional text, e.g. flagging incomplete
historic data).

**OpponentClub** — id, name (the other teams in the league, from the
scraped standings/fixtures — not our own club).

**Fixture** — id, seasonId (FK), opponentClubId (FK), competition (enum:
`LEAGUE` | `CUP`), scheduledDate, scheduledTime (nullable), venue
(nullable), status (enum: `SCHEDULED` | `PLAYED` | `WALKOVER`), source
(enum: `scrape` | `manual`, so admin-entered fixtures can coexist with
scraped ones).

**GameResult** — id, fixtureId (FK, nullable — a cup game slotted in
after a walkover may not have a pre-existing scraped fixture row, so allow
creating a GameResult with an inline opponent/date instead of requiring a
Fixture first), seasonId (FK), competition (enum: `LEAGUE` | `CUP`),
datePlayed, opponentClubId (FK), ourScore (integer, nullable if walkover),
opponentScore (integer, nullable if walkover), isWalkover (boolean),
walkoverReason (text, nullable), createdAt.

> A single calendar date can have **two** GameResult rows: the league
> fixture recorded as a walkover, plus a separate cup GameResult played
> instead. Game history must display both rather than assuming one
> result per date.

**SeasonStanding** (scraped, current season's live table) — id, seasonId
(FK), position (integer), clubName (text — either "24 Hour Party People"
or an opponent), played, won, drawn, lost, gf, ga, gd, points,
walkoverGames (integer), scrapedAt (timestamp, so staleness is visible).

**ClubHistory** (our own club's end-of-season summary, one row per season,
starting from the current season only) — id, seasonId (FK), position,
played, won, drawn, lost, gf, ga, gd, points, walkoverGames, finalisedAt
(nullable at the schema level; implemented records are created only by the
explicit end-of-season finalisation flow and always receive this timestamp).

## 3. User-facing flows / tabs

### Home page

- Current league position for **24 Hour Party People** (pulled from
  `SeasonStanding` for the current season, filtered to our club name).
- Short description of the team, stored in the singleton `TeamProfile` and
  editable by an administrator at `/admin/home-page`.
- Current squad shown in a **1GK-3DEF-1MID-1FWD** formation (1 goalkeeper,
  3 defenders, 1 midfielder, 1 forward — confirmed by product owner).
  Layout the outfield players by their `position` field, with the
  defensive line rendered as a row of 3. Keep the formation shape as a
  config constant rather than hardcoding it inline, so it can still be
  changed later without a rewrite, but this shape itself is confirmed —
  no longer an open decision.
- The implemented responsive pitch uses each active player's primary position,
  links players to their profiles, and shows explicit empty and vacant-place
  states when standings or squad data is incomplete.

### Player profiles (tab)

- List of players → individual profile view per player showing:
  - Description + profile picture (admin-set).
  - Current season stats: goals, assists, clean sheets, games played.
  - Previous season stats, per season: goals, assists, clean sheets.
    **Do not display a games-played figure for any season before the
    current one** — show it as "not recorded" rather than 0, since 0 would
    misrepresent missing historic data.
  - An overall/history section aggregating career totals across all
    seasons (goals, assists, clean sheets summed; games played summed only
    from the current season onward, clearly labelled as such so it isn't
    read as a full career total).

### Current league standings (tab)

- Full table for the current season, scraped from Powerleague: position,
  club, played, won, drawn, lost, GF, GA, GD, points. Include walkover
  games as an extra column if present in the source data.

### Game submission (tab)

- Admin (or eventually a permitted player) submits a game result.
- Flow:
  1. Select the fixture (or enter one manually: opponent, date).
  2. Select competition type: League or Cup.
  3. **If the league game was a walkover:** mark it `isWalkover = true`,
     record the reason (optional free text), leave scores blank, and
     prompt the user to also submit a **Cup** game result for the same
     date (since a walkover means a cup game is played instead) — this
     should feel like a natural next step in the same flow, not a
     separate hidden feature.
  4. Otherwise, enter our score and the opponent's score as normal.
- Saving a non-walkover league result should trigger a re-fetch/refresh of
  `SeasonStanding` (or at minimum flag it as stale) since the scrape source
  is the league table, and a manually-entered result won't retroactively
  correct the scraped table until the next scrape.
- The current implementation takes the permitted fallback above: it returns
  and displays a standings-refresh-required flag until the Powerleague scraper
  is connected.

### Game history (tab)

- Chronological list of all `GameResult` rows: date, competition (League/
  Cup), opponent, score (or "Walkover" in place of a score), and season.
- Explicitly support and display two entries on the same date (walkover +
  cup game) rather than assuming one game per date.

### Fixtures (tab)

- Upcoming scheduled games from the current Sheffield date onward, with date,
  optional Sheffield-local kick-off time, opponent, season, and venue if
  available. League and Cup fixtures are distinguished.
- The implemented manual fallback lets an administrator add fixtures and
  correct scheduled fixtures before results are recorded. Played and walkover
  fixtures are retained as read-only history. Scraped fixture ingestion remains
  part of the separate Powerleague scraper feature.

### Club history (tab)

- One row per season, starting from the current season (no historic rows
  before it, since this is the app's own record rather than backfilled
  data): Position, Club (our club name), Played, Won, Drawn, Lost, GF, GA,
  GD, Points, Walk-over games.
- Populated from `ClubHistory`, finalised once a season ends (don't treat
  an in-progress `SeasonStanding` row as the final `ClubHistory` row until
  the season is actually over).
- The implemented administrator flow lists ended, attendance-tracked seasons
  and explicitly copies the saved 24 Hour Party People standing into club
  history. A saved team standing is required, finalisation is transactional
  and one-time, and finalised history is immutable through the website.

### Admin / profile creation

- The site owner can create an account and be flagged `ADMIN`.
- Admin can create, edit, and deactivate Player profiles (name,
  description, profile picture, position), and link a Player to their
  historic `PlayerSeasonStat` rows (entered manually for past seasons,
  since that data isn't on Powerleague in a per-player breakdown — the
  Powerleague scrape covers team-level standings/fixtures/results, not
  individual player stats).
- Admin can create and edit seasons, make exactly one season current, record
  whether each season tracked games played, and add or update non-negative
  player statistics for active and inactive players.

## 4. Games-played tracking — historic data note

Previous seasons have goals, assists, and clean sheets recorded, but
**games played was never tracked** before now. Per product decision:

- Set `Season.tracksGamesPlayed` to `true` from the first tracked season onward
  and require `gamesPlayed` on every related `PlayerSeasonStat`.
- Set `Season.tracksGamesPlayed` to `false` for all prior seasons; their
  `gamesPlayed` values stay `null` and render as "not recorded," not `0` or
  blank. This season-level fact remains accurate after a current season later
  becomes historic.
- Do not attempt to back-calculate historic games played from goals/
  assists/clean-sheets data — there's no reliable way to derive attendance
  from scoring stats, so don't guess.

## 5. League standings & club history — display logic

`SeasonStanding` (current season, all clubs) and `ClubHistory` (our club,
by season) are structurally similar tables but serve different purposes —
don't merge them into one component that hides which is which:

- `SeasonStanding` is a **live, scraped** snapshot of the whole league for
  the current season only, re-scraped periodically (see Section 6).
- The implemented manual fallback replaces the current season’s complete
  snapshot atomically and shows its `scrapedAt` value as “Last updated.” It
  calculates goal difference from GF and GA and validates table consistency.
  Automatic scrape ingestion remains part of the separate scraper feature.
- `ClubHistory` is **our own club's row only**, persisted **once per
  season**, and only starts existing from the app's launch season forward.
  Eligibility uses the established `Season.tracksGamesPlayed` launch boundary.
  An administrator must explicitly copy/finalise the saved team standing after
  the season's Sheffield-local end date, so a mid-scrape glitch cannot corrupt
  a season that's already finished. Finalised records are immutable through the
  website.

## 6. Powerleague scraping module

A **Python** script/microservice that fetches league standings, fixtures,
and results from the club's Powerleague page, so this data doesn't have to
be entered manually each week. This is the one part of the stack that
isn't Node — everything else (API, DB access, frontend) stays
Node/Express/React as in Section "Stack" above.

**Source URL (confirmed):**
`https://www.powerleague.com/league?league_id=c2eba5a8-76a3-e390-ef14-d1c4c8244ceb&division_id=`

### How it fits with the Node backend

- **Implemented decision:** the scraper is a private FastAPI Vercel Service.
  Express calls it through a private service binding authenticated by
  `SCRAPER_SERVICE_KEY`; it has no public route and the React frontend never
  calls Python directly.
- Python owns HTTP fetching and HTML parsing. It returns a validated payload to
  Express, which owns all Prisma access and atomically updates the shared Neon
  database. This avoids duplicating database rules or ORM behaviour in Python.
- `/api/admin/scrape/refresh` runs the same Express orchestration used by the
  protected scheduled route. Vercel Cron invokes that route once daily at
  06:00 UTC, while administrators can refresh immediately when required.

### Known risk — bot detection

A browser-like direct request was retested on 8 September 2026 and returned
HTTP 200 with server-rendered standings, fixtures, and results. The implemented
transport therefore uses `requests` and Beautiful Soup rather than shipping a
headless browser. If Powerleague later blocks data-centre requests, the fetch
transport can be replaced with Playwright without changing the parsers or
Express ingestion. The module uses a **two-tier strategy** so a future block or
markup change does not break the website:

**Tier 1 — automated scrape of the Powerleague page (Python)**

- Runs once daily through Vercel Cron and on demand when an administrator uses
  `/api/admin/scrape/refresh`.
- The real server-rendered selectors were confirmed against the live page and
  are isolated in `scraper/powerleague/config.py`. The parser targets the full
  current-standings table and only the desktop fixtures table, avoiding the
  duplicate responsive markup, then filters fixtures and results to 24 Hour
  Party People.
- Store the raw scrape timestamp alongside the parsed data
  (`scrapedAt` on `SeasonStanding`) so staleness is visible to the user
  rather than silently shown as current.

**Tier 2 — manual admin fallback**

- If the scrape fails (bot-blocked, structural change on the site,
  network error, timeout), don't crash the standings/fixtures tabs — fall
  back to the last successfully cached data, clearly labelled with its
  `scrapedAt` date, and let the admin manually enter/correct a standings
  row or fixture via a simple form (in the Node/React app) as a stop-gap.
- Log scrape failures clearly (reason, timestamp) rather than failing
  silently, so it's obvious when Tier 1 needs attention.

### Public interface (suggested)

The Python side exposes/produces the same shapes regardless of which
integration mechanism (script-writes-to-DB vs. internal HTTP service) is
chosen:

```ts
type StandingsRow = {
  position: number;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  walkoverGames?: number;
};

type ScrapedFixture = {
  opponentClubName: string;
  scheduledDate: string; // ISO date
  scheduledTime: string | null; // Sheffield local HH:mm
  competition: "LEAGUE" | "CUP";
  venue?: string;
};

type ScrapedResult = {
  opponentClubName: string;
  datePlayed: string; // ISO date
  ourScore: number;
  opponentScore: number;
  competition: "LEAGUE" | "CUP";
};
```

The implemented Python entry point is:

```python
def scrape_powerleague() -> ScrapeResult | None: ...
```

It returns `None` and logs on fetch or structural failure. Express then records
the failed attempt and keeps the last successful database snapshot unchanged.

### Caching

- Cache the last successful scrape (standings, fixtures, and results) in the shared DB
  (not just in-memory), since it's also the Tier 2 fallback source and
  needs to survive a restart of either the Python job or the Node server.
- Don't hammer the source site — respect whatever cadence is decided in
  Tier 1 rather than scraping on every page load.

### Unit tests required

Using pytest for the scraper itself:

1. **Scrape success** — mock the fetched HTML with a known-good fixture
   (once real selectors are confirmed) → assert correct parsed
   `StandingsRow` / `ScrapedFixture` data.
2. **Scrape structural failure** — mock HTML that doesn't match expected
   selectors → assert the module logs the issue and falls back to cached
   data rather than raising.
3. **Total failure, no cache available** — mock a network error with no
   prior cached data → assert the function resolves to `None` and does
   not raise.

The Node side (routes that surface `/api/standings/current`,
`/api/fixtures/upcoming`, etc.) is still covered by the repo's existing
JS/TS test runner (Jest/Vitest) as normal — only the scraper itself is
Python/pytest. All required success and failure cases are implemented.

## 7. Suggested Express routes (adjust to existing API conventions)

```
POST   /api/auth/register                 create account
POST   /api/auth/login                    login
GET    /api/players                        list players
GET    /api/players/:id                    player profile + current/historic stats
GET    /api/admin/players                  (admin) list active/inactive players
POST   /api/admin/players                  (admin) create player profile
PUT    /api/admin/players/:id              (admin) edit player profile
GET    /api/admin/players/:id/season-stats (admin) list a player's stats
POST   /api/admin/players/:id/season-stats (admin) add/edit a season's stats
GET    /api/admin/seasons                  (admin) list seasons
POST   /api/admin/seasons                  (admin) create a season
PUT    /api/admin/seasons/:id              (admin) edit/make a season current
GET    /api/team-profile                   public team description
GET    /api/admin/team-profile             (admin) editable team description
PUT    /api/admin/team-profile             (admin) update team description
GET    /api/games                          game history
GET    /api/admin/games/fixtures           (admin) scheduled result options
POST   /api/admin/games                    (admin) submit a result (incl. walkover flow)
GET    /api/standings/current              current league standings (scraped, cached)
GET    /api/admin/standings                (admin) current standings snapshot
PUT    /api/admin/standings/current        (admin) replace current standings snapshot
GET    /api/fixtures/upcoming              upcoming fixtures (scraped, cached)
GET    /api/admin/fixtures                 (admin) list all fixtures
POST   /api/admin/fixtures                 (admin) create a manual fixture
PUT    /api/admin/fixtures/:id             (admin) correct a scheduled fixture
GET    /api/club-history                   our club's season-by-season finishes
GET    /api/admin/club-history             (admin) finalised history and eligible seasons
POST   /api/admin/club-history/:seasonId/finalise
                                            (admin) finalise an ended season
POST   /api/admin/scrape/refresh           (admin) force a manual re-scrape
```

## 8. Definition of done

- [x] Home page shows current league position, an administrator-editable team
      description, and the current squad in a responsive 1GK-3DEF-1MID-1FWD
      formation based on each player's primary position
- [x] Player profiles show current-season stats, per-season historic
      stats (goals/assists/clean sheets only), and an overall/history
      section that clearly separates career totals from
      current-season-onward games-played totals
- [x] Current league standings tab shows the current-season table with a
      visible "last updated" timestamp and authenticated manual snapshot
      replacement, plus automatic and administrator-triggered scraped ingestion
- [x] Game submission supports the walkover → cup-game-instead flow,
      allowing two results to exist for the same date
- [x] Game history displays every result with date and competition type,
      correctly handling same-date walkover + cup pairs
- [x] Fixtures tab shows upcoming scheduled games with date, competition,
      opponent, optional Sheffield-local time, and venue; administrators have
      a manual create/correct fallback alongside automatic scraped ingestion
- [x] Club history tab shows our club's own finalised season-end finishes,
      starting from the launch season, with the required columns including
      walkover games; administrators can explicitly finalise an ended season
      from its saved team standing, after which it is immutable through the site
- [x] Admin account can create/edit player profiles (description, picture,
      primary and additional playable positions), edit the Home page team
      description, and enter historic season stats
- [x] Admin can create/edit seasons, maintain exactly one current season, and
      preserve whether games played was recorded for each season
- [x] Scraping module (Python) implemented with both tiers, DB-backed
      caching, a visible staleness indicator, and the 3 required pytest
      unit tests passing
- [x] All scrape failure paths (Section 6) log instead of crashing, and
      fall back to cached data or a manual-entry path

## 9. Things not to guess — flag instead

- If Powerleague later blocks direct server-side requests, confirm the failure
  in production before replacing the isolated requests transport with a
  headless-browser implementation.
- Whether historic games-played data can ever be reliably backfilled —
  current guidance is no; leave as "not recorded" rather than estimating

## 10. Changelog

Kept in sync with `CHANGELOG.md` and `package.json`'s `"version"` field
(see `AGENTS.md` for the versioning policy). Add a row here — and there —
at every version bump; don't let this table fall behind the actual repo
state.

| Version | Date | Change |
|---|---|---|
| 0.10.0 | 2026-09-08 | Added the public Home page team hub, authenticated team-description editing, and primary plus additional playable positions for players |
| 0.9.0 | 2026-09-08 | Added public club history and authenticated, one-time finalisation of eligible ended seasons from saved team standings; standardised the project on UK English |
| 0.8.1 | 2026-09-08 | Deployed the website to Vercel with a London Express Function, Neon PostgreSQL, production-safe migrations, SPA routing, and Cloudinary configuration |
| 0.8.0 | 2026-09-07 | Added public current-season standings and authenticated atomic snapshot replacement with consistency validation |
| 0.7.0 | 2026-09-07 | Added public upcoming fixtures and authenticated manual fixture creation/correction with recorded-history protection |
| 0.6.0 | 2026-09-07 | Added fixture/manual result submission, guided league-walkover cup follow-up, and public same-date game history |
| 0.5.0 | 2026-09-07 | Added authenticated season and player-statistics management with explicit historical games-played tracking |
| 0.4.0 | 2026-09-07 | Added routed public player profiles, authenticated squad management, Cloudinary picture uploads, and transactional formation limits |
| 0.3.0 | 2026-09-02 | Added one-time administrator setup, secure database-backed sessions, authentication APIs and middleware, and the browser sign-in experience |
| 0.2.0 | 2026-09-02 | Added the core football data model, initial PostgreSQL migration, and isolated database integration tests |
| 0.1.0 | 2026-09-02 | Initial infrastructure setup — repo scaffold, stack wired up (React/Express/DB via ORM), no features yet |
