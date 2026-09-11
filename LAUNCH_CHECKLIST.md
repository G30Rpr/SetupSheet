# SetupSheet launch checklist

Updated: 2026-09-11 (re-dated at each audit; previous revision 2026-08-28)

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

## Supabase deployment

**Apply migrations before the app deploy, not after.** The deploy is safe either way (a
missing `setup_requests_most_wanted` view degrades to "no Most wanted panel"), but the
feature would be silently absent, so treat this as the first step of the release:

Apply migrations in numeric order. If `0022` is already applied, run:

```text
0023_profile_setup_stats.sql
0024_setup_search_view.sql
0025_account_deletion_requests.sql
0026_content_reports.sql
0027_most_wanted_requests.sql
0028_setup_files_gc.sql
0029_storage_bucket_limits.sql
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
```

Run the repository migration harness locally or in CI:

```bash
npm run test:db
```

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
- [ ] Require the `lint-test-build`, `e2e`, and `db-migrations` checks before merging to the default branch — PR #4 merged with two of them failing.
- [ ] Configure shared edge/WAF limits for uploads, Server Actions, anonymous download-counter traffic, and repeated auth failures. (There is still no server-side per-user *upload* rate limit; `0021` covers `setups`/`setup_comments`/`setup_requests` inserts only.)
- [ ] Configure upload quarantine/malware scanning if arbitrary community files are accepted at scale.
- [ ] Replace repository-based privacy contact language with a monitored legal/privacy contact.
- [ ] Define an operator SLA and procedure for `account_deletion_requests` and `content_reports` (see `OPERATIONS.md`).
- [ ] Schedule `public.orphaned_setup_files()` — today the sweep exists as a query, not a job.
- [ ] Document backup/restore and migration rollback; until then take a `pg_dump` before any destructive operator step.
- [ ] Review the final privacy policy and terms with appropriate legal counsel.

## Browser and performance validation

- [x] Chromium is installed in CI and `npx playwright test` runs (the `e2e` job; it passed on this branch — 14/14).
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
