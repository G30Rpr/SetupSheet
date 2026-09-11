# SetupSheet — Full Audit

**Date:** 2026-09-10 (supersedes the 2026-08-28 report; that revision is in git history at `ff0920d`)
**Scope:** entire repository — `src/` (14,207 LOC app code, 27 unit test files), `supabase/migrations/*.sql` (26 migrations, 1,755 LOC), `supabase/testing/*.test.sql`, `e2e/` (14 Playwright tests), `.github/workflows/ci.yml`, config, and docs.
**Method:** static review of every source file, dependency audit, unit/lint/typecheck/build execution, **live production-server probing** (`next start` + direct HTTP inspection), and a claim-by-claim re-verification of the previous audit.
**Not executed here (environment limits, not skipped):** `npm run test:db` (no `psql`/docker in the sandbox), `npm run test:e2e` (no Chromium), and any real-Core-Web-Vitals measurement (no deployed URL). Those remain open gates, not passed checks.

---

## 1. Verdict

SetupSheet is a genuinely well-built Next.js 16 / Supabase app: the RLS model is layered (row + column grants), PostgREST input is constrained, CSP is nonce-based, there are no third-party scripts, and no `select("*")` on public readers. **It is not a "done, just deploy" state.** This pass found defects the last audit missed or that have since regressed:

| Severity | Count | Headline |
|---|---|---|
| Critical | 4 | soft-404 + unbounded OG-image oracle; unbounded/orphaned Storage uploads; dependency-vulnerability regression with no CI gate; SQL layer still never executed |
| High | 4 | cache-tag thrash from counters; "Most wanted" reads the *oldest* 500; requests board silently truncates; uploaded files survive account deletion |
| Medium | 8 | `.vbo` uploads rejected; orphan objects on failed submit; layout blocks first paint on notifications; 500-row "load more" pages; anon download-counter RPC; no username uniqueness; thin test coverage on the riskiest files; stale docs |
| Low | 9 | OG-image CDN staleness, dead fields, duplicated helpers, `NOT VALID` never validated, etc. |

### What actually ran (evidence)

| Command | Result |
|---|---|
| `npm ci` | 535 packages installed; **`4 vulnerabilities (3 moderate, 1 high)`** |
| `npm run lint` | pass, no warnings |
| `npx tsc --noEmit` | pass, 0 errors |
| `npx vitest run` | **27 files / 134 tests passed** (6.5 s) |
| `npm run build` | pass; **23 routes** — 19 dynamic (`ƒ`) and 4 static (`○`: `icon.svg`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml`), all HTML routes dynamic because the root layout reads `headers()`/`cookies()` |
| `node scripts/check-performance-budget.mjs` | pass — 36 chunks, 402.9 KiB gzip, largest 71.5 KiB |
| `npm run build:budget` | pass (build + budget) |
| `npx next start -H 0.0.0.0` + `curl` | 200s, headers/CSP/nonce, `?code=` forward, 404 behaviour — see §2 |
| `npm run test:db` | **not runnable** (no `psql`); CI's `postgres:16` job is still the only SQL gate |
| `npm run test:e2e` | **not runnable** (no Chromium); `--list` discovery only |

### Corrections to the 2026-08-28 report

Three of its "verified" statements are now false or were never true:

1. *“`npm audit --audit-level=high`: 0 vulnerabilities after the … overrides”* → today the same lockfile reports **4, one high** (§2.3). Nothing was upgraded; new advisories landed against already-pinned versions, and no CI job runs `npm audit`, so the claim could not stay true.
2. *“proper `notFound()` paths are implemented”* → `notFound()` is called and renders correctly, **but the HTTP status is 200**, measured live (§2.1).
3. *“Phase 3.3 … the 500-row client index remains the separate payload opportunity”* framed the browse index as only a payload problem; it is also a **correctness** problem — the expansion cursor is never reset when filters change, and each “load older” click fetches another 500 hydrated rows (§4.3).

Its remaining claims (public/private cache separation, viewer state never cached, explicit projections, CSP + escaped JSON-LD, keyset cursors, bounded metadata descriptions) were re-checked and **do hold**.

---

## 2. Critical — fix before launch

**Not implemented in this pass.** The agreed remediation scope was §3.1–§3.4 plus
§4.1 and §4.3; all four Criticals remain open, including the soft-404 / OG-image
generator in §2.1 and the missing dependency audit gate in §2.3. Treat §2.1 and
§2.2 as the first items of the next pass.

### 2.1 Every non-existent setup/profile URL is a **soft 404**, and each arbitrary path segment is a free OG-image generator

Measured against `next start` with an unreachable project (i.e. every lookup resolves to "not found"):

```
GET /setups/not-a-uuid                          -> 200   (renders "Setup not found")
GET /setups/11111111-...-111111111111            -> 200   (renders "Setup not found")
GET /profile/not-a-uuid                          -> 200
GET /setups/not-a-uuid/opengraph-image           -> 200, image/png, 27,761 bytes,
                                                    Cache-Control: public, max-age=0,
                                                    s-maxage=86400, stale-while-revalidate=604800
GET /totally-bogus-page                          -> 404   (framework 404, as expected)
```

`src/app/setups/[id]/page.tsx:60` and `src/app/profile/[userId]/page.tsx:56` call `notFound()`, but because the root layout is dynamic and streams, the document status is already committed as 200 before the segment throws. Consequences:

* **SEO:** Google treats 200-with-not-found-copy as a soft 404; deleted setups keep their PageRank-bearing URL and pollute the crawl budget instead of dropping out. The sitemap (`/sitemap.xml`, hourly) re-advertises deleted setups until revalidation.
* **Abuse amplifier:** `src/app/setups/[id]/opengraph-image.tsx` runs a full Satori/PNG render for **any** string in `[id]` and the response is CDN-cacheable for 24 h per URL. A caller with a list of random paths can force unbounded CPU on the server and unbounded distinct cache objects at the edge. `generateMetadata` for the not-found case also emits `og:image: /setups/<arbitrary>/opengraph-image`, so unfurl bots fetch that generated image for junk URLs.

**Fix (small, three parts):**
1. **Guard the OG route in `src/proxy.ts`** — for `^/setups/([^/]+)/opengraph-image$`, if the segment is not a UUID, answer `new NextResponse(null, { status: 404 })` directly. This is the security-relevant half: it removes the render-and-cache oracle entirely (no page render, no edge cache entry, no CPU) and it also stops `getCachedSetupRowById` (`src/lib/supabase/setups.ts:184`) from allocating one `unstable_cache` entry per junk id an attacker invents.
2. **Guard the page render on shape too** — validate the id in `generateMetadata`/page and short-circuit for non-UUID input. Note the framework nuance: because the root layout is dynamic and streams, a mid-render `notFound()` cannot change an already-flushed status; Next does not expose a supported "set HTTP status from a Server Component" API in 16.3 (only `headers`/`cookies`/`draftMode` in `next/headers`). So for *valid-UUID-but-missing* rows, the honest options are (a) keep the streamed 404 UI with `noindex, nofollow` (already emitted) and accept status 200, or (b) serve `/setups/[id]` through a Route Handler-shaped path that can set the status. Pick (a) and document it, or pick (b) — but don't leave the code comment claiming "proper `notFound()` paths" as if the status were correct.
3. In `src/app/setups/[id]/page.tsx`, the not-found `generateMetadata` branch must not advertise an `og:image` (a live request proved it does: `og:image: https://setupsheet.app/setups/not-a-uuid/opengraph-image?…`), and should not emit `alternates.canonical` — it currently resolves to the site root (`<link rel="canonical" href="https://setupsheet.app">` on a not-found page), which is worse than emitting nothing.

### 2.2 Upload path is unbounded: no rate limit, no bucket limits, no cleanup

* `src/lib/actions/setups.ts:104-196` (`uploadSetupFile`, `uploadTelemetryFile`) — authenticated, size- and extension-checked, but **not rate-limited and not tied to a successful setup row**. The DB rate limits in `0021_insert_grants_and_rate_limits.sql` cover `setups`/`setup_comments`/`setup_requests` inserts only. One account can therefore POST millions of objects.
* `supabase/migrations/0004_setup_files.sql:16` creates the bucket with no `file_size_limit` and no `allowed_mime_types`, and no later migration adds them (grep: zero hits). So the 5 MB / 10 MB caps exist **only** in the Server Action; a caller hitting the Storage REST API directly with a valid session can upload up to the project default (50 MB) of any extension allowed by the `0019` filename regex, in any quantity.
* Orphan lifecycle: see §4.1 — nothing ever deletes an object whose row never materialised.

**Fix:** add a per-user upload limiter (same advisory-lock trigger pattern as `0021`, on a tiny `storage`-adjacent counter table, or a Vercel/CDN edge limit), set `file_size_limit`/`allowed_mime_types` on the bucket in a new migration, and add a nightly sweeper that deletes `setup-files` objects with no matching `setups.file_path`/`telemetry_file_path` older than 24 h.

### 2.3 Dependency vulnerabilities have crept back in, and no gate would have noticed

`npm ci` reports `4 vulnerabilities (3 moderate, 1 high)`:

| Package | Sev | Advisory |
|---|---|---|
| `browserslist` ≤4.28.6 | **high** | GHSA-c83g-rgw3-j3cx (unbounded memory growth → OOM), GHSA-73wf-gq98-2v4g (crash/prototype write via untrusted `browserslist-stats.json`) |
| `@vitest/mocker` 2.1.0–4.1.10 (via `vitest`) | moderate | GHSA-82fw-gwwq-j7x9 (path traversal / arbitrary file read via redirect mock) |
| `baseline-browser-mapping` ≥2.0.0 <2.11.0 | moderate | GHSA-w5vr-8v7q-w6rv (DoS on invalid input) |

All three are **build/dev-time, not shipped runtime**, and none is currently reachable in this repo's usage — but the `@vitest/mocker` one is a real file-read primitive in a test runner that executes arbitrary repo code, and the last audit's "0 vulnerabilities" claim shows the gap: `.github/workflows/ci.yml` never runs `npm audit`, so drift is invisible until someone re-reads the lockfile.

GitHub-side, this is invisible as well as un-gated: `GET
/repos/G30Rpr/SetupSheet/dependabot/alerts` returns `403 Dependabot alerts are
disabled for this repository`, and `code-scanning/alerts` returns `403 Code
scanning is not enabled`. So there is no alert in the Security tab for anyone to
act on, and no SARIF pipeline that would create one.

**Fix:** `npm audit fix` (it resolves all four), then add a CI step in the `lint-test-build` job: `- run: npm audit --audit-level=high` (plus `--omit=dev` once dev-only noise is triaged) and record the result in release notes. Keep the existing `overrides` block.

### 2.4 The SQL layer is still never executed anywhere in this environment

`supabase/migrations/0023`–`0026` (the `leaderboard`/`setup_search` views, `updated_at`, deletion-request and report tables) are the load-bearing half of the security model, and the trust boundary is Postgres — not the React code. `scripts/test-db.sh` is well written (fresh scratch DB, duplicate-version guard, `ON_ERROR_STOP`, nine `.test.sql` files), but this sandbox has no `psql` and no Docker, so **zero SQL assertions were run by this audit**. Same for `npx playwright test`.

**Status — retracted in part, and the underlying gate was worse than reported.** The
claim "never executed anywhere" was true of *this sandbox* only: `.github/workflows/ci.yml`
has a `db-migrations` job that applies all migrations to `postgres:16` and runs
`supabase/testing/*.test.sql`. What the API shows instead is that the job has been
**failing on every branch for 13 days, including the merged default branch** — the SQL
gate exists and nobody was reading it. Root cause and fix are in §9; the harness itself is
fine.

This audit subsequently ran the suite locally: with no `apt` and no `psql`, a real
Postgres 18.4 cluster came from the `@embedded-postgres/linux-x64` npm package plus a
statement-splitting Node harness that reproduces `psql -f` semantics (each statement its
own implicit transaction — which matters, see §9). All 28 migrations and all 11 test files
apply and pass at `3ceef48`; `scripts/test-db.sh` itself still needs `psql` to run.

**Fix (remaining):** add the missing pieces while you are there: `pg_dump --schema-only` diff against the live project in that job (catches hand-edits), and `supabase db push --dry-run` where a project link exists. Also worth noting for whoever runs the CI job: `0024` uses `gin_trgm_ops` and relies on `0022` having created `pg_trgm`, so migrations **must** be applied in numeric order — the harness does, but a hand-run in the SQL editor may not.

---

## 3. High

### 3.1 `revalidateTag("public-setups")` makes the highest-frequency write invalidate the most expensive caches

`src/lib/actions/setups.ts:48-50` is called by `createSetup`, `updateSetup`, `deleteSetup`, **`toggleUpvote` (line 505)** and **`rateSetup` (line 543)**. The tag is attached to *everything* public:

* browse rows (500/setup), featured, count, detail, related, profile pages (`src/lib/supabase/setups.ts:99,114,124,160,195,226,293`)
* **the sitemap's 24,000-row keyset walk**, which is deliberately given `revalidate: 3600` (`setups.ts:269`)
* the leaderboard (`src/lib/supabase/leaderboard.ts:24`) and profile stats (`setups.ts:160`)

So every single upvote or star click on any setup by any user drops the hourly sitemap cache (a 24-request PostgREST walk) and re-runs the 500-row browse query for the next visitor on each filtered combination. Counter clicks are the most common mutation on a community site; the revalidation cost is proportional to the *catalog* size, not the mutation.

**Fix:** split tags — `setups-content` (create/update/delete: browse, detail, related, sitemap, profile), `setups-counters` (upvote/rate: count, featured, leaderboard, detail only), and give the sitemap walk its own `setups-sitemap` tag that content mutations do **not** touch. `revalidateTag(tag, "max")` is correct in Next 16; the problem is tag granularity, not the API.

**Status — fixed (2026-09-11).** Tags now live in one module, `src/lib/cache-tags.ts`, with
four names: `setups-content`, `setups-counters`, `setups-sitemap`, `public-profiles`.
Every `unstable_cache` reader declares which set it belongs to —
`SETUP_ROW_TAGS` (content + counters: browse, featured, detail, profile page),
`SETUP_CONTENT_TAGS` (count, SEO row, related — none of them read a counter),
`SETUP_SITEMAP_TAGS` (the sitemap walk alone), and leaderboard/profile stats on
content + counters + profiles. The two mutation helpers are
`revalidateSetupContent()` (`src/lib/actions/setups.ts:54`, used by create/update/delete)
and `revalidateSetupCounters()` (`:65`, used by `toggleUpvote`/`rateSetup`);
follows moved to `tagsForProfileMutation()` (`src/lib/actions/follows.ts:44`).
An upvote click now invalidates one tag instead of dropping the sitemap walk and every
browse cache. `src/lib/cache-tags.test.ts` pins the three sets, so re-merging them fails
a unit test rather than a production cache.

### 3.2 "Most wanted" aggregates the **oldest** 500 open requests

`src/lib/supabase/setup-requests.ts:107-108`:

```ts
.is("fulfilled_setup_id", null)
.order("created_at", { ascending: true })   // oldest first
.limit(500);
```

Ordering ascending + limit means "the 500 oldest open requests, forever." Once the board has >500 open requests, every *new* request is invisible to the feature the whole page is built around — the demand signal silently freezes in time while the list below it keeps growing.

**Fix:** order descending (newest 500) at minimum; better, add a `supabase/migrations/0027_most_wanted_view.sql` `security_invoker` view doing `group by game, car, track` with a `created_at >= now() - interval '90 days'` window and `order by count desc`, then `limit` — which also removes the in-JS grouping this endpoint does today.

**Status — fixed (2026-09-11).** `0027_most_wanted_requests.sql` adds
`public.setup_requests_most_wanted` (`security_invoker`, grouped by game/car/track,
`where fulfilled_setup_id is null and created_at >= now() - interval '90 days'`,
select granted to `anon`/`authenticated`), registered in `database.types.ts`.
`getMostWantedRequests()` (`src/lib/supabase/setup-requests.ts:202`) now selects +
orders the view with `limit` clamped to 1..25 instead of reading 500 rows into React,
so the signal no longer freezes as the board grows. No new index: 0013's
`setup_requests_open_idx` and `setup_requests_game_car_track_idx` already match the
view's predicate. Covered by `supabase/testing/zzzzzz_most_wanted.test.sql` (window,
grouping, and answered-requests-drop-out), which runs in CI via `npm run test:db`.

### 3.3 Requests board: silent truncation at 100, and open items can disappear

`getAllSetupRequests(limit = 100)` (`setup-requests.ts:28`) is called with no argument from `src/app/requests/page.tsx:30`, then **re-sorted in memory** to put open requests first. So the page shows the 100 newest rows sorted open-first; as soon as the newest 100 are mostly fulfilled, older *open* requests are not on the page at all, and there is no pagination, no filter, and no "open only" toggle. `requesterAvatarUrl` is hard-coded `null` (`setup-requests.ts:67`) while `src/lib/types.ts:119` still declares it — a dead contract field.

**Fix:** push the ordering into the query (`.is("fulfilled_setup_id", null)` first-class, or an index-backed `order by (fulfilled_setup_id is not null), created_at desc` via a view), add a cursor like the profile/browse pages already use, and either populate the avatar (the `profiles` query at line 47 already runs — add `avatar_url`) or delete the field.

**Status — fixed (2026-09-11).** `getAllSetupRequests` is gone; the reader is now
`getSetupRequestsPage(cursor)` (`src/lib/supabase/setup-requests.ts:113`): open
requests are a keyset page of `REQUESTS_PAGE_SIZE = 25` (fetched `+1` to know whether
a next cursor exists) with `order created_at desc, id desc` and the
`created_at < c or (created_at = c and id < i)` boundary, answered requests become a
separate, explicitly labelled first-page preview of 10 (`fulfilled_at desc`), and the
exact open total comes from a `head: true, count: "exact"` probe. The JS
re-sort is gone, so open items can no longer be pushed off the board. Hydration
(profiles + fulfilling setup) is one shared two-query pass for both lists.

The board renders through the new `src/components/setup-requests-list.tsx`, whose
"Load more open requests" button calls the `loadMoreSetupRequests` Server Action
(`src/lib/actions/setup-requests.ts:35`; the client-supplied cursor is validated as
ISO timestamp + UUID before it reaches PostgREST). A page that failed to load now
renders an error card on `/requests` instead of "No requests yet".
`requesterAvatarUrl` is deleted from `src/lib/types.ts` rather than populated — no
caller read it.

### 3.4 Uploaded files survive account deletion

Deleting a setup does best-effort Storage cleanup (`src/lib/actions/setups.ts`, `deleteSetup`), but account deletion (`0025` + `OPERATIONS.md`) only removes `auth.users`, cascading `profiles → setups → …`. **Nothing touches `storage.objects`.** A user whose deletion request is completed per `OPERATIONS.md` still has every setup/telemetry file publicly reachable at its `getPublicUrl` path. That is a data-retention/compliance defect, not just a leak, and it compounds with §2.2 (nothing deletes orphans ever).

**Fix:** add to the operator runbook a `delete from storage.objects where bucket_id='setup-files' and (storage.foldername(name))[1] = '<user id>'` step (service role / SQL editor only), plus the nightly orphan sweeper from §2.2 which catches the same class generically.

---

**Status — fixed (2026-09-11), with one operational step left.** `0028_setup_files_gc.sql`
adds two `security definer`, service-role-only enumerators: `orphaned_setup_files(grace)`
(older than 24h, referenced by no `setups` *or* `setup_versions` path) and
`setup_files_for_user(uid)` (everything under a departed account's folder).
`supabase/OPERATIONS.md` documents the account-deletion runbook around them, and
`supabase/testing/zzzzzzz_setup_files_gc.test.sql` pins the enumeration.

The earlier draft of this recommendation said to `delete from storage.objects`
directly. That is **wrong** and is corrected in the runbook: `storage.objects` is
the catalog, and deleting only the row leaves the bytes and their CDN entries
served. Objects have to go through the Storage API
(`DELETE /storage/v1/object/setup-files/<path>` with the service key), which is what
`supabase.storage.remove()` — used by both `discardUploadedFiles` and setup deletion — does.

Still open: nothing schedules the sweep. It is a manual query (or a `pg_cron`/edge
function the operator adds); see §2.2.

## 4. Medium

### 4.1 Failed submit orphans uploaded objects
`src/components/upload-form.tsx:404-437`: `resolveFileFields()` + `resolveTelemetryFields()` upload to Storage, then `createSetup`/`updateSetup` may fail validation or hit the 20/hour DB rate limit. The uploaded object is never removed — no client-side retry, no server-side GC, and the user gets "Couldn't publish" with a file sitting in public storage. On edit, a *replacement* upload followed by a failed update leaks the new object too (correctly, the old one is preserved). **Fix:** on a failed row write, fire a best-effort `removeSetupFile(path)` action; or restructure so the bytes are uploaded as part of the atomic write (signed upload URL created inside the RPC path), and GC orphans nightly (§2.2).

**Status — fixed (2026-09-11).** `src/components/upload-form.tsx` now hoists
`uploadedPaths` above the `try`, records whichever of the two parallel uploads
actually landed (setup file *and* telemetry — the partial-failure case previously
leaked the successful one), and hands them to the new `discardUploadedFiles`
Server Action (`src/lib/actions/setups.ts:229`) on all four failure paths:
setup-file error, telemetry error, a failed `createSetup`/`updateSetup` write, and
the `catch`. On edit, a replaced object is discarded only once the new row is
saved. The action re-validates each path with `isOwnedStoragePath` (a client cannot
name someone else's object), caps a batch at 4, and logs-and-swallows Storage
failures — cleanup must never turn a successful save into an error. The durable
backstop for everything else is `public.orphaned_setup_files()` (see §3.4).

### 4.2 `.vbo` telemetry uploads are rejected by the signature check
`src/lib/file-validation.ts:1` classifies `.vbo` as text:
```ts
const TEXT_EXTENSIONS = new Set([".json", ".ini", ".txt", ".xml", ".csv", ".vbo"]);
```
then rejects any file whose first 512 bytes contain NUL or don't decode as fatal UTF-8. VBOX `.vbo` is a **binary** datalogger format, so every legitimate one fails with "That file contains binary data and cannot be uploaded as text." This contradicts the function's own stated policy (opaque simulator formats are allowed through) and its own docstring in `src/lib/storage.ts` which advertises `.vbo` as a supported telemetry format. Same false-positive risk for UTF-16/BOM-saved `.ini`/`.txt`/`.csv`. **Fix:** remove `.vbo` from `TEXT_EXTENSIONS`, tolerate a leading BOM, and add a unit test asserting a binary-headed `.vbo` passes (`src/lib/file-validation.test.ts` currently has 3 tests and doesn't cover it).

### 4.3 Browse "load more" sends 500 more hydrated rows and reuses a stale cursor
`getSetupsAfter()` (`src/lib/supabase/setups.ts:467-516`) uses `SETUPS_BROWSE_LIMIT` (500) as the *page size*, fully hydrates each row (viewer state + author join), and `handleLoadOlder` in `src/components/setups-browser.tsx:249-289` appends into a client index that then grows unbounded, re-running fuzzy matching + `useMemo` over it on every keystroke. It also keeps `remoteCursor` from the *unfiltered* index when the user has since changed filters, and while searching falls back to `created_at < cursor` only (dropping same-timestamp rows). **Fix:** page size = `SETUPS_CARD_PAGE_SIZE` multiples (24/48), reset `remoteCursor`/`additionalSetups` whenever any filter changes, and use the full composite cursor (the `or=` search expression and the cursor can share one `or(...)` with an `and(...)` group, or move search server-side per §5.4).

**Status — fixed (2026-09-11), except the search-mode cursor edge.**
`getSetupsAfter()` now pages with `SETUPS_BROWSE_PAGE_SIZE = SETUP_CARD_PAGE_SIZE * 4`
(96 rows), defined at `src/lib/supabase/setups.ts:61`, while `SETUPS_BROWSE_LIMIT`
stays as the *first-page index* size — the two are no longer the same constant. The
client-side leak is closed in `src/components/setups-browser.tsx:88`: a
`filterSignature` over search/game/car/track/condition/rig plus the `setups` prop
identity is compared during render, and on any change `additionalSetups`,
`remoteError` and `remoteCursor` are re-seeded from the server index, so appended
pages can no longer survive a filter change and a cursor can no longer point into a
different ordering.

`src/components/setups-browser.test.tsx` covers both halves (cursor derived from the
last index row; filter change drops appended rows and re-seeds). It fails against the
pre-fix component.

Deliberately **not** changed: with an active search, the boundary is still
`created_at < cursor` (same-timestamp rows can be skipped), because PostgREST accepts
one `or` parameter and search already occupies it. Fixing that means moving browse
search server-side (a `text-search` filter/RPC), which is §5.4 territory.

### 4.4 Root layout blocks first paint on two notification queries
`src/app/layout.tsx:92` awaits `getNotifications(user.id, 10)` **and** `getUnreadNotificationCount(user.id)` before rendering `<main>` for every signed-in request, on top of the `getCurrentUser()` round trip — three serial-ish Supabase calls inside the shared layout, uncached by design. **Fix:** wrap the bell in its own `<Suspense>` (the segment already streams) or fetch it client-side in `NotificationBell`; keep `initialUser` server-side. This is a cheap, measurable TTFB win for the logged-in cohort.

### 4.5 `increment_downloads` is anonymous, `SECURITY DEFINER`, and unlimited
`0004_setup_files.sql:59` (redefined with a positional `$1` in `0018:262`) leaves `EXECUTE` to `public`. Any anonymous caller with the public anon key can post to `/rest/v1/rpc/increment_downloads` in a loop and inflate any setup's download count — the site's main popularity signal next to upvotes. Upvotes are protected by row-scoped `setup_upvotes`; downloads have no such guard. **Fix:** revoke from `anon`/`public`, grant to `authenticated` only if the counter should require login, or keep it public but add a per-`(setup_id, auth.uid()|session-hash)` dedupe window in the function body plus the edge limit from `LAUNCH_CHECKLIST.md`.

### 4.6 Display-name impersonation is trivial
`profiles.username` (`0001:13`) has a length check (`0018` `profiles_username_length_check`) but **no uniqueness, no normalization, no moderation flag**, and there is no profile-edit UI at all (no `.update()` on `profiles` anywhere in `src/` — the `0009` column grant exists for a feature that was never built). Two accounts can both render as "Coach Dave" on the leaderboard, in bylines, and in JSON-LD `Person` nodes. **Fix:** decide whether names are display names (then label them as such and add a stable `@handle` unique index + a report affordance) or handles (then `create unique index profiles_username_lower_uniq on profiles (lower(username))` in a new migration and enforce on signup).

### 4.7 Test coverage is thin exactly where the risk is
1,545 LOC of unit tests against 14,207 LOC of app code. The tested surface is the pure helpers (parsers, filters, normalizers) plus two small action guards. **Untested:** `src/lib/actions/setups.ts` (614 LOC — ownership checks, `validateAttachment`, rate-limit error mapping, storage-cleanup ordering), `src/lib/supabase/setups.ts` (759 LOC — cursor math, cache-tag wiring, `mapRow` safety fallbacks), `updateSetup`'s "read row before touching Storage" invariant, and the upload form's file/telemetry resolution. There is also no test asserting the *negative* authorization cases (user B calling `updateSetup` on user A's id must fail) — the highest-value test in this repo and cheap to write with a mocked client. **Fix:** add action-level tests for ownership/attachment/rate-limit paths, and one `src/lib/supabase/setups.test.ts` for cursor + `nextCursor` semantics.

### 4.8 Documentation drift
`AGENTS.md:4` tells every future agent “This project runs a standard, published Next.js release (currently **15.x**” — `package.json` pins `next ^16.3.3` and the middleware file is `src/proxy.ts` (the Next 16 rename). `AUDIT_REPORT.md` (this file) previously asserted a clean `npm audit`. `README.md`'s "Pages" list is accurate; `LAUNCH_CHECKLIST.md` is dated 2026-08-28 and predates §2.1–§2.3. **Fix:** correct the Next version line, add the vulnerability-gate item, and re-date after each audit.

---

## 5. What is genuinely good (keep it)

Verified, not assumed:

* **Row + column privilege layering in SQL** (`0009`, `0011`, `0013`, `0017`, `0018`, `0021`, `0025`, `0026`) — the denormalized trust signals (`upvotes`, `pace`, `rating_count`, `downloads`, `follower_count`, `fulfilled_*`, `status`) are all unreachable by direct `authenticated` writes. `revoke … from authenticated` followed by explicit `grant insert (...)`/`grant update (…)` is the right shape and is applied consistently.
* **`fulfill_setup_request` hardening** (`0016`) — cross-checks game/car/track, atomic compare-and-swap, self-notification excluded, `revoke … from public` + `grant to authenticated` in `0018`. Textbook.
* **Query-injection resistance** — `buildBrowseSearchExpression` (`src/lib/browse-filters.ts:60-83`) strips everything outside `\p{L}\p{N}_-` before building a PostgREST `or=`, caps terms at 8; `normalizeBrowseFilters` validates against the canonical option lists; profile cursors are regex-validated before entering an `or()`. The `setup_search` view is `security_invoker`, so RLS still applies.
* **CSP** — per-request nonce from `src/proxy.ts`, `'unsafe-eval'` dev-only, `frame-ancestors`/`form-action`/`base-uri`/`object-src` set, `X-Frame-Options: DENY`, HSTS production-only (verified on the wire, §2.1), `poweredByHeader: false`.
* **No `dangerouslySetInnerHTML`** except `src/components/json-ld.tsx:14`, fed only by `serializeJsonLd()` which escapes `<`, `>`, `&`; live probe confirmed `?q=<script>alert(1)` renders as `&lt;script&gt;…` inside an attribute and nothing else reflects.
* **Storage path ownership** enforced twice — `isOwnedStoragePath()` (`src/lib/storage.ts`) in `mapRow`/`downloadSetup`, and the DB CHECKs in `0018` — so a row can't point at another user's object.
* **URL allow-lists** — `normalizeVideoUrl` (`src/lib/video-url.ts`) uses an exact hostname Set (no `includes("youtube.com")` trap), rejects credentials/ports, and `parseVideoEmbed` re-serializes into `youtube-nocookie.com` with a `[A-Za-z0-9_-]{6,64}` id gate; the DB constraint (`0018:186`) closes the direct-REST path.
* **Viewer state never enters `unstable_cache`** (`public.ts` cookie-free client for cached reads; `hydrateSetupRows` uses the request-bound client) — the correctness hazard the previous audit fixed, still fixed.
* **Graceful degradation** — every reader goes through `unwrapList/unwrapSingle/unwrapCount`, so an unreachable Supabase yields empty states instead of 500s (confirmed by the whole suite of e2e specs which are *written against* that condition), and `fetchWithTimeout` caps every call at 5 s.
* **A11y baseline** — visible `:focus-visible` outline for `button`/`a`/`[role=button]` (`globals.css:157-161`), `prefers-reduced-motion` block plus `motion-reduce:animate-none` on the hero pulse, `role="group"`+`aria-label` star widgets, `aria-current="page"` breadcrumbs, labelled dropzone with keyboard handler, iframe `title`+`loading="lazy"`+referrer policy, one `<h1>` per route with `h2`-per-section structure.
* No secrets committed (`git ls-files`: only `.env.local.example`); no PII in fixtures.

---

## 6. Low-priority polish

1. **OG image staleness:** `next.config.ts` serves `/setups/:id/opengraph-image` with `s-maxage=86400` but the URL carries no version token, so an edited setup keeps a stale card image for 24 h. Append `?v=<updated_at>` in the metadata `images` entries.
2. **`/setups/compare`** sets `robots: { index: false, follow: false }` *and* `alternates.canonical` (`src/app/setups/compare/page.tsx:15-21`) — contradictory; drop the canonical on noindex routes.
3. **`0018` constraints are `NOT VALID` and never `VALIDATE`d** — historical garbage rows are permanently exempt. Add a follow-up migration that `alter table … validate constraint …` once the rows are cleaned, otherwise the invariant is only half-enforced.
4. **`getInitials`** exists twice (`src/lib/utils.ts` and `src/components/auth-nav.tsx:16`); the local copy shadows the shared one.
5. **`supabase/seed.sql:15`** inserts `pace`/`predictability`/`upvotes` directly into `setups` with no `setup_ratings` rows, so `rating_count` is 0 and the first real community rating *overwrites* the seeded averages (`recompute_setup_rating` recomputes from scratch). Seed `setup_ratings` instead.
6. **`RelativeTime`** starts one 60 s `setInterval` per notification row (10 timers per open bell).
7. **No `auth-code` CSRF/state assertion in `/auth/callback`** beyond Supabase's own PKCE cookie; `src/proxy.ts` deliberately forwards `?code=` from any path, so a caller can land a victim's browser on a code the victim then redeems. Worth a `state` check or, at minimum, documenting the accepted risk.
8. **`AuthProvider`** initialises `isLoading = initialUser === null`, so a server-rendered session leaves `session: null` while `user` is set; harmless today (nothing reads `session`), fragile later.
9. **Unused dependency:** `@radix-ui/react-progress` is in `dependencies` (`package.json:26`) but is imported by **zero** files — `src/components/rating-bar.tsx:27` hand-rolls `role="progressbar"` markup instead. Either drop the package or use the primitive (which also gives you `aria-valuenow`/`valuemin`/`valuemax`, currently missing from the bar). `@radix-ui/react-slot` is genuinely used (button, badge). `components.json` itself is only a shadcn CLI config — harmless to keep.

---

## 7. Priority roadmap

**Block 0 — before any public launch (all measurable today)**
1. UUID-shape guard in `src/proxy.ts` + no `og:image`/canonical on not-found metadata → kills §2.1.
2. `file_size_limit`/`allowed_mime_types` on the `setup-files` bucket + per-user upload rate limit + orphan sweeper → §2.2, §3.4, §4.1.
3. `npm audit fix`, then a CI `npm audit --audit-level=high` step → §2.3.
4. Apply and verify `0023`–`0026` in the real project; confirm the CI `db-migrations` job runs green on the release commit → §2.4.

**Block 1 — first week**
5. Split cache tags by mutation class (`setups-content` / `setups-counters` / `setups-sitemap`) → §3.1.
6. `0027_most_wanted_view.sql` + open-first, cursor-paginated requests list → §3.2, §3.3.
7. `.vbo` fix + `file-validation` tests; `increment_downloads` grant tightening → §4.2, §4.5.
8. Stream `NotificationBell` out of the layout → §4.4.

**Block 2 — month 1**
9. Server-side search/RPC pagination replacing the 500-row client index (fixes §4.3 and the last Phase-3 item together).
10. Action-level authorization tests for `actions/setups.ts`; cursor tests for `supabase/setups.ts` → §4.7.
11. Handle/unique-name decision + migration → §4.6.
12. Sitemap index split ahead of the 24,000-setup cap; `VALIDATE CONSTRAINT` follow-up.

**Block 3 — continuous**
13. Deploy-gated Lighthouse/PageSpeed runs recorded in release notes (the audit still has **no measured LCP/INP/CLS** — nothing in this report substitutes for that).
14. Wire `npm run build:budget` into CI alongside `npm audit`.
15. Moderation queue UI over `content_reports`, upload malware scanning/quarantine, monitored privacy contact.

---

## 8. Remediation log (2026-09-11)

Implemented in this pass — §3.1, §3.2, §3.3, §3.4, §4.1, §4.3. Not implemented —
everything in §2 (Critical), and §4.2/§4.4–§4.8 plus all Low items.

| Finding | Outcome | Key files |
| --- | --- | --- |
| 3.1 tag granularity | Fixed | `src/lib/cache-tags.ts`, `src/lib/supabase/setups.ts`, `leaderboard.ts`, `profiles.ts`, `src/lib/actions/setups.ts`, `follows.ts` |
| 3.2 most-wanted window | Fixed | `supabase/migrations/0027_most_wanted_requests.sql`, `src/lib/supabase/setup-requests.ts`, `database.types.ts` |
| 3.3 requests board | Fixed | `src/lib/supabase/setup-requests.ts`, `src/lib/actions/setup-requests.ts`, `src/components/setup-requests-list.tsx`, `src/app/requests/page.tsx` |
| 3.4 files after deletion | Fixed (sweep scheduling open) | `supabase/migrations/0028_setup_files_gc.sql`, `supabase/OPERATIONS.md`, `supabase/testing/shim.sql` |
| 4.1 orphaned failed uploads | Fixed | `src/lib/actions/setups.ts` (`discardUploadedFiles`), `src/components/upload-form.tsx` |
| 4.3 browse paging | Fixed (search-mode cursor edge left) | `src/lib/supabase/setups.ts`, `src/components/setups-browser.tsx` |

New tests: `src/lib/cache-tags.test.ts` (6), `src/components/setups-browser.test.tsx` (2),
`supabase/testing/zzzzzz_most_wanted.test.sql`, `supabase/testing/zzzzzzz_setup_files_gc.test.sql`.
Unit suite: 29 files / 142 tests. `npm run lint`, `tsc --noEmit`, `npm run build` (23
routes) and `node scripts/check-performance-budget.mjs` (403.7 KiB gzip) all pass. The SQL
suite was then run locally against a real cluster and `npm run test:e2e` ran in CI — see §9
for how, and for the two pre-existing failures that turned up (both now fixed, CI green).

---

## 9. GitHub-side status (2026-09-11, `gh api` + `gh run`)

Everything below was read from the live repo, not inferred from CI files.

| Item | State |
| --- | --- |
| Default branch | `SetUpSheet` (not `main`) — every workflow trigger, docs link and PR base has to use that exact casing |
| CI on `SetUpSheet` (`ff0920d`) | `lint-test-build` ✓ · `db-migrations` **✗** · `e2e` **✗** · `Supabase Preview` **✗** |
| Run history (last 20) | 17 `failure`, 3 `success` — red has been the norm, which is why a red merge looks normal |
| PRs | #1–#4 all merged, none open; **#4 merged with `db-migrations` and `e2e` failing** → no required-status check on the default branch |
| Issues | 0 open |
| Dependabot | **alerts disabled** → the §2.3 advisories are not tracked anywhere |
| Code scanning | **not enabled** |
| Environments | `Preview`, `Production` exist; deployment status is not readable with the agent token (`403`) |
| Non-workflow checks | `Vercel Preview Comments` (App) succeeds; `Supabase Preview` (App) fails on the default branch and skips on branches — configured outside this repo, so it needs Settings → Environments/Integrations, not a PR |
| Branch hygiene | merged `arena/01a044ba-setupsheet` still on the remote; no auto-delete after merge |

### The two red jobs, root-caused

**`db-migrations` — a tautologically failing test, fixed in `d77cbda`.**
`supabase/testing/zz_setup_updated_at.test.sql` wrapped the insert, the edit and the
comparison in one `do $$ … $$` block. `touch_setup_updated_at()` (0022) stamps `now()`,
and `now()` is frozen for the whole transaction, so `after_edit <= before_edit` was true
*whatever the trigger did* — `pg_sleep(0.02)` inside the same transaction cannot move it.
Since a `do` block is a single psql statement, the assertion also never got the separate
transactions it silently assumed. The file now uses one statement per transaction with a
temp table to carry values, and both original assertions still bite (an edit must advance
`updated_at`; a counter-only update must not).

**`e2e` — the spec clicked the wrong combobox, fixed in `3ceef48`.**
`e2e/setups-browse.spec.ts` used `getByRole("combobox").first()`, but `/setups` renders the
header-search input with `role="combobox"` (for its suggestion listbox) *before* the filter
selects, so the click landed on search, whose options never populate with no reachable
Supabase — `getByRole("option")` timed out for a reason unrelated to the filter controls the
test claims to cover. It now targets `#filter-game`, the element its own `<label for>` points
at. This is the failure that survived PR #4's "audit hardening" (the search combobox landed
in the same round).

**Also fixed here, self-inflicted:** the first `/requests` rewrite rendered an error card
*instead of* the empty state, which broke `e2e/requests-board.spec.ts`'s documented
graceful-degradation contract. The page now shows the empty state **plus** an inline
`role="alert"` notice, and the spec asserts both — an outage no longer reads as a quiet
board, and the repo's "degrade, don't error" convention holds.

### Current state of this work

`arena/01a08cdc-setupsheet` @ `3ceef48` (3 commits: the remediation, the `updated_at` test
fix, this CI/spec pair) — **first fully green CI run on the repo in two weeks**
([run 34605525262](https://github.com/G30Rpr/SetupSheet/actions/runs/34605525262)):
`lint-test-build` ✓, `db-migrations` ✓ (including the two new `.test.sql` files), `e2e` ✓
(14/14). No PR opened yet; the §2.1–§2.4 Criticals other than the CI gate items above are
still open.
