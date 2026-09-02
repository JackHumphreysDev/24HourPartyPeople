# Changelog

All notable changes to 24 Hour Party People are recorded here.

## [0.2.0] - 2026-09-02

### Added

- Core Prisma models and enums for users, players, seasons, statistics,
  opponents, fixtures, results, standings, and club history.
- Initial PostgreSQL migration with UUID identifiers, native date types,
  query indexes, uniqueness guarantees, and history-preserving relationships.
- Ephemeral PostgreSQL integration-test service with automatic migration and
  cleanup.
- Database tests covering player-season uniqueness, protected history, one
  result per fixture, and optional-link cleanup.

### Changed

- Clarified that the application and its specification are exclusively for
  24 Hour Party People.

## [0.1.0] - 2026-09-02

### Added

- npm workspace foundation using `client/` and `server/` website projects.
- React, Vite, and TypeScript frontend shell with a rendering test.
- Express and TypeScript API with a tested health endpoint.
- Prisma and PostgreSQL connection through a Docker Compose development
  service.
- Shared build, test, type-check, lint, formatting, and database scripts.
- Oxlint, Prettier, Vitest, Testing Library, and Supertest quality tooling.
