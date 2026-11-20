# Contributing to SetupSheet

Use Node.js 24.x, matching `.nvmrc`, CI and the Vercel project runtime. Install
the committed dependency tree with `npm ci`; keep dependency updates separate
from unrelated behavior changes.

## Local application work

```bash
nvm use
npm ci
cp .env.local.example .env.local
npm run dev
```

Use a separate non-production Supabase project for local and Preview work.
Populate the example's public URL and anon/publishable key locally. Never put a
service-role key, database URI, OAuth secret or user export in a commit, issue,
PR, screenshot or browser-exposed `NEXT_PUBLIC_` variable.

## Validation

Run the checks relevant to the change and record their results in the PR:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run typecheck:edge
npm run test
npm run build:budget
```

- `npm run format` applies the pinned Prettier rules. The pre-commit hook also
  runs ESLint/Prettier on supported staged files; CI checks the full tree.
- Edge entrypoints use the pinned Deno runtime and frozen function lockfile.
  Next.js typechecking excludes the Deno entrypoint; `typecheck:edge` checks it
  and CI runs both checks. See `docs/storage-lifecycle.md` for isolated testing.
- Unit tests live under `src/` and `scripts/` with `.test.ts`, `.test.tsx` or
  `.test.mjs` names. Add regression coverage for changed security/data behavior.
- Browser tests live in `e2e/`. Run `npx playwright install chromium`, then
  `npm run test:e2e`. The configured server uses port 3000.
- CI deliberately uses an unreachable placeholder Supabase URL for application
  tests. A green browser run does not establish successful real Auth/Storage
  integration, RLS isolation or production availability.
- Formatting-only work should compare with formatter output and avoid unrelated
  logic edits. Documentation-only changes do not need new unit tests.

## Disposable SQL tests

`npm run test:db` requires Bash, Node and `psql` plus a dedicated disposable
PostgreSQL instance. CI uses PostgreSQL 16; the repair rehearsal also covers 17.
The harness creates/drops a scratch database and mutates fixture data. Never
point or tunnel its local test port to a production or shared backend.

One local Docker setup, using a test-only password:

```bash
docker run --rm --name setupsheets-local-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 127.0.0.1:5432:5432 -d postgres:17-alpine
docker exec setupsheets-local-postgres pg_isready -U postgres
```

Wait until `pg_isready` reports that it is accepting connections, then run:

```bash
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres npm run test:db
docker stop setupsheets-local-postgres
```

The client needs `psql` installed separately. The shared guard accepts only
loopback client destinations and the generated scratch database name; it
refuses hostaddr/service overrides and invalid ports. `psql -X` ignores startup
files. Standalone concurrency/drift helpers use the same guard. These checks
reduce accidental targeting; they do not attest what a forwarded local port
connects to or replace isolation of the PostgreSQL instance.

Keep successful authorized operations and anonymous/cross-user denials in SQL
regressions. Check the expected denial reason rather than accepting any database
error as proof that authorization works.

## Database changes and release boundaries

- Read [migration release controls](docs/migration-release-controls.md) before
  changing migrations or deployment scripts.
- Inspect `supabase migration new --help`, then use `supabase migration new
descriptive_name` to allocate a unique timestamped migration. Do not modify an
  already-applied migration to repair hosted drift.
- Put regression SQL under `supabase/testing/`. The vanilla PostgreSQL shim
  exercises SQL behavior; it is not a complete managed Supabase environment.
- New migrations use the deployment runner's transaction. Do not embed
  `BEGIN`/`COMMIT` in pending migration files; individual files are atomic, while
  the full batch is not.
- A PR merge is not approval to apply hosted SQL or promote the application.
  Validate the combined pending batch and old/new application compatibility,
  verify branch/Environment protections, then obtain approval for the exact
  production release SHA. Carry the recorded recovery-risk decision into that
  approval; skipped recovery verification is not a completed restore test.
- After an authorized release, verify hosted permissions and application
  behavior. An application rollback does not undo SQL.

## Reviewable pull requests

Describe the concrete problem, resulting behavior and validation. Name any
remaining limitation or hosted verification separately. Keep security repairs,
dependency upgrades and formatting baselines independently reviewable.

Never attach credentials or database/user exports as evidence. Use sanitized
test results, file/line references, run URLs and non-sensitive catalog checks.
