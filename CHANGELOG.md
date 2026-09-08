# Changelog

All notable changes to 24 Hour Party People are recorded here.

## [0.11.0] - 2026-09-08

### Added

- Private FastAPI Powerleague scraper using confirmed live page selectors for
  league standings, upcoming fixtures, and completed results.
- Automatic ingestion of standings, fixtures, and previously unseen results,
  with database-backed scrape status and a visible stale-data warning.
- Protected daily Vercel Cron refresh and an administrator-triggered refresh
  with status feedback.

### Changed

- Configure the React website, Express API, and private FastAPI scraper as
  three Vercel Services with a private service binding.
- Retain cached public data and administrator entry as fallbacks when live
  scraping is unavailable or the upstream page structure changes.

## [0.10.0] - 2026-09-08

### Added

- Public Home page team hub with the current league position and active squad
  arranged in the confirmed responsive 1GK–3DEF–1MID–1FWD formation.
- Dedicated `TeamProfile` record, public API, and protected
  `/admin/home-page` editor for the team description.
- Up to three unique additional playable positions per player, displayed on
  public squad cards and player profiles.

### Changed

- Treat each player's primary position as their sole formation assignment and
  capacity constraint while keeping additional positions informational.
- Add explicit empty standings, empty squad, and vacant formation-place states
  to the Home page.

## [0.9.0] - 2026-09-08

### Added

- Public club history at `/club-history`, showing finalised season records in
  reverse chronological order with the club's full league-table totals.
- Protected club-history management at `/admin/club-history`, including
  eligible ended-season guidance and explicit one-time finalisation from the
  saved 24 Hour Party People standing.
- Public and administrator club-history APIs with authenticated,
  transactional finalisation and integration coverage.

### Changed

- Restrict club-history finalisation to ended, attendance-tracked seasons with
  a saved team standing, and keep finalised records immutable through the site.
- Standardise project-owned documentation, user-facing text, API names, code
  identifiers, tests, and the club-history database field on UK English.

## [0.8.1] - 2026-09-08

### Added

- Production deployment at `https://24-hour-party-people.vercel.app`, with
  Vercel CDN hosting for the Vite website and a London-hosted Express Function.
- Neon PostgreSQL provisioned through Vercel Marketplace, using a pooled
  runtime connection and a direct connection for build-time migrations.
- Vercel routing for Express API requests and React Router deep links.

### Changed

- Pin production to Node.js 24.x and fail deployment early when required
  database credentials are missing.
- Trust Vercel's first proxy in production and avoid enabling cross-origin
  access by default on the same-origin deployment.
- Document the production architecture, required secrets, migration workflow,
  and live website address.

## [0.8.0] - 2026-09-07

### Added

- Public current-season league standings at `/standings`, including all
  recorded columns, team highlighting, and a visible last-updated timestamp.
- Protected full-table standings management at `/admin/standings` as the
  manual fallback while automatic Powerleague scraping remains unconnected.
- Public and administrator standings APIs with authentication, validation,
  atomic snapshot replacement, and integration coverage.

### Changed

- Calculate goal difference on the server and require unique clubs and
  positions, consistent played/result totals, valid walkover counts, and a
  24 Hour Party People row in every saved snapshot.
- Preserve standings for historic seasons when replacing the current-season
  table.

## [0.7.0] - 2026-09-07

### Added

- Public upcoming fixtures at `/fixtures`, with league/cup labels, optional
  Sheffield-local kick-off times, season details, and venues.
- Protected fixture management at `/admin/fixtures` for adding manual fixtures
  and correcting scheduled fixtures before results are recorded.
- Public and administrator fixture APIs with date-range validation,
  case-insensitive opponent reuse, duplicate prevention, and integration
  coverage across the API and browser workflows.

### Changed

- Kept played and walkover fixtures visible but read-only in administration so
  recorded history cannot be changed through fixture corrections.

## [0.6.0] - 2026-09-07

### Added

- Public chronological game history at `/games`, keeping league and cup
  results as separate entries when they occur on the same date.
- Protected result entry at `/admin/games` for scheduled fixtures and manual
  league or cup games.
- A guided walkover workflow that records a scoreless league walkover and
  prepares a separate cup result for the same date and opponent.
- Transactional fixture completion, case-insensitive opponent reuse, result
  validation, and integration coverage across the API and browser workflows.

### Changed

- Flagged non-walkover league results as requiring a standings refresh while
  the Powerleague scraper remains unconnected.

## [0.5.0] - 2026-09-07

### Added

- Protected season creation and editing APIs and an administrator website
  workflow at `/admin/statistics`.
- Administrator player-statistics entry and editing for active and inactive
  players, with automatic updates to public player profiles.
- A season-level `tracksGamesPlayed` field and migration so historic missing
  attendance remains distinct from a recorded value of zero.
- Integration coverage for administrator access, season rollover rules,
  historical attendance handling, validation, and statistics upserts.

### Changed

- Enforced exactly one current season throughout administrator workflows,
  switching seasons within serializable database transactions.
- Required non-negative whole-number statistics and required games played only
  for seasons in which attendance was recorded.

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
  player visibility, authorisation, uploads, and image lifecycle behaviour.

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
  authentication and administrator authorisation middleware.
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
