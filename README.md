# 24 Hour Party People

## Project purpose

24 Hour Party People is a website for a 6-a-side football team competing in
the BoohooMAN Sheffield Tuesday League at Norton Playing Fields 3G. It will
bring player profiles, statistics, fixtures, results, league standings, and
club history together in one team hub.

The current `0.13.1` release includes the project foundation, core football
data model, secure administrator authentication, routed player profiles,
administrator squad management, and season-by-season player-statistics
management. Administrators can also record league, cup, and walkover results,
which appear in public game history, manage upcoming fixtures, and replace the
current league table displayed on the public website. The Home page presents
the editable team introduction, current league position, and active squad in
formation; player profiles also record additional playable positions. Ended
seasons can be finalised into the permanent public club history. Powerleague
standings, fixtures, and results can be refreshed automatically through a
private scraper, with cached data and administrator entry retained as safe
fallbacks. Players can create accounts and request their Player profile, with
administrator approval and manual assignment controls; administrators can
manage their own normal login details without using the recovery setup key.
Historical season totals can be imported with a validated preview, while new
games-tracked seasons derive appearances, goals, assists, and clean sheets
from the administrator's per-game records. The public squad is grouped by
keepers, defenders, midfielders, and attackers, followed by a separate archive
of inactive historical players and their recorded statistics.
The website is deployed to Vercel with Neon PostgreSQL and Cloudinary image
storage. See
[the project specification](docs/PROJECT-SPEC.md) for full functionality.

## Technology stack

- **Frontend:** React, React Router, Vite, and TypeScript
- **Backend:** Node.js, Express, and TypeScript
- **Scraper:** Python 3.13, FastAPI, requests, and Beautiful Soup
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Image storage:** Cloudinary
- **Testing:** Vitest, Testing Library, Supertest, and pytest
- **Linting and formatting:** Oxlint and Prettier
- **Package management:** npm workspaces

This is a browser-based website. The repository does not contain a native
mobile application.

## Project structure

- `client/` — React website
- `server/` — Express API, Prisma configuration, and server tests
- `api/` — Vercel entry point for the Express API
- `scraper/` — private FastAPI Powerleague scraper and pytest suite
- `docs/` — full product and engineering specification
- `compose.yaml` — local PostgreSQL service
- `vercel.json` — production build, Function region, and SPA routing
- `AGENTS.md` — project workflow and collaboration rules

## Production hosting

The production website is available at
[24-hour-party-people.vercel.app](https://24-hour-party-people.vercel.app).
Vercel deploys three Services together: the Vite frontend, the Express API,
and a private FastAPI scraper. The Express and Python Functions run in the
London region. Requests under `/api` are routed to Express; other routes fall
back to the Vite `index.html` for React Router. The scraper has no public
route: Express reaches it through a deployment-aware private service binding.

PostgreSQL is hosted by Neon through Vercel Marketplace. `DATABASE_URL` is the
pooled runtime connection used by Prisma, while `DATABASE_URL_UNPOOLED` is the
direct connection used by `prisma migrate deploy`. Neon supplies both values
to production, preview, and development deployments. Preview deployments can
therefore use Neon’s isolated preview branches without changing application
code.

The Vercel project also requires these application secrets:

- `ADMIN_SETUP_KEY` — recovery-only secret for initial administrator setup
- `CLOUDINARY_CLOUD_NAME` — Cloudinary account cloud name
- `CLOUDINARY_API_KEY` — Cloudinary API key
- `CLOUDINARY_API_SECRET` — Cloudinary API secret
- `SCRAPER_SERVICE_KEY` — independent random secret authenticating Express to the scraper
- `CRON_SECRET` — independent random secret used by Vercel to authenticate scheduled refreshes

`POWERLEAGUE_SCRAPER_URL` is injected automatically into the Express Service
by Vercel’s private binding and must not be entered manually in the Vercel
dashboard. The daily Cron invokes the protected Express refresh route at
06:00 UTC; Vercel Hobby scheduling can run at any point during that hour.

Node.js is pinned to the `24.x` release line and Python to `3.13`. The frontend
Service builds the Vite website, the API Service applies pending migrations
through the direct Neon connection, and the scraper Service installs its
pinned `uv.lock` dependencies. Migrations must remain backward compatible with
the currently deployed application because they run before the new deployment
is promoted.

The GitHub repository is connected to Vercel. Pull-request branches receive
preview deployments, and changes merged to `main` create production
deployments at the canonical URL above.

## Core data model

The Prisma schema defines users, the singleton team profile, scraper status,
players, seasons, historical player season statistics, opponents, fixtures,
game results, per-game player statistics, live standings, and finalised club
history. Migrations are stored in
`server/prisma/migrations/`.

Database relationships preserve historical football records. Players are
deactivated rather than deleted once statistics reference them, while optional
approved and requested account links and fixture links are cleared without
deleting their user or result. A Player profile can have at most one approved
account and one pending claim. Business rules such as exactly one current
season, valid formation limits, non-negative statistics, and walkover score
handling are enforced by the application features that write those records.

## Authentication

The first administrator account is created once through the recovery-only
`POST /api/auth/register` endpoint and the `ADMIN_SETUP_KEY`. The normal
website does not display or request that key. Once the administrator exists,
they sign in with their email and password and can update their name, email,
or password from `/admin/account`; the current password is required to save a
change.

Players can create an account from the website and select an active, unclaimed
Player profile. The account is created immediately, but its profile link
remains pending until an administrator approves it. Administrators review,
approve, or reject claims and can assign or unassign profiles manually at
`/admin/accounts`. Rejected or unlinked player accounts can request another
available profile from `/account`. Player accounts can view their linked
public profile but cannot edit football records.

Passwords are stored as salted scrypt hashes. Successful registration and
login create a random, revocable seven-day session whose SHA-256 token hash is
stored in PostgreSQL. The browser receives only the opaque token in an
`HttpOnly`, `SameSite=Lax` cookie, with `Secure` enabled in production.
Authentication attempts are rate limited, and failed logins do not reveal
whether an email address exists.

The authentication API provides:

- `POST /api/auth/register` — create the first administrator account
- `GET /api/auth/player-registration-options` — list active, unclaimed Player profiles
- `POST /api/auth/player-register` — create a player account with a pending profile claim
- `POST /api/auth/login` — sign in and start a session
- `POST /api/auth/logout` — revoke the current session
- `GET /api/auth/me` — return the currently authenticated user
- `PUT /api/auth/me/player-request` — request a profile for an unlinked player account
- `PUT /api/admin/account` — update the signed-in administrator account
- `GET /api/admin/accounts` — list player accounts, claims, and profile assignments
- `POST /api/admin/accounts/:userId/approve` — approve a pending profile claim
- `POST /api/admin/accounts/:userId/reject` — reject a pending profile claim
- `PUT /api/admin/accounts/:userId/player` — assign or unassign a Player profile

## Home page

The public `/` route displays the administrator-editable team description, the
current 24 Hour Party People league position, and active players arranged on a
responsive pitch in the confirmed 1GK–3DEF–1MID–1FWD formation. Empty league
tables and incomplete squads have explicit placeholder states rather than
misleading values.

The `/admin/home-page` route allows an authenticated administrator to update
the team description. It is stored in a dedicated singleton `TeamProfile`
record and seeded with the original site introduction when the migration is
applied.

The Team Profile API provides:

- `GET /api/team-profile` — return the public team description
- `GET /api/admin/team-profile` — return the editable team description (administrator)
- `PUT /api/admin/team-profile` — update the team description (administrator)

## Player profiles and squad management

The public website provides a routed home page, a current-squad list grouped
into keepers, defenders, midfielders, and attackers, and a separate historical
player archive. Active and historical players have individual profile URLs
showing their description, picture, available season records, and recorded
career totals. Historic seasons with no attendance data show games played as
**Not recorded** rather than `0`.

The `/admin` route allows an authenticated administrator to create and edit
profiles, replace or remove pictures, select playable positions, and move
players in or out of the active squad. Every player has one primary formation
position and may have up to three unique additional positions. The primary
position alone controls placement and the transactional active-squad limits:
one goalkeeper, three defenders, one midfielder, and one forward. Inactive
historical players may retain an unknown primary position until an
administrator completes their profile; a primary position is required before
activation. Inactive players remain available to administrators but are not
included in the Home formation or player account claims. Their public summary
and profile statistics remain available through the historical archive.

Profile pictures are uploaded through the API to Cloudinary. Uploads accept
JPEG, PNG, or WebP files up to 5 MB and are cropped to an 800 × 800 square.
Only the delivery URL is public; the Cloudinary public ID is retained in the
database so replaced and removed images can be deleted safely.

The player API provides:

- `GET /api/players` — list the active squad and historical-player archive
- `GET /api/players/:playerId` — return an active or historical player and season statistics
- `GET /api/admin/players` — list active and inactive players (administrator)
- `POST /api/admin/players` — create a player using multipart form data
- `PUT /api/admin/players/:playerId` — update a player using multipart form data

## Season and statistics management

The `/admin/statistics` route allows an authenticated administrator to create
and edit seasons and to add or update each player's totals for an untracked
historical season.
Making a season current replaces the previous current season atomically, and
the current season cannot be left unset.

Each season records whether games played is tracked. Seasons through Summer
2026 keep that setting disabled, require `PlayerSeasonStat.gamesPlayed` to
remain `null`, and display **Not recorded**. An administrator can enable
tracking explicitly when creating the following season. Tracked seasons use
the per-game records entered at `/admin/games`: selecting a participant adds
one appearance, and season goals, assists, and clean sheets are calculated
from those records instead of editable aggregate rows. Walkovers do not accept
per-game player statistics.

The administration API provides:

- `GET /api/admin/seasons` — list seasons
- `POST /api/admin/seasons` — create a season
- `PUT /api/admin/seasons/:seasonId` — edit or make a season current
- `GET /api/admin/players/:playerId/season-stats` — list a player's statistics
- `POST /api/admin/players/:playerId/season-stats` — add or update a season's statistics

### Historical statistics import

`npm run stats:import` reads the approved historical dataset and produces a
preview without changing the database. It reports existing profile matches,
including the Broomhead/Broom alias, and the inactive historical profiles it
would create. After checking the preview against the intended database, apply
the same import explicitly:

```bash
npm run stats:import -- --apply
```

The command uses `DATABASE_URL`, can be run repeatedly without duplicating
records, and refuses ambiguous player or season matches. It also refuses to
convert Summer 2026 if per-game statistics already exist. Games played is
never estimated for imported seasons.

## Current league standings

The public `/standings` route displays the current season’s complete league
table in position order, including Played, Won, Drawn, Lost, GF, GA, GD,
Points, and Walkovers. The 24 Hour Party People row is highlighted, and the
snapshot’s update time is displayed in Sheffield local time.

The table is refreshed from Powerleague daily and can also be refreshed from
`/admin/standings`. That page retains its complete-table editor as the manual
fallback. A successful automated refresh replaces only the current season’s
snapshot and synchronises team fixtures and previously unseen results in one
transaction. A failed refresh records its reason, preserves all cached data,
and displays a warning rather than disrupting the public pages.

Every standings snapshot requires unique positions and club names, includes
24 Hour Party People, and validates that played games match the combined
results and that walkovers do not exceed games played. Goal difference is
validated against GF and GA. Powerleague does not identify walkovers in its
table markup, so automated rows use zero until an administrator corrects them.

The standings API provides:

- `GET /api/standings/current` — return the public current-season snapshot
- `GET /api/admin/standings` — return the editable current snapshot (administrator)
- `PUT /api/admin/standings/current` — atomically replace the current snapshot (administrator)
- `POST /api/admin/scrape/refresh` — refresh Powerleague data immediately (administrator)

## Club history

The public `/club-history` route displays the club's finalised season records,
newest first. Each row identifies 24 Hour Party People and includes Position,
Played, Won, Drawn, Lost, GF, GA, GD, Points, and Walkovers.

The `/admin/club-history` route lets an authenticated administrator finalise an
ended season by copying the saved 24 Hour Party People standings row into the
permanent club history. Only seasons from the application's attendance-tracked
launch period onward are eligible, and a complete saved team standing is
required. Finalisation is transactional and can happen only once per season;
finalised records cannot be edited through the website.

The club history API provides:

- `GET /api/club-history` — list finalised public club-history records
- `GET /api/admin/club-history` — list finalised records and eligible ended seasons (administrator)
- `POST /api/admin/club-history/:seasonId/finalise` — finalise an ended season from its saved standing (administrator)

## Game results and history

The public `/games` route displays every recorded result in reverse
chronological order. League and cup games remain separate records, so a league
walkover and the cup game played instead can both appear on the same date.

The `/admin/games` route lets an authenticated administrator record a result
against an available scheduled fixture or enter a game manually. Manual games
reuse an existing opponent when its name matches without regard to letter
case. Normal results require non-negative scores; league walkovers keep scores
blank and may include a reason. After a league walkover is saved, the form
prefills a separate cup result with the same season, opponent, and date.

Saving a normal league result displays a standings-refresh warning so an
administrator can run the Powerleague refresh immediately instead of waiting
for the next daily job.

For a non-walkover result in a games-tracked season, the same page lets the
administrator select every participating player and assign their goals,
assists, and clean sheet. The total player goals and assists cannot exceed the
team score, and a clean sheet can be selected only when the opposition scored
zero.

The game API provides:

- `GET /api/games` — list public game history
- `GET /api/admin/games/fixtures` — list scheduled fixtures available for result entry
- `GET /api/admin/games/player-stats` — list tracked games, players, and saved contributions
- `POST /api/admin/games` — record a fixture-based or manual result
- `PUT /api/admin/games/:gameId/player-stats` — replace a game's player contributions

## Upcoming fixtures

The public `/fixtures` route lists scheduled games from the current Sheffield
date onward, ordered by fixture date and optional kick-off time. Dates and
times are treated as Sheffield local wall-clock values and are not shifted for
the viewer's timezone. Each fixture shows its competition, opponent, season,
and venue when available.

Powerleague fixtures are cached automatically. The `/admin/fixtures` route
remains the manual fallback: an authenticated administrator can add or correct
a fixture before its result is recorded. Manual fixtures take precedence over
matching scraped entries. Played and walkover fixtures remain visible but
read-only so historical results cannot be silently changed; fixture deletion
and cancellation are not included.

The fixture API provides:

- `GET /api/fixtures/upcoming` — list public upcoming scheduled fixtures
- `GET /api/admin/fixtures` — list all fixtures (administrator)
- `POST /api/admin/fixtures` — create a manual fixture (administrator)
- `PUT /api/admin/fixtures/:fixtureId` — correct a scheduled fixture (administrator)

## Local development

### Prerequisites

- Node.js 24.x
- npm 11
- Docker with Docker Compose
- Python 3.13

Install dependencies and generate the Prisma client:

```bash
npm install
```

Create the Python environment and install the pinned scraper dependencies:

```bash
python3.13 -m venv .venv
.venv/bin/python -m pip install -e './scraper[test]'
```

Start PostgreSQL:

```bash
npm run db:up
```

Apply development migrations after the database is running:

```bash
npm run db:migrate
```

Copy `server/.env.example` to `server/.env`; add the Cloudinary credentials and
replace `ADMIN_SETUP_KEY`, `SCRAPER_SERVICE_KEY`, and `CRON_SECRET` with three
different long random secrets. The remaining local values match the Docker and
scraper services. For example, each secret can be generated with:

```bash
openssl rand -base64 32
```

Run the scraper, API, and client in separate terminals:

```bash
npm run dev:scraper
```

```bash
npm run dev:server
```

```bash
npm run dev:client
```

The website runs at `http://localhost:5173`, the API at
`http://localhost:3000`, and the private local scraper at
`http://localhost:8001`. The scraper reads its local service key from
`server/.env`; browser code must never call it directly.

React Router uses browser-history URLs. Production hosting must rewrite
non-API routes such as `/players/:playerId`, `/standings`, `/fixtures`,
`/games`, `/admin`, `/admin/statistics`, `/admin/standings`,
`/admin/fixtures`, and `/admin/games` to the client `index.html` so direct
links and refreshes work. `vercel.json` provides this fallback after routing
`/api` requests to the Express Function.

Stop the local database service with:

```bash
npm run db:down
```

## Quality checks

`npm test` automatically creates an isolated PostgreSQL test database on local
port `55432`, applies all migrations, runs the client, server, and Python
scraper suites, and removes the test container afterwards. It does not modify
development data.

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check
npm audit
```

## Versioning

The project follows semantic versioning from its initial `0.1.0` foundation.
Release history is recorded in [CHANGELOG.md](CHANGELOG.md), with the detailed
versioning process defined in [AGENTS.md](AGENTS.md).
