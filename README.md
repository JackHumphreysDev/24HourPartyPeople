# 24 Hour Party People

## Project purpose

24 Hour Party People is a website for a 6-a-side football team competing in
the BoohooMAN Sheffield Tuesday League at Norton Playing Fields 3G. It will
bring player profiles, statistics, fixtures, results, league standings, and
club history together in one team hub.

The current `0.1.0` release is the project foundation. It contains the
frontend, API, database connection, and development tooling, but no product
features yet. See [the project specification](docs/PROJECT-SPEC.md) for the
planned functionality.

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
