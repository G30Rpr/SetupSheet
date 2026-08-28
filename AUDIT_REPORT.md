# SetupSheet — Full Codebase Audit Report

**Date:** 2026-08-28
**Scope:** Full repository (`/home/user/SetupSheet`), branch `arena/01a044ba-setupsheet`
**Role:** Senior full-stack engineering and lead product-design audit
**Method:** Source inspection, dependency review, unit-test execution, production-build validation, route/header inspection, SEO markup inspection, and static performance analysis. No deployed PageSpeed report or screenshots were available in this checkout.

---

## 1. Executive Summary

SetupSheet is a Next.js 16 / React 19 / TypeScript / Tailwind v4 application backed by Supabase SSR. Phase 1 (UI/accessibility) and Phase 2 (architecture/resilience/security hardening) are substantially implemented. This pass completes the source-level Phase 3 performance work and Phase 4 SEO/content work.

### Current status

- **Performance:** Public data now uses a cookie-free Supabase client behind Next's Data Cache. Setup/leaderboard/profile data is revalidated for 60 seconds; sitemap data is revalidated hourly. Authenticated viewer state is deliberately kept outside that cache.
- **Core Web Vitals:** **Not measured.** No deployed URL, Lighthouse trace, PageSpeed Insights report, screenshots, or representative production dataset was supplied. Any LCP/INP/CLS conclusion below is explicitly source-based or provisional.
- **SEO:** Page title templating, bounded descriptions, canonical URLs, Open Graph/Twitter metadata, route-aware robots directives, updated sitemap timestamps, JSON-LD, semantic headings/lists, breadcrumbs, streamed related links, and proper `notFound()` paths are implemented.
- **Security:** The existing nonce-based CSP remains in place. JSON-LD is centralized in `src/components/json-ld.tsx`, HTML-escaped by `serializeJsonLd()`, and nonce-protected.
- **Validation:** The current known-good unit suite is 27 test files / 134 tests. `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm audit --audit-level=high` have passed during this pass. Database regression tests remain blocked locally because `psql` is unavailable. Playwright browser execution remains blocked by the sandbox's failed Chromium download.

### Priority summary

| Priority | Work | Status |
|---|---|---|
| Critical release gate | Run mobile/desktop Lighthouse or PageSpeed against a deployed URL with populated setup data | Awaiting external measurement |
| High | Keep public cache tags and migrations `0022`–`0026` deployed before relying on cached public pages, profile aggregates, author search, deletion requests, and moderation reports | Implemented; deployment verification required |
| High | Validate JSON-LD, canonical URLs, sitemap coverage, and robots behavior in Google Search Console/Rich Results Test | Implemented; external validation required |
| Medium | Replace the bounded client-side browse index with server-side search/RPC pagination as the catalog grows | Remaining optimization |
| Medium | Split the sitemap into multiple documents before the 24,000-setup cap becomes material | Remaining scale optimization |
| Backlog | Add provider-backed upload malware scanning and automated moderation tooling | Requires external provider/product operations |

---

## 2. Verified Baseline and Existing Phase 1/2 Work

### Stack and dependency baseline

- Next.js `16.3.3`, React `19.2.7`, TypeScript `5.9.3`, Node `>=22.0.0`.
- Supabase SSR: `@supabase/ssr ^0.12.3`, `@supabase/supabase-js ^2.110.7`.
- Tailwind CSS v4 with OKLCH theme tokens.
- `npm audit --audit-level=high`: **0 vulnerabilities** after the Next.js/sharp upgrade and `nanoid` / `js-yaml` overrides in `package.json`.

### Existing completed hardening

- Typed Supabase contracts in `src/lib/supabase/database.types.ts`.
- Explicit public setup projections in `src/lib/supabase/setups.ts`; no public setup reader relies on `select("*")`.
- Atomic setup + initial rating RPC in `supabase/migrations/0020_create_setup_with_rating.sql`.
- Direct-API validation and Storage extension/path controls in migrations `0018` and `0019`.
- Insert-column grants and authenticated contribution limits in `0021_insert_grants_and_rate_limits.sql`.
- OAuth redirect sanitization, safe video/avatar URLs, bounded JSONB setup values, safe action errors, CSP nonces, production-only HSTS, upload signature checks, public security headers, and a user-scoped manual deletion-request workflow.
- Mobile header search, visible focus states, accessible filter/listbox semantics, collapsible proof fields, profile card paging, `SetupCardFooter`, and `UploadProofSection`.

---

# Phase 3 — Performance & Core Web Vitals

## Critical Issues — Fix immediately

### 3.1 Release measurement is still missing — **verified gap, conclusions provisional**

There is no deployed URL or PageSpeed/Lighthouse artifact in the repository. Therefore the audit cannot truthfully assign LCP, INP, CLS, TTFB, or real-user pass/fail values. The next release gate is to test:

1. `/` with an empty and populated catalog;
2. `/setups` with 500+ records;
3. a setup detail page with proof, telemetry, values, and comments;
4. mobile throttling (4G, mid-tier Android) and desktop; and
5. cold and warm cache runs.

Capture LCP element and timing, TTFB, total transfer, JS execution, INP interaction traces for search/filtering, and CLS sources. The source code indicates a text/CSS hero rather than a large image hero, so the landing H1 is a plausible LCP candidate, but that is **not a measured finding**.

### 3.2 Public data and personalized state must not share a cache — **verified and fixed**

The application renders viewer-specific upvote, favorite, rating, and ownership state. Caching the complete hydrated `Setup` object would leak one viewer's state to another. The implementation now separates the two concerns:

- `src/lib/supabase/public.ts` creates a cookie-free, non-persisting Supabase client for rows public under RLS.
- `unstable_cache()` in `src/lib/supabase/setups.ts` caches public browse, featured, count, detail, profile-setup, related-link, and sitemap reads.
- `src/lib/supabase/profiles.ts` caches public profile metadata.
- `src/lib/supabase/leaderboard.ts` caches the public leaderboard view.
- `hydrateSetupRows()` still reads authenticated viewer state through the cookie-bound SSR client on each request; it is not placed inside the Data Cache.
- `src/lib/actions/setups.ts` calls `revalidateTag("public-setups", "max")` after setup/rating/upvote mutations. `src/lib/actions/follows.ts` invalidates `public-profiles` after follower mutations.

The tag invalidation and migrations `0022`–`0026` must be deployed together with the application. This is a **verified implementation requirement**, not a PageSpeed measurement.

## Optimization Opportunities

### 3.3 Initial server and client payloads are bounded, but the browse index is still sizable

`src/app/setups/page.tsx` and `src/lib/supabase/setups.ts` intentionally cap the initial browse index at `SETUPS_BROWSE_LIMIT = 500`. `src/components/setups-browser.tsx` mounts only the visible page of `SetupCard` instances, but the first 500 rows still cross the RSC boundary because client-side fuzzy search supports car, track, game, author, description, and tags.

Implemented mitigations:

- deterministic keyset expansion through `getSetupsAfter()` / `loadMoreSetups()`;
- `SETUP_CARD_PAGE_SIZE` rendering rather than mounting every returned card;
- `useDeferredValue()` around fuzzy filtering so typing remains responsive as the bounded index grows;
- `content-visibility: auto` and `contain-intrinsic-size` on cards;
- lazy dynamic imports for values, install guides, history, and comments;
- dynamic imports for upload car/track rosters.

Remaining optimization: move full-text search and sort to a database RPC or indexed search endpoint, then send a small page of rows instead of serializing a 500-row client index. Author-name search is now complete for initial and older browse pages through the security-invoker `setup_search` view from migration `0024_setup_search_view.sql`; the 500-row client index remains the separate payload opportunity.

### 3.4 Profile reads now paginate at the database boundary — **implemented**

Profile routes no longer fetch or serialize up to 500 complete setup rows. `getSetupsByUserPage()` in `src/lib/supabase/setups.ts` fetches 25 rows at a time, returns 24 setup cards plus a deterministic `(created_at, id)` cursor, and reuses the indexed public Data Cache. `src/lib/actions/profile-browse.ts` validates profile UUIDs and cursors before loading later pages. `src/components/profile-setups-grid.tsx` appends pages on demand, de-duplicates IDs, and exposes loading/error recovery states.

`supabase/migrations/0023_profile_setup_stats.sql` extends the public `leaderboard` view with `total_ratings`; `getProfileSetupStats()` supplies full-profile setup count/upvote/rating totals without serializing every card. Both own and public profile routes pass the page cursor, stats, and initial-load errors into `ProfileView`. This closes the Phase 3.4 source-level finding; production RSC payload and interaction timings should still be confirmed with Lighthouse/real-user data.

### 3.5 Below-the-fold related links do not block setup LCP

`src/components/related-setups.tsx` fetches a small public-only related list inside a `Suspense` boundary in `src/app/setups/[id]/page.tsx`. The setup card and primary metadata can stream before the related-link query resolves. The related query itself is Data-Cached for 60 seconds.

### 3.6 Expensive paint work was reduced

- `background-attachment: fixed` was removed from `src/app/globals.css`; mobile browsers no longer need to repaint the decorative gradient as the document scrolls.
- `.content-auto` uses `content-visibility: auto` for setup cards.
- `prefers-reduced-motion` disables long-running animations/transitions; the landing status pulse also has `motion-reduce:animate-none`.
- `AvatarImage` defaults to `loading="lazy"`, `decoding="async"`, and `referrerPolicy="no-referrer"` in `src/components/ui/avatar.tsx`.
- The optional YouTube iframe in `src/components/setup-card.tsx` is created only after the proof panel is expanded and now includes `loading="lazy"` and an explicit referrer policy.

### 3.7 Third-party impact is limited and isolated

The normal page tree contains no analytics, ad, chat, social, or widget scripts. The only external font requests are in `src/lib/og-fonts.ts` for generated social images, not the HTML page critical path. That helper now caches in-flight font promises, uses `force-cache`, checks response status, and falls back safely if Google Fonts is unreachable. The CSS page font uses local system fallbacks, so build and first paint do not depend on Google Fonts.

The remaining external runtime requests are expected user/content resources: Discord avatar images, Supabase API/Auth, Supabase Storage, and an opt-in YouTube embed. Verify their timings in a real network trace; no claim that they affect LCP is made here.

### 3.8 Caching headers are explicit for generated metadata assets

`next.config.ts` now sets:

- OG images: `public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`;
- sitemap: `public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`;
- robots: `public, max-age=3600, stale-while-revalidate=86400`.

The production build reports `/sitemap.xml` as a static/revalidated route with a one-hour revalidation window. Next immutable `_next/static` assets retain framework-managed hashed caching. Public HTML remains personalized/dynamic because the root layout includes session-aware navigation; do not add a blanket public HTML cache without separating viewer state.

### 3.9 Auth refresh avoids an anonymous timeout

`src/lib/supabase/auth-cookie.ts` provides `hasSupabaseAuthCookie()`. Both `src/lib/supabase/auth.ts` and `src/lib/supabase/proxy.ts` skip the Supabase `getUser()` network call when no `sb-...-auth-token` cookie exists. This removes an unnecessary public-page request and prevents an unconfigured/dead Supabase project from adding an auth timeout to every anonymous page. Existing sessions still refresh on requests that carry the cookie.

## Best-Practice Recommendations

1. Run Lighthouse/PageSpeed against a deployed build after populating realistic setup rows. Record the exact LCP element, response timings, JS long tasks, layout-shift sources, and mobile/desktop scores in CI or release notes.
2. `scripts/check-performance-budget.mjs` and `npm run build:budget` now provide gzipped JS/CSS chunk budgets. Wire this command into CI when workflow permissions allow, and extend it with HTML/RSC/image budgets after a representative production dataset is available.
3. Replace the 500-row client browse index with Postgres full-text/trigram search and cursor pagination before the catalog becomes large enough that `SETUPS_BROWSE_LIMIT` hides results.
4. Monitor profile page RSC payloads and keep the 24-row page size aligned with real-device memory and interaction measurements.
5. Keep viewer state out of `unstable_cache`; invalidate `public-setups` after any mutation that changes public setup rows or aggregates. Never cache a response containing `hasUpvoted`, `hasFavorited`, `myRating`, or `isOwner` as shared data.
6. Keep generated OG images and sitemap responses behind CDN caching, but retain a revalidation/invalidation path when setup metadata changes.
7. If a production analytics provider is added, load it only after consent where required and use `next/script` with an explicit loading strategy; measure its INP and main-thread cost separately.

---

# Phase 4 — SEO & Content Strategy

## Critical Issues — Fix immediately

### 4.1 External SEO validation is still a release gate — **verified gap**

Source markup is implemented, but no deployed crawl has verified canonical resolution, rendered structured data, image accessibility, sitemap coverage, or indexability. After deployment, validate representative setup/profile URLs with:

- Google Search Console URL Inspection;
- Rich Results Test / Schema Markup Validator;
- `curl -I` for status, `X-Robots-Tag`, canonical HTML, and cache behavior; and
- a sitemap parser checking every URL is absolute, unique, reachable, and below the protocol document limit.

### 4.2 The sitemap remains intentionally bounded — **verified scalability limit**

`src/lib/supabase/setups.ts` fetches deterministic 1,000-row keyset batches and currently caps the source at 24,000 setups. `src/app/sitemap.ts` also budgets profile entries so the single XML document remains below 50,000 URLs. This is safe for the current unknown catalog size, but it will omit older setup/profile URLs once the cap is reached. Split into multiple sitemap documents/indexes before that happens.

## Optimization Opportunities

### 4.3 On-page metadata is now consistent

The root metadata in `src/app/layout.tsx` now provides:

- `metadataBase` from `SITE_URL`;
- a default title and `%s — SetupSheet` title template;
- a bounded default description;
- canonical URL, author/creator/publisher, category, favicon, and application name;
- Open Graph/Twitter card defaults with the generated OG image.

Route metadata now supplies page-specific titles/descriptions and canonical URLs for `/setups`, `/leaderboard`, `/requests`, `/upload`, `/profile`, `/setups/compare`, `/setups/[id]`, and `/profile/[userId]`. User-generated setup descriptions are normalized and bounded through `truncateMetaDescription()` in `src/lib/seo.ts` instead of being emitted as multi-thousand-character descriptions.

Private/edit/error surfaces are marked `noindex`/`nofollow` as appropriate. Query-driven browse views canonicalize to `/setups`, avoiding a large set of duplicate filter URLs.

### 4.4 Structured data is centralized and route-appropriate

`src/components/json-ld.tsx` reads the request nonce and serializes data via `serializeJsonLd()` in `src/lib/seo.ts`, escaping `<`, `>`, and `&` before embedding. Current schemas:

- root layout: `Organization` + `WebSite` + `SearchAction` graph;
- `/setups`: `CollectionPage` with a small `ItemList` of the first 12 public results;
- `/setups/[id]`: `Article` + `BreadcrumbList`, including author, dates, image, free-access signal, game/car/track keywords, and publisher reference;
- `/profile/[userId]`: `ProfilePage` + `Person` with a safe public profile URL/avatar;
- `/leaderboard`: ranked `ItemList` of contributor profile links;
- `/requests`: `CollectionPage`.

Only a small browse item list is included intentionally; embedding all 500 client-index rows into JSON-LD would increase HTML without improving crawl quality.

### 4.5 Freshness metadata is now accurate for edits

`supabase/migrations/0022_setup_updated_at.sql` adds `setups.updated_at` and a trigger that advances it only when contributor-editable fields change. Counter/rating trigger updates retain the old timestamp. `getSetupSeoData()` uses the public cached row, setup JSON-LD emits `dateModified`, and `src/app/sitemap.ts` emits the updated timestamp as `lastModified`.

The migration must be applied after `0021`; `src/lib/supabase/database.types.ts` and the explicit public projection already include `updated_at`. The same migration adds `(created_at, id)` / `(user_id, created_at, id)` ordering indexes and `pg_trgm` indexes for validated substring search. Migration `0023_profile_setup_stats.sql` then adds the `total_ratings` aggregate needed by paginated profile headers. Migration `0024_setup_search_view.sql` exposes the public author name to server-side browse search without bypassing RLS.

### 4.6 Heading hierarchy and semantic HTML were improved

- Each primary route has a single visible H1, including logged-out/private states and custom not-found surfaces.
- `SetupCard` accepts `titleLevel` so grid cards use H2 under browse/detail contexts and H3 under the home/profile H2 sections.
- Home highlights and featured areas use labeled sections.
- Browse results use a labeled section and semantic list items.
- Leaderboard uses an ordered list inside a labeled section.
- Requests use a `Most wanted` section and a `Community requests` section with list items.
- Setup and profile detail pages provide accessible breadcrumb navigation.
- Setup/request cards use semantic `<article>` elements.

### 4.7 Internal linking now supports discovery

The persistent header/footer, home game/rig links, setup author links, fulfilled-request links, leaderboard profile links, setup breadcrumbs, and setup-to-browse links provide a crawlable graph. `/setups/[id]` additionally streams up to six cached “More [game] setups” links from `src/components/related-setups.tsx` without blocking the primary setup card.

### 4.8 Missing resources now use route-aware not-found handling

`src/app/setups/[id]/page.tsx` and `src/app/profile/[userId]/page.tsx` call `notFound()` after their public lookup fails and have route-specific `not-found.tsx` experiences. `src/app/not-found.tsx` covers unknown routes and is `noindex`. The streamed RSC response still needs a deployed-platform status check because streamed Next responses can expose a soft 404 status while carrying the framework's `NEXT_HTTP_ERROR_FALLBACK;404` marker.

## Best-Practice Recommendations

1. Keep titles under search-result display limits and descriptions between roughly 120–160 characters; `truncateMetaDescription()` handles descriptions, but monitor unusually long usernames/car names in production.
2. Keep canonical URLs stable on the production origin. `src/lib/site.ts` uses `setupsheet.app` in production and `VERCEL_URL` for preview deployments; verify that preview pages do not accidentally enter the production sitemap.
3. Submit `/sitemap.xml` in Search Console after deployment and monitor excluded/duplicate-canonical reports. Introduce sitemap indexes when the 24,000 setup cap approaches.
4. Keep JSON-LD values derived from public, sanitized data only. Do not move user-generated HTML into descriptions; continue using escaped JSON-LD and the existing CSP nonce.
5. Add `Organization.sameAs` only when official social profiles exist. Do not invent publisher/social identities just to fill schema fields.
6. Preserve crawlable internal links in server-rendered HTML. Client-only filtering is useful UX but should not be the only path to individual setup URLs; setup cards, sitemap, breadcrumbs, and related links provide server-visible paths.
7. Keep author-aware search covered by integration tests against the deployed `setup_search` view; it is both an SEO discoverability improvement and a browse correctness improvement.
8. Keep the new privacy policy, retention/deletion explanation, and moderation/reporting policy reviewed and maintained; these are primarily Phase 5 compliance/product requirements but affect content trust.

---

# Phase 5 — Security & Compliance

## Critical Issues — Fix immediately

### 5.1 Production RLS and migration verification remains required — **external validation**

The application and SQL defenses are implemented, but the complete migration chain must be applied and checked in the real Supabase project. Run migrations `0023` through `0026` after the already-applied `0022`, then verify the RLS policies, grants, `leaderboard`/`setup_search` views, deletion-request table, moderation-report table, and Storage policies from both `anon` and `authenticated` roles. The local harness remains unavailable because `psql` is not installed.

### 5.2 Edge/IP abuse protection is not fully implementable in repository code alone — **verified remaining risk**

`0021_insert_grants_and_rate_limits.sql` limits authenticated setup, comment, and request inserts. Public Storage upload attempts and anonymous download-counter RPC calls still need a provider-aware edge/IP limiter. Do not rely on a process-local in-memory limiter in a serverless deployment; use the hosting provider, CDN/WAF, or a shared rate-limit service.

### 5.3 Automated file malware scanning requires an external service — **verified remaining risk**

`src/lib/file-validation.ts` now checks recognizable JSON/text/ZIP content signatures in addition to extension and size. Opaque simulator formats still cannot be classified reliably by a generic magic-byte check. If the service accepts arbitrary community uploads at scale, quarantine and scan files before making them public.

## Optimization Opportunities

### 5.4 Security headers and upload boundaries are hardened in source

`next.config.ts` now sends `X-Content-Type-Options`, `X-Permitted-Cross-Domain-Policies`, `X-DNS-Prefetch-Control`, `Cross-Origin-Opener-Policy`, `X-Frame-Options`, HSTS in production, and the existing Permissions/Referrer policies. `src/lib/file-validation.ts` rejects malformed JSON, non-ZIP files named `.zip`, and binary content masquerading as text before Storage upload.

The nonce-based CSP in `src/proxy.ts` remains intentionally compatible with Radix inline positioning styles and the opt-in YouTube embed. `img-src https:` is broader than ideal because avatars can originate from provider CDNs; narrow it after the production Discord/Supabase asset host list is confirmed.

### 5.5 Privacy, terms, guidelines, and deletion request surfaces are now present

The public pages `/privacy`, `/terms`, and `/community-guidelines` are linked from the site footer. `/account/data-deletion` provides an authenticated, double-confirmed request flow backed by `account_deletion_requests` in migration `0025_account_deletion_requests.sql`. The workflow intentionally does not expose a Supabase service key or pretend that the account is deleted automatically; an authorized operator/backend must complete requests.

## Best-Practice Recommendations

1. Run a role-aware Supabase review after migrations `0023`–`0026`: test public reads, authenticated self-only deletion requests/reports, direct attempts to set protected status/timestamps, Storage path policies, and the author-search view.
2. Configure WAF/CDN limits for upload endpoints, Server Actions, anonymous download RPC traffic, and repeated failed authentication attempts.
3. Add a quarantine bucket or scanning worker for uploaded files before public publication; retain the current extension, size, path, and signature checks as defense in depth.
4. Replace the repository link in the privacy policy with a monitored privacy contact/legal entity before collecting real user data at scale. Have counsel review the policy, terms, retention language, and deletion SLA for applicable GDPR/CCPA obligations.
5. Add security alerting for repeated upload failures, rate-limit violations, suspicious Storage paths, malformed action payloads, and unusual download-counter activity.

---

# Phase 6 — Executive Summary & Priority Roadmap

## Critical Issues — Fix immediately

1. **Deployment gate:** Apply and verify migrations `0023` through `0026` in Supabase; deploy the latest branch commit containing the Phase 3–6 work.
2. **Measurement gate:** Run production Lighthouse/PageSpeed and record mobile/desktop LCP, INP, CLS, TTFB, payload sizes, and the LCP element.
3. **Security operations gate:** Configure shared edge/IP rate limits, upload quarantine/scanning, and a monitored privacy/moderation contact before broad launch.
4. **Search gate:** Validate `/sitemap.xml`, canonical URLs, robots behavior, and JSON-LD in Search Console/Rich Results Test.

## Optimization Opportunities

### High Priority — Weeks 1–2

- Apply migrations `0023`–`0026` and pass the CI database job.
- Deploy the current branch and pass unit, build, and Playwright CI checks.
- Collect representative mobile/desktop performance traces.
- Submit the sitemap and validate setup/profile structured data.
- Configure edge limits and publish the reviewed privacy/terms/guidelines copy.

### Medium Priority — Month 1

- Replace the 500-row client browse index with server-side search/RPC pagination.
- Add a sitemap index before the 24,000-setup source cap is material.
- Add Web Vitals monitoring and wire `npm run build:budget` into CI when workflow permissions allow.
- Add a quarantine/scanning worker for uploads.
- Add an operator moderation queue/status dashboard; reporter intake is implemented.

### Low Priority — Backlog

- Build game/car/track SEO landing pages and tutorial/FAQ content.
- Add automated account deletion execution after service-role/admin architecture is approved.
- Narrow CSP image origins after observing production assets.
- Add contributor and abuse dashboards.

## Best-Practice Recommendations

Phase 6 is documentation rather than a separate code feature. Keep this roadmap tied to owners, dates, deployment evidence, and measured metrics. Do not mark a production gate complete based solely on source inspection or a local build.

---

## 5. Testing and Validation

### Passed in this checkout

- `npm ci` — installed 535 packages; npm reported 0 vulnerabilities.
- `npm run lint` — passed with no warnings.
- `npx tsc --noEmit` — passed with no errors.
- `npm test` — 27 test files, 134 tests passed, including SEO helper, auth-cookie, profile pagination, file-signature, and moderation-report tests.
- `npm run build` — production Turbopack build passed; 21 routes compile with dynamic public pages, static OG/robots output, and hourly revalidated sitemap output.
- `npm run build:budget` — passed; current static JS/CSS chunks total 402.9 KiB gzip, with a 71.5 KiB largest chunk.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `npx playwright test --list` — test discovery works; SEO coverage is present in `e2e/seo.spec.ts`.

### Blocked or not supplied

- `npm run test:db` — not executable locally because `psql` is not installed. CI's `postgres:16` service remains the authoritative migration test environment. New SQL coverage is in `supabase/testing/zz_setup_updated_at.test.sql`, `zzz_profile_setup_stats.test.sql`, `zzzz_setup_search.test.sql`, `zzzzz_account_deletion.test.sql`, and `zzzz_content_reports.test.sql`.
- `npm run test:e2e` — browser execution remains blocked because the sandbox could not download Chrome for Testing; CI installs Chromium with `npx playwright install --with-deps chromium`.
- PageSpeed/Lighthouse — no deployed URL or metrics supplied; Core Web Vitals findings remain provisional.
- Screenshot review — no screenshots supplied; pixel-level Phase 1 conclusions remain provisional.

---

## 6. Files Added or Updated for Phases 3–6

- `src/lib/seo.ts`, `src/lib/seo.test.ts`
- `src/lib/file-validation.ts`, `src/lib/file-validation.test.ts`
- `scripts/check-performance-budget.mjs`
- `src/lib/actions/profile-browse.ts`, `src/lib/actions/profile-browse.test.ts`
- `src/components/json-ld.tsx`
- `src/app/privacy/page.tsx`, `src/app/community-guidelines/page.tsx`, `src/app/terms/page.tsx`
- `src/components/related-setups.tsx`
- `src/lib/supabase/public.ts`
- `src/lib/supabase/auth-cookie.ts`, `src/lib/supabase/auth-cookie.test.ts`
- `src/lib/supabase/setups.ts`, `profiles.ts`, `leaderboard.ts`, `auth.ts`, `proxy.ts`
- `src/lib/actions/setups.ts`, `follows.ts`, `profile-browse.ts`, `account-deletion.ts`, `content-reports.ts`
- `src/lib/supabase/account-deletion.ts`
- `src/components/profile-setups-grid.tsx`, `profile-view.tsx`, `account-deletion-request.tsx`, `report-content-form.tsx`
- `src/app/layout.tsx`, `setups/page.tsx`, `setups/[id]/page.tsx`, `profile/[userId]/page.tsx`, `leaderboard/page.tsx`, `requests/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `community-guidelines/page.tsx`, `report/page.tsx`, `account/data-deletion/page.tsx`, `not-found.tsx`
- `src/app/setups/[id]/not-found.tsx`, `src/app/profile/[userId]/not-found.tsx`
- `src/components/setup-card.tsx`, `setups-browser.tsx`, `profile-setups-grid.tsx`, `ui/avatar.tsx`, `globals.css`
- `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts`, `src/lib/og-fonts.ts`
- `supabase/migrations/0022_setup_updated_at.sql`, `0023_profile_setup_stats.sql`, `0024_setup_search_view.sql`, `0025_account_deletion_requests.sql`, `0026_content_reports.sql`
- `supabase/testing/zz_setup_updated_at.test.sql`, `zzz_profile_setup_stats.test.sql`, `zzzz_setup_search.test.sql`, `zzzzz_account_deletion.test.sql`, `zzzz_content_reports.test.sql`
- `e2e/seo.spec.ts`
- `README.md`
- `LAUNCH_CHECKLIST.md`, `OPERATIONS.md`
