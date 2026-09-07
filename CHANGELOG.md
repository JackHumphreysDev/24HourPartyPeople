# Changelog

All notable changes to 24 Hour Party People are recorded here.

## [0.4.0] - 2026-09-07

### Added

- React Router navigation with public home, squad, and individual player
  profile pages plus a protected administrator route.
- Public player APIs with current and historic season statistics and recorded
  career totals.
- Administrator player creation, editing, deactivation, and picture-management
  APIs and browser workflows.
- Cloudinary-backed JPEG, PNG, and WebP uploads with an 800 × 800 transform,
  a 5 MB limit, and cleanup when pictures are replaced or removed.
- A migration for private Cloudinary public IDs and integration coverage for
  player visibility, authorization, uploads, and image lifecycle behaviour.

### Changed

- Made the team website public while keeping management features behind
  administrator authentication.
- Enforced the confirmed 1 GK, 3 DEF, 1 MID, and 1 FWD active-formation limits
  with serializable database transactions.
- Rendered missing historic games-played values as “Not recorded” and limited
  overall games-played totals to seasons where attendance was recorded.

## [0.3.0] - 2026-09-02

### Added

- One-time administrator account setup and browser sign-in experience.
- Register, login, logout, and current-user API endpoints with reusable
  authentication and administrator authorization middleware.
- Database-backed, seven-day sessions storing SHA-256 hashes of opaque tokens.
- Session migration, request validation, authentication rate limiting, and
  coverage for password, session, and role boundaries.

### Security

- Passwords are protected with salted scrypt hashes and timing-safe checks.
- Session cookies are `HttpOnly` and `SameSite=Lax`, with `Secure` enabled in
  production; failed logins use a generic response for known and unknown
  email addresses.

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
