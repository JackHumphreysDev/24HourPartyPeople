# AGENTS.md — Building the Project

We are building the app described in `docs/PROJECT-SPEC.md` together, from
scratch, as a real project. Follow the rules below on every response,
whether I'm asking for help via Chat, inline suggestions, or the coding
agent.

Full stack/data-model/feature spec: see `docs/PROJECT-SPEC.md`. Always
check that file (and the existing repo structure/config files) before
proposing or writing code, so you match whatever ORM, test runner, and
conventions are already in place rather than introducing a second pattern.

## Build approach

- Build and implement the work directly. Don't break tasks into small
  teaching steps, don't withhold solutions waiting for me to attempt them
  first, and don't pause to check my understanding — move through the work
  continuously.
- Work through a feature to completion (code, tests, fixes) in one
  continuous pass, only pausing at the checkpoints listed under "Where to
  stop" below.
- Recommend the simplest appropriate solution; don't add patterns,
  abstractions, frameworks, or infrastructure without a clear reason.
  Whenever a choice of pattern, abstraction, framework, or infrastructure
  comes up — however small it seems — stop, lay out the options and
  trade-offs, and let me decide rather than picking one yourself. This is
  a required pause, same tier as the git/PR/documentation checkpoints
  below.
- If you hit a genuine blocker (missing info, ambiguous requirement,
  something the spec flags as an open decision), stop and ask — otherwise
  keep going.

## Debugging

Fix issues directly as you find them. Briefly note what went wrong and why
if it's non-obvious or worth remembering, but don't turn it into a
step-by-step lesson unless I ask a question about it.

## Where to stop (the only required pauses)

Everything else runs continuously; these are the checkpoints where you
stop and hand control back to me: git commands/branches, commits, PRs/
merges, documentation, versioning, and — per the note above — any pattern,
abstraction, framework, or infrastructure decision.

### Git commands & branches
- Keep `main` stable. Real feature/fix work happens on branches.
- Before starting new work: name the task, say whether a new branch is
  warranted, and if so give the branch name, what it's created from, and
  the exact command — then stop and let me run it (or ask me to run it) rather
  than running git commands yourself unprompted.
- Naming convention: `feature/...`, `fix/...`, `refactor/...`, `docs/...`.
- Don't create a branch for every tiny step — one branch per coherent
  feature/fix.

### Commits
- Don't commit for every tiny step. Several meaningful commits within a
  branch (roughly 2–5, as a guideline, not a rule). No commits for trivial
  actions (empty files, typo fixes right after making them, renames with
  no real refactor).
- When a logical chunk of work is done: stop, tell me it's ready to
  commit, and suggest a conventional commit message (`feat:`, `fix:`,
  `test:`, `refactor:`, `docs:`) and why it fits. I make the commit myself
  unless I ask you to.

### Pull requests & merges
- When a full feature is done: stop, help me review the diff and confirm
  tests pass, help me write a PR title/description, and have me merge it
  myself when appropriate. Don't skip straight from code to merge, and
  don't merge or push without me confirming.

### Versioning

The project is versioned from the very start — the initial infrastructure
setup is `0.1.0`, not "unversioned until v1." Every major change afterwards
bumps the version, not just feature work.

- **Scheme:** semantic versioning, `MAJOR.MINOR.PATCH`.
  - **MAJOR** (`x.0.0`) — breaking changes to the stack or data model
    (e.g. swapping ORM, changing DB engine, changing the scraping approach,
    a schema change that isn't backward compatible).
  - **MINOR** (`0.x.0`) — a new feature/tab shipped end-to-end.
  - **PATCH** (`0.0.x`) — bug fixes, small non-breaking tweaks, chores.
- **`0.1.0` is reserved for initial setup:** repo scaffold, stack wired up
  (frontend boots, backend responds, DB connects via the chosen ORM),
  before any feature work is built. Record it in the changelog once it's
  actually done — don't backdate it before the infra genuinely works
  end-to-end.
- **Single source of truth:** the version lives in `package.json`
  (`"version"`) and is mirrored in `CHANGELOG.md` at the repo root and in
  the changelog table in `docs/PROJECT-SPEC.md`. Don't let these drift —
  updating them is part of the same PR that bumps the version, not a
  follow-up task.
- **When to bump:** once per PR merge to `main`, not per commit. A feature
  branch with several commits bumps the version exactly once, at the point
  it's ready to merge.
- **Stop and confirm at the PR/merge checkpoint:** which part (major/
  minor/patch) the change should bump is decided together, same as the
  commit message and PR description — not picked silently. Tag the merge
  commit with the new version (e.g. `git tag v0.2.0`) as part of that same
  checkpoint, then recap it (see below).
- **Flag, don't guess:** if a change is borderline (e.g. "is this schema
  tweak actually breaking?"), flag it and confirm the bump size rather than
  picking one silently.

### Documentation
- When documentation needs updating (README, `docs/PROJECT-SPEC.md`
  changes, code comments explaining a non-obvious decision, etc.), stop
  and flag what needs documenting and why before writing it, so I can
  confirm the framing rather than discovering it after the fact.

### Recap after each checkpoint

After each branch creation, commit, PR, merge, or version bump, post a
short in-chat summary written so it can be copied straight into my
OneNote for later reference — plain language, no code-block formatting
required unless a snippet is genuinely useful. Cover:

- **What just happened** — branch/commit/PR/merge/version bump, in one
  line.
- **Why** — the reasoning behind it (what problem it solves, what
  decision it reflects, or for a version bump, why it's major/minor/patch).
- **Anything decided along the way** worth remembering later (e.g. a
  pattern/framework choice made in that step, a trade-off accepted).

Keep it tight — a few lines, not a full changelog — but complete enough
that reading it back in a month explains the "why," not just the "what."

## Per-feature process (lean version)

1. **Plan** — what we're building this round, and whether it needs a new
   branch.
2. **Stop for branch** — if warranted, then recap.
3. **Build** — implement it end-to-end, including tests. Stop if a
   pattern/framework/abstraction/infrastructure choice comes up.
4. **Review** — quick summary of what was done and anything worth knowing.
5. **Stop for commit** — suggested message, I commit, then recap.
6. **Continue** — repeat for the next piece on the same branch.
7. **Stop for PR/merge** — once the feature's done, then recap.
8. **Stop for version bump** — confirm major/minor/patch, tag the merge,
   update `package.json`/`CHANGELOG.md`/spec changelog table, then recap.
9. **Stop for documentation** — if anything else needs updating as a
   result.
