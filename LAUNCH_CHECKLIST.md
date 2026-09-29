# SetupSheet launch checklist

Updated: 2026-09-28 (previous revision 2026-09-11)

This checklist separates repository-complete work from actions that require the deployed Supabase, hosting, or search-console environments.

## Repository-complete

- [x] TypeScript, ESLint, unit tests, and production build pass — and CI now runs `typecheck`, the chunk budget, and `npm audit --audit-level=high` as separate named steps.
- [x] Public Supabase reads are cached without caching viewer state.
- [x] Cache tags are split by what a mutation actually changes (`src/lib/cache-tags.ts`), so an upvote no longer invalidates the sitemap walk or the browse index.
- [x] Browse, profile, and requests-board pagination are keyset-cursored, and the browse client re-seeds its appended pages when a filter changes.
- [x] Author-aware browse search uses the RLS-safe `setup_search` view.
- [x] Setup `updated_at`, profile aggregates, search indexes, and report/deletion tables have migrations.
- [x] Most-wanted demand is a SQL aggregate (`setup_requests_most_wanted`, rolling 90-day window) instead of a client-side count over a fixed fetch window.
- [x] Setup/comment reporting intake is private to the reporter and rate-limited.
- [x] Account/data-deletion requests are user-scoped and require manual operator completion; `OPERATIONS.md` covers deleting the account's Storage objects too.
- [x] Uploaded objects are cleaned up when a submit fails, and `orphaned_setup_files()` enumerates the rest.
- [x] Privacy Policy, Terms of Use, and Community Guidelines are linked from the footer.
- [x] Canonical metadata, JSON-LD, robots, sitemap, OG images, semantic headings, and internal links are implemented. The site-wide `alternates.canonical` is gone from the root layout — each page declares its own — so not-found pages no longer advertise the homepage as their canonical.
- [x] File extension, size, and recognizable content/signature checks are implemented, and the `setup-files` bucket now also enforces a 10 MiB hard cap (`0029`) for callers that skip the Server Actions.
- [x] Non-UUID `/setups/<id>/opengraph-image` requests are refused in `src/proxy.ts` before rendering, so junk paths can no longer force a Satori render + a 24 h edge-cache entry.
- [x] Engineer, private Garage, field-test reporting, and public calibration implementation slices exist for ACC/LMU. The setup detail page now includes an “Open in Garage” CTA for those reviewed games; signed-out users retain a validated setup ID through the same-origin OAuth callback. In this worktree, all 62 Vitest files (321 tests), ESLint, TypeScript checking, production build, and `npm run build:budget` pass (38 JS/CSS chunks; 435.0 KiB gzip total). `npm audit --audit-level=high` also passes; two moderate Vitest-chain advisories remain accepted. Build logs show external font and placeholder-Supabase fetch failures, but the build completes. Configured-Supabase validation and domain review of the first-pass Engineer rule corpus remain outstanding.

## Supabase deployment

**Apply migrations before the app deploy, not after.** Migrations `0030`–`0034`
add the private Garage workflow, setup-derived Garage creation, field-test reporting,
the privacy-safe Engineer calibration view, and database audit remediation (idempotent signup
profiles, missing FK/retention indexes, cascade delete safety, and self-upvote prevention).
The app must not be deployed before these migrations are applied and verified. Apply
migrations in numeric order. If `0022` is already applied, run:

```text
0023_profile_setup_stats.sql
0024_setup_search_view.sql
0025_account_deletion_requests.sql
0026_content_reports.sql
0027_most_wanted_requests.sql
0028_setup_files_gc.sql
0029_storage_bucket_limits.sql
0030_garage_private_workflow.sql
0031_garage_start_from_setup.sql
0032_field_test_reports.sql
0033_engineer_public_calibration.sql
0034_audit_remediation.sql
```

Then verify:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'setups'
  and column_name = 'updated_at';

select extname from pg_extension where extname = 'pg_trgm';

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('account_deletion_requests', 'content_reports');

select * from public.leaderboard limit 1;
select id, author_username from public.setup_search limit 1;

-- New in this release:
select count(*) from public.setup_requests_most_wanted;
select has_function_privilege('authenticated','public.orphaned_setup_files(interval)','execute');  -- expect f
select has_function_privilege('service_role','public.orphaned_setup_files(interval)','execute');   -- expect t
select file_size_limit from storage.buckets where id = 'setup-files';                                -- expect 10485760

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'garage_sessions', 'garage_revisions', 'garage_run_plan_items', 'garage_laps',
    'field_test_reports'
  );

select table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('field_test_reports_public', 'field_test_counts', 'engineer_calibration_evidence');
```

Run the repository migration harness locally or in CI:

```bash
npm run test:db
```

GitHub Actions run `36431167843` passed all three jobs, including the PostgreSQL 16 migration
suite and Playwright E2E, on feature commit `bf22886b6dfc98a8d2e7bd9961a3a6859fa3a4bd`.
That is repository/CI validation, not a run against the configured production Supabase
project. In the current sandbox, `psql` is unavailable locally and no Supabase deployment
environment variables are configured, so a live migration/smoke test is still required.

## Deploy notes specific to this release

- **Data Cache tags were renamed** (`public-setups` → `setups-content` / `setups-counters` /
  `setups-sitemap` / `public-profiles`). Entries cached under the old tag are no longer
  invalidated by anything, so they age out on their own `revalidate` instead — 60 s for
  browse/detail/leaderboard, up to 1 h for the sitemap. No purge is required; expect at most
  an hour of staleness on `/sitemap.xml` right after the deploy.
- **OG images are CDN-cached for 24 h per URL.** Setup card URLs now carry a `?v=<updatedAt>`
  token, so edited setups get a fresh card, but previously-shared junk URLs (and any stale
  card) stay cached at the edge until they expire — a CDN purge is the only way to clear them
  sooner.
- `/setups/<junk>` still returns HTTP 200 with a "not found" body. Next cannot set the status
  from a Server Component while the root layout streams, so the crawler-facing contract is
  `noindex, nofollow` (verified in the built output: no canonical, and the OG route 404s).
- Production dependency tree is clean (`npm audit --omit=dev` → 0). Two moderate advisories
  remain in the vitest chain and are accepted, not ignored: the fix is a vitest major (5.x),
  which does not belong in a release PR. Revisit right after launch.

## Hosting and security operations

- [ ] Deploy the current branch and confirm the environment contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Turn on Dependabot for the repo (`.github/dependabot.yml` is committed but the feature is off: `GET /dependabot/alerts` returns "Dependabot alerts are disabled for this repository"), and enable code scanning or accept the gap in writing.
- [x] GitHub Actions run `36431167843` on feature commit `bf22886` passed all three jobs: `lint-test-build`, `e2e`, and `db-migrations`.
- [ ] Confirm branch protection requires those three checks before merging to the default branch; the CI pass does not verify repository protection settings.
- [ ] Configure shared edge/WAF limits for uploads, Server Actions, anonymous download-counter traffic, and repeated auth failures. (Application-level upload target rate limiting is implemented in `createUploadTarget` at 30 requests/user/hour, alongside database triggers in `0021` for `setups`/`setup_comments`/`setup_requests`.)
- [ ] Configure upload quarantine/malware scanning if arbitrary community files are accepted at scale.
- [ ] Replace repository-based privacy contact language with a monitored legal/privacy contact.
- [x] Define an operator SLA and procedure for `account_deletion_requests` and `content_reports` (documented in `OPERATIONS.md`).
- [x] Schedule / automate `public.orphaned_setup_files()` — automated CLI sweep tool created at `scripts/sweep-orphaned-files.mjs` (`npm run storage:sweep`).
- [x] Document backup/restore and migration rollback policy (documented in `OPERATIONS.md`).
- [ ] Review the final privacy policy and terms with appropriate legal counsel.

## Browser and performance validation

- [x] Chromium is installed in CI and `npx playwright test` runs (the `e2e` job passed 14/14 in CI run `36431167843` on feature commit `bf22886`).
- [ ] Re-run Playwright locally after obtaining the Chromium binary: 3 browser-independent checks passed, while 11 browser-backed tests could not launch because Chromium is missing; `npx playwright install chromium` failed with TLS `ECONNRESET` in this sandbox.
- [ ] Run Lighthouse or PageSpeed on mobile and desktop for `/`, `/setups`, a populated `/setups/[id]`, and `/profile/[userId]`.
- [ ] Record LCP element/time, INP, CLS, TTFB, HTML/RSC size, JavaScript long tasks, and image bytes.
- [ ] Establish budgets and monitor real-user Web Vitals after launch.
- [x] Repository chunk budget command is available as `npm run build:budget`, and the budget script now also runs as its own CI step.

## Search and content validation

- [ ] Submit `https://setupsheet.app/sitemap.xml` in Google Search Console.
- [ ] Run Rich Results Test and Schema Markup Validator against a populated setup and public profile.
- [ ] Confirm canonical URLs, robots directives, sitemap URLs, and OG images on the deployed origin.
- [ ] Monitor Search Console duplicate, excluded, soft-404, and indexed-page reports — note that soft-404s for `/setups/<not-a-uuid>` are expected until a status-setting mechanism exists; watch that the count does not grow.
- [ ] Add game/car/track landing pages and setup tutorials when content growth becomes a priority.
