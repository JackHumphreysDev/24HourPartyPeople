# 24 Hour Party People

## Project purpose

24 Hour Party People is a website for a 6-a-side football team competing in
the BoohooMAN Sheffield Tuesday League at Norton Playing Fields 3G. It will
bring player profiles, statistics, fixtures, results, league standings, and
club history together in one team hub.

The current `0.6.0` release includes the project foundation, core football
data model, secure administrator authentication, routed player profiles,
administrator squad management, and season-by-season player-statistics
management. Administrators can also record league, cup, and walkover results,
which appear in public game history. The remaining team-hub features are still
to be built. See [the project specification](docs/PROJECT-SPEC.md) for the
planned functionality.

## Technology stack

- **Frontend:** React, React Router, Vite, and TypeScript
- **Backend:** Node.js, Express, and TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Image storage:** Cloudinary
- **Testing:** Vitest, Testing Library, and Supertest
- **Linting and formatting:** Oxlint and Prettier
- **Package management:** npm workspaces

This is a browser-based website. The repository does not contain a native
mobile application.

## Project structure

- `client/` — React website
- `server/` — Express API, Prisma configuration, and server tests
- `docs/` — full product and engineering specification
- `compose.yaml` — local PostgreSQL service
- `AGENTS.md` — project workflow and collaboration rules

Hosting-specific files such as a Vercel API adapter will be added only after
the production hosting approach is confirmed.

## Core data model

The Prisma schema defines users, players, seasons, player season statistics,
opponents, fixtures, game results, live standings, and finalized club history.
The initial migration is stored in `server/prisma/migrations/`.

Database relationships preserve historical football records. Players are
deactivated rather than deleted once statistics reference them, while optional
account and fixture links are cleared without deleting their user or result.
Business rules such as exactly one current season, valid formation limits,
non-negative statistics, and walkover score handling are enforced by the
application features that write those records.

## Authentication

The first account is created through the one-time administrator setup screen.
Set a long, random `ADMIN_SETUP_KEY` in `server/.env`, open the website, choose
**Set up administrator**, and enter that same key. Registration closes as soon
as the first account has been created; public player registration is not yet
available.

Passwords are stored as salted scrypt hashes. Successful registration and
login create a random, revocable seven-day session whose SHA-256 token hash is
stored in PostgreSQL. The browser receives only the opaque token in an
`HttpOnly`, `SameSite=Lax` cookie, with `Secure` enabled in production.
Authentication attempts are rate limited, and failed logins do not reveal
whether an email address exists.

The authentication API provides:

- `POST /api/auth/register` — create the first administrator account
- `POST /api/auth/login` — sign in and start a session
- `POST /api/auth/logout` — revoke the current session
- `GET /api/auth/me` — return the currently authenticated user

## Player profiles and squad management

The public website provides a routed home page, current-squad list, and an
individual profile URL for each active player. Profiles display the player's
description and picture, current-season statistics, previous-season records,
and recorded career totals. Historic seasons with no attendance data show
games played as **Not recorded** rather than `0`.

The `/admin` route allows an authenticated administrator to create and edit
profiles, replace or remove pictures, and move players in or out of the active
squad. Active positions are transactionally limited to the confirmed
six-a-side formation: one goalkeeper, three defenders, one midfielder, and
one forward. Inactive players remain available to administrators but are not
exposed by the public API.

Profile pictures are uploaded through the API to Cloudinary. Uploads accept
JPEG, PNG, or WebP files up to 5 MB and are cropped to an 800 × 800 square.
Only the delivery URL is public; the Cloudinary public ID is retained in the
database so replaced and removed images can be deleted safely.

The player API provides:

- `GET /api/players` — list the active squad
- `GET /api/players/:playerId` — return an active player and season statistics
- `GET /api/admin/players` — list active and inactive players (administrator)
- `POST /api/admin/players` — create a player using multipart form data
- `PUT /api/admin/players/:playerId` — update a player using multipart form data

## Season and statistics management

The `/admin/statistics` route allows an authenticated administrator to create
and edit seasons and to add or update each player's totals for any season.
Making a season current replaces the previous current season atomically, and
the current season cannot be left unset.

Each season records whether games played was tracked. Seasons from before
attendance tracking began keep that setting disabled, require
`PlayerSeasonStat.gamesPlayed` to remain `null`, and display **Not recorded**.
Seasons configured to track attendance require games played as a non-negative
whole number. This avoids turning unknown historical attendance into a
misleading zero.

The administration API provides:

- `GET /api/admin/seasons` — list seasons
- `POST /api/admin/seasons` — create a season
- `PUT /api/admin/seasons/:seasonId` — edit or make a season current
- `GET /api/admin/players/:playerId/season-stats` — list a player's statistics
- `POST /api/admin/players/:playerId/season-stats` — add or update a season's statistics

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

Saving a normal league result displays a standings-refresh warning. The
Powerleague scraper is not connected yet, so the application flags this work
instead of claiming that the live table was refreshed.

The game API provides:

- `GET /api/games` — list public game history
- `GET /api/admin/games/fixtures` — list scheduled fixtures available for result entry
- `POST /api/admin/games` — record a fixture-based or manual result

## Local development

### Prerequisites

- Node.js 24 or newer
- npm 11
- Docker with Docker Compose

Install dependencies and generate the Prisma client:

```bash
npm install
```

Start PostgreSQL:

```bash
npm run db:up
```

Apply development migrations after the database is running:

```bash
npm run db:migrate
```

Copy `server/.env.example` to `server/.env`, replace `ADMIN_SETUP_KEY` with a
long random secret, and add the Cloudinary cloud name, API key, and API secret
for profile-picture uploads. The remaining defaults match the Docker service.
For example, a setup key can be generated with:

```bash
openssl rand -base64 32
```

Run the API and client in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

The website runs at `http://localhost:5173`. The API runs at
`http://localhost:3000`, with its health endpoint at `/api/health`.

React Router uses browser-history URLs. Production hosting must rewrite
non-API routes such as `/players/:playerId`, `/games`, `/admin`,
`/admin/statistics`, and `/admin/games` to the client `index.html` so direct
links and refreshes work. The exact rewrite will be added with the hosting
configuration once the production host is confirmed.

Stop the local database service with:

```bash
npm run db:down
```

## Quality checks

`npm test` automatically creates an isolated PostgreSQL test database on local
port `55432`, applies all migrations, runs the client and server suites, and
removes the test container afterward. It does not modify development data.

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
