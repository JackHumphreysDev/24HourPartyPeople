# 24 Hour Party People

## Project purpose

24 Hour Party People is a website for a 6-a-side football team competing in
the BoohooMAN Sheffield Tuesday League at Norton Playing Fields 3G. It will
bring player profiles, statistics, fixtures, results, league standings, and
club history together in one team hub.

The current `0.2.0` release includes the project foundation and core football
data model. The user-facing product features are still to be built. See
[the project specification](docs/PROJECT-SPEC.md) for the planned
functionality.

## Technology stack

- **Frontend:** React, Vite, and TypeScript
- **Backend:** Node.js, Express, and TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
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

If custom local settings are needed, copy `server/.env.example` to
`server/.env` and edit the copied values. The defaults already match the
Docker service.

Run the API and client in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

The website runs at `http://localhost:5173`. The API runs at
`http://localhost:3000`, with its health endpoint at `/api/health`.

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
