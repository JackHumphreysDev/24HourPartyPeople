# 24 Hour Party People — Team Hub Build Spec

**Current version:** `0.3.0` — see `AGENTS.md` for the versioning policy
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

**Player** — id, name, description (free text, admin-editable),
profilePictureUrl (nullable), position (enum: `GK` | `DEF` | `MID` | `FWD`,
used for the formation display — see Section 3), isActiveSquad (boolean),
createdAt.

> Formation is 1 GK + 3 DEF + 1 MID + 1 FWD (six players total, confirmed
> by product owner), so the `position` enum's `DEF` value should support
> up to 3 concurrent players in the active-squad formation view, with
> `MID` and `FWD` at exactly 1 each.

**Season** — id, name (e.g. "Summer 2026"), startDate, endDate,
isCurrent (boolean, exactly one season should be current at a time —
enforce in application logic, not just convention).

**PlayerSeasonStat** — id, playerId (FK), seasonId (FK), goals (integer),
assists (integer), cleanSheets (integer), gamesPlayed (integer, nullable —
**null/unknown for all seasons before the current one**, since historic
games-played data was never recorded; only populate going forward — see
Section 4), note (optional text, e.g. flagging incomplete historic data).

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
played, won, drawn, lost, gf, ga, gd, points, walkoverGames, finalizedAt
(nullable — null until the season has actually finished).

## 3. User-facing flows / tabs

### Home page

- Current league position for **24 Hour Party People** (pulled from
  `SeasonStanding` for the current season, filtered to our club name).
- Short description of the team (static/admin-editable text block).
- Current squad shown in a **1GK-3DEF-1MID-1FWD** formation (1 goalkeeper,
  3 defenders, 1 midfielder, 1 forward — confirmed by product owner).
  Layout the outfield players by their `position` field, with the
  defensive line rendered as a row of 3. Keep the formation shape as a
  config constant rather than hardcoding it inline, so it can still be
  changed later without a rewrite, but this shape itself is confirmed —
  no longer an open decision.

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

### Game history (tab)

- Chronological list of all `GameResult` rows: date, competition (League/
  Cup), opponent, score (or "Walkover" in place of a score), and season.
- Explicitly support and display two entries on the same date (walkover +
  cup game) rather than assuming one game per date.

### Fixtures (tab)

- Upcoming scheduled games (scraped), with date, opponent, venue if
  available. Distinguish League vs Cup fixtures once that's determinable
  from the source.

### Club history (tab)

- One row per season, starting from the current season (no historic rows
  before it, since this is the app's own record rather than backfilled
  data): Position, Club (our club name), Played, Won, Drawn, Lost, GF, GA,
  GD, Points, Walk-over games.
- Populated from `ClubHistory`, finalized once a season ends (don't treat
  an in-progress `SeasonStanding` row as the final `ClubHistory` row until
  the season is actually over).

### Admin / profile creation

- The site owner can create an account and be flagged `ADMIN`.
- Admin can create, edit, and deactivate Player profiles (name,
  description, profile picture, position), and link a Player to their
  historic `PlayerSeasonStat` rows (entered manually for past seasons,
  since that data isn't on Powerleague in a per-player breakdown — the
  Powerleague scrape covers team-level standings/fixtures/results, not
  individual player stats).

## 4. Games-played tracking — historic data note

Previous seasons have goals, assists, and clean sheets recorded, but
**games played was never tracked** before now. Per product decision:

- From the **current season onward**, record `gamesPlayed` on every
  `PlayerSeasonStat`.
- For all prior seasons, `gamesPlayed` stays `null` and is rendered as
  "not recorded," not `0` or blank.
- Do not attempt to back-calculate historic games played from goals/
  assists/clean-sheets data — there's no reliable way to derive attendance
  from scoring stats, so don't guess.

## 5. League standings & club history — display logic

`SeasonStanding` (current season, all clubs) and `ClubHistory` (our club,
by season) are structurally similar tables but serve different purposes —
don't merge them into one component that hides which is which:

- `SeasonStanding` is a **live, scraped** snapshot of the whole league for
  the current season only, re-scraped periodically (see Section 6).
- `ClubHistory` is **our own club's row only**, persisted **once per
  season**, and only starts existing from the current season forward. It
  should not be re-derived live from `SeasonStanding` after a season ends —
  copy/finalize it explicitly so a mid-scrape glitch can't corrupt a
  season that's already finished.

## 6. Powerleague scraping module

A **Python** script/microservice that fetches league standings, fixtures,
and results from the club's Powerleague page, so this data doesn't have to
be entered manually each week. This is the one part of the stack that
isn't Node — everything else (API, DB access, frontend) stays
Node/Express/React as in Section "Stack" above.

**Source URL (confirmed):**
`https://www.powerleague.com/league?league_id=c2eba5a8-76a3-e390-ef14-d1c4c8244ceb&division_id=`

### How it fits with the Node backend

- **Flag, don't guess:** the exact integration mechanism between the
  Python scraper and the Express backend is an open decision — options
  include (a) a standalone Python script run on a schedule that writes
  directly to the shared Postgres/SQLite DB, or (b) a small Python HTTP
  microservice (e.g. FastAPI/Flask) that Express calls internally and
  never exposes to the frontend. Confirm which before building; a scheduled
  script writing to the shared DB is the simpler default if no other
  requirement pushes toward a live microservice.
- Either way, the Node/Express routes in Section 7 (`/api/standings/current`,
  `/api/fixtures/upcoming`, `/api/admin/scrape/refresh`) are still what the
  React frontend calls — the frontend never talks to Python directly.
- `/api/admin/scrape/refresh` triggers the Python scraper (spawned as a
  subprocess, or called over its internal HTTP endpoint, depending on the
  option chosen above) rather than duplicating scraping logic in Node.

### Known risk — bot detection

A direct fetch of this URL was attempted while writing this spec and was
**blocked by bot detection** on Powerleague's site. This means:

- A simple HTTP request + HTML-parse (e.g. Python's `requests` +
  `BeautifulSoup`) approach may not work at all in production if the same
  protection applies to server-side requests.
- **Flag, don't guess:** whether this requires a headless browser (e.g.
  Playwright for Python, which can run with a real browser fingerprint) to
  get past bot detection, or whether it's only blocking obviously-automated
  clients/data-center IPs, is unconfirmed and should be checked against
  the live site before committing to an approach. Don't silently build the
  simple version and call it done if it can't actually reach the page.
- Because of this risk, the module should be built with a **two-tier
  strategy** so the app degrades gracefully rather than breaking outright:

**Tier 1 — automated scrape of the Powerleague page (Python)**

- Runs on a schedule (e.g. a cron job invoking the Python script — exact
  cadence is a product decision, default to once daily, flag as
  configurable) and/or on-demand when `/api/admin/scrape/refresh` is hit.
- Exact DOM structure/selectors for the standings table, fixtures list,
  and results list are **unconfirmed** — the page could not be fetched
  during spec-writing due to bot detection. **Do not hardcode guessed
  selectors.** Put them in a config file/constants module with a
  `# TODO: confirm real selectors once the page can be inspected
  (view-source or browser devtools against the live URL)` comment, and
  write the parsing generically enough that updating selectors is a
  config change, not a rewrite.
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
  competition?: "LEAGUE" | "CUP"; // may be unknown until confirmed against real markup
  venue?: string;
};
```

If built as a Python HTTP microservice, the equivalent Python-side
functions would be:

```python
def get_current_standings() -> list[StandingsRow] | None: ...
def get_upcoming_fixtures() -> list[ScrapedFixture] | None: ...
```

Both should return `None` (and log) on total failure rather than raising,
mirroring the fallback behaviour above — let the caller (Node, or the
scheduled script itself) decide whether to show/keep cached data.

### Caching

- Cache the last successful scrape (standings + fixtures) in the shared DB
  (not just in-memory), since it's also the Tier 2 fallback source and
  needs to survive a restart of either the Python job or the Node server.
- Don't hammer the source site — respect whatever cadence is decided in
  Tier 1 rather than scraping on every page load.

### Unit tests required

Using Python's test runner (e.g. `pytest`) for the scraper itself:

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
Python/pytest.

## 7. Suggested Express routes (adjust to existing API conventions)

```
POST   /api/auth/register                 create account
POST   /api/auth/login                    login
POST   /api/players                       (admin) create player profile
PUT    /api/players/:id                    (admin) edit player profile
GET    /api/players                        list players
GET    /api/players/:id                    player profile + current/historic stats
POST   /api/players/:id/season-stats       (admin) add/edit a season's stats
POST   /api/games                          submit a game result (incl. walkover flow)
GET    /api/games                          game history
GET    /api/standings/current              current league standings (scraped, cached)
GET    /api/fixtures/upcoming              upcoming fixtures (scraped, cached)
GET    /api/club-history                   our club's season-by-season finishes
POST   /api/admin/scrape/refresh           (admin) force a manual re-scrape
```

## 8. Definition of done

- [ ] Home page shows current league position, team description, and
      current squad in a 1GK-3DEF-1MID-1FWD formation
- [ ] Player profiles show current-season stats, per-season historic
      stats (goals/assists/clean sheets only), and an overall/history
      section that clearly separates career totals from
      current-season-onward games-played totals
- [ ] Current league standings tab shows the scraped table for the
      current season, with a visible "last updated" timestamp
- [ ] Game submission supports the walkover → cup-game-instead flow,
      allowing two results to exist for the same date
- [ ] Game history displays every result with date and competition type,
      correctly handling same-date walkover + cup pairs
- [ ] Fixtures tab shows scraped upcoming games
- [ ] Club history tab shows our club's own season-end finish, starting
      from the current season, with the required columns including
      walkover games
- [ ] Admin account can create/edit player profiles (description,
      picture) and enter historic season stats
- [ ] Scraping module (Python) implemented with both tiers, DB-backed
      caching, a visible staleness indicator, and the 3 required pytest
      unit tests passing
- [ ] All scrape failure paths (Section 6) log instead of crashing, and
      fall back to cached data or a manual-entry path

## 9. Things not to guess — flag instead

- The real Powerleague page's DOM structure/selectors (marked TODO in
  Section 6) — confirmed blocked by bot detection during spec-writing, so
  this must be checked against the live site (and a headless-browser
  approach evaluated) before writing the real scraper, not assumed
- How the Python scraper talks to the Node backend (scheduled script
  writing to the shared DB vs. an internal Python HTTP microservice) —
  Section 6 defaults to the simpler script-writes-to-DB option, but
  confirm before building
- Scrape cadence/schedule (defaulted to daily, flagged as configurable)
- Whether historic games-played data can ever be reliably backfilled —
  current guidance is no; leave as "not recorded" rather than estimating
- Which ORM/test runner to use if none is already present in the repo

## 10. Changelog

Kept in sync with `CHANGELOG.md` and `package.json`'s `"version"` field
(see `AGENTS.md` for the versioning policy). Add a row here — and there —
at every version bump; don't let this table fall behind the actual repo
state.

| Version | Date | Change |
|---|---|---|
| 0.3.0 | 2026-09-02 | Added one-time administrator setup, secure database-backed sessions, authentication APIs and middleware, and the browser sign-in experience |
| 0.2.0 | 2026-09-02 | Added the core football data model, initial PostgreSQL migration, and isolated database integration tests |
| 0.1.0 | 2026-09-02 | Initial infrastructure setup — repo scaffold, stack wired up (React/Express/DB via ORM), no features yet |
