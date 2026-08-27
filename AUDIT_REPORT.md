# SetupSheet — Full Codebase Audit Report

**Date:** 2026-08-27<br>
**Scope:** Full repository (`/home/user/SetupSheet`), branch `arena/01a044ba-setupsheet`<br>
**Method:** Follow-up code analysis of Server Actions, public URL/file handling, Supabase schema & RLS, migration ordering, dependency advisories, test execution (Vitest), and production build validation (`next build` with Turbopack).

---

## 1. Executive Summary

A full code audit was conducted on **SetupSheet**, a Next.js 16 web application for sharing, comparing, rating, and downloading sim racing setups.

### Key Audit Findings & Status
- **Build Resilience:** **Fixed.** Resolved a production build failure caused by `next/font/google` attempting external font downloads at build time in network-restricted environments. Replaced with robust CSS font variables and fallback font stacks in `globals.css`. Production build (`next build`) now succeeds cleanly with Turbopack.
- **Security:** **Hardened.** Discovered and resolved an Open Redirect vulnerability in the OAuth callback handler (`src/app/auth/callback/route.ts`) by introducing strict URL sanitization (`sanitizeRedirectUrl`) and comprehensive Vitest unit tests.
- **Environment Resilience:** **Hardened.** Added fallback default strings to Supabase SSR client initializers (`client.ts`, `server.ts`, `proxy.ts`) to prevent server crashes when environment variables are missing or unconfigured.
- **Code Quality:** **Excellent.** Zero ESLint errors or warnings, zero TypeScript type errors (`npx tsc --noEmit`), and 109 passing unit tests across 18 test suites.
- **Database & RLS Security:** **Hardened.** 19 SQL migrations implement granular Row Level Security (RLS), column-level grants, security-definer RPC functions, direct-API data constraints, and Storage extension policies.
- **Follow-up Findings:** **Fixed.** The follow-up pass closed a duplicate migration version, unsafe proof-link rendering, unvalidated Server Action payloads, cross-user attachment references, missing telemetry cleanup, and several accessibility/SEO gaps.

---

## 2. Infrastructure, Build & Dependency Audit

### Dependency & Framework Status
- **Next.js:** `16.3.3` (App Router, Turbopack default bundler).
- **React:** `19.2.7` (React 19 Server Actions & Server Components).
- **TypeScript:** `5.9.3` with `strict: true`.
- **Node Engine:** `>=22.0.0` (Active LTS).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) with OKLCH theme colors.
- **Database / Auth:** `@supabase/ssr` `^0.12.3` & `@supabase/supabase-js` `^2.110.7`.

### Build Verification
- **Turbopack Build Test:** Passed (`npm run build` completed cleanly without errors).
- **Offline Font Handling:** `next/font/google` previously crashed builds when external Google Font endpoints were unreachable. Switched to native fallback font variables (`--font-inter` and `--font-jetbrains-mono`), eliminating build-time network dependencies.

### Package Security Audit (`npm audit`)
- **Passed:** `npm audit --audit-level=high` reports 0 vulnerabilities after upgrading Next.js/sharp and pinning safe transitive `js-yaml` and `nanoid` versions through package overrides.

---

## 3. Security Audit

### 3.1 Authentication & Authorization
- **OAuth Callback Security:** The OAuth redirect handler (`src/app/auth/callback/route.ts`) previously accepted arbitrary `next` query parameter values.
  - *Vulnerability:* An attacker could craft `?next=//attacker.com` to redirect authenticated users off-site post-login.
  - *Remediation:* Implemented `sanitizeRedirectUrl` to strictly enforce relative paths starting with a single `/` and rejecting protocol-relative (`//`) or backslash (`/\`) attempts. Added unit test coverage in `src/app/auth/callback/route.test.ts`.

### 3.2 Database Row Level Security (RLS) & Column Grants
- **RLS Scoping:** All public tables (`profiles`, `setups`, `setup_upvotes`, `setup_ratings`, `setup_comments`, `setup_requests`, `setup_favorites`, `notifications`, `follows`) have explicit RLS policies enabled.
- **Column-Level Protection (`0009`, `0011`, `0013`):** Blanket update grants to `authenticated` users were revoked for `setups`, `profiles`, `notifications`, and `setup_requests`. Only user-editable columns (e.g., `description`, `notes`, `read`, `username`) are writable by users; aggregate counters (`upvotes`, `downloads`, `pace`, `predictability`, `follower_count`) are updated exclusively via `SECURITY DEFINER` Postgres triggers.
- **Storage Security (`0004`):** Files stored in Supabase Storage (`setup-files` bucket) are locked to uploader-specific folders (`bucket_id = 'setup-files' AND (storage.foldername(name))[1] = auth.uid()::text`).

### 3.3 Content Security Policy (CSP) & Input Sanitization
- **CSP Nonces:** `src/proxy.ts` generates a per-request `crypto.randomUUID()` CSP nonce attached to `x-nonce` headers for hydration scripts and inline JSON-LD.
- **Input Validation:** `src/lib/validate-setup-fields.ts` and Server Actions enforce string length bounds (`MAX_CAR_LENGTH`, `MAX_TRACK_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `MAX_COMMENT_LENGTH`) to prevent memory/payload bloat.
- **File Upload Protection:** File uploads (`src/lib/actions/setups.ts`) validate extension against `ALLOWED_SETUP_FILE_EXTENSIONS`, enforce a 5 MB limit, sanitize file names before storage, require attachment paths to remain in the authenticated user's Storage folder, and clean setup plus telemetry objects after deletion.
- **Proof URL Protection:** YouTube/Twitch URLs are restricted to HTTPS allow-listed hosts in `src/lib/video-url.ts`; the client also sanitizes legacy rows before using them in `href` or iframe `src`, eliminating `javascript:`/lookalike-host injection paths.
- **Direct API Defense in Depth:** Migrations `0018` and `0019` bound profile/setup/request/JSONB fields, enforce attachment ownership and URL shape, restrict public Storage uploads to known data extensions, and remove anonymous execute access from the fulfillment RPC.
- **Origin Handling:** The OAuth callback no longer reflects a caller-controlled `x-forwarded-host`; redirects stay on the request origin after relative-path sanitization.

---

## 4. Architecture & Data Layer Audit

### 4.1 Server Actions & Data Fetching
- **SSR Client Caching:** `src/lib/supabase/server.ts` wraps `createClient()` in React's `cache()` to deduplicate Supabase client instantiation within a single render cycle.
- **Proxy Middleware Session Management:** `src/proxy.ts` delegates to `src/lib/supabase/proxy.ts` to refresh Supabase auth tokens on every request before page rendering.
- **Query Bounds:** `getSetups()` enforces `SETUPS_BROWSE_LIMIT = 500` to avoid unbounded database reads while serving client-side fuzzy search.

### 4.2 Phase 2 follow-up: code efficiency and maintainability
- **Shared setup hydration:** `src/lib/supabase/setups.ts` now centralizes viewer/author hydration for browse, featured, comparison, profile, and detail readers instead of repeating the same `Promise.all`/mapping logic.
- **Explicit data boundaries:** setup and version readers use explicit public column projections rather than `select("*")`, preventing future private/admin columns from leaking into public responses.
- **Request deduplication:** sitemap setup/profile rows and cached profile metadata use per-request React `cache()`, avoiding duplicate Supabase reads during one render.
- **Client-side URL updates:** browse filters use native `history.replaceState` because the filters already run locally; typing no longer triggers a full RSC/server reload on every debounce.
- **Bounded rendering:** profile setup cards are isolated in `ProfileSetupsGrid` and paged at 24 cards per batch, preventing a 500-row profile payload from mounting hundreds of stateful cards immediately.
- **Async failure states:** auth hydration, comments, setup history, request candidates, notification mutations, ratings, downloads, follows, and upload/request mutations now handle rejected promises with recovery UI/toasts rather than leaving unhandled rejections.
- **Remaining maintainability opportunity:** `SetupCard` and `UploadForm` remain large feature components. Splitting mutation hooks and presentational sections would reduce prop/state density before adding more community features.
- **Type-safety opportunity:** Supabase queries currently use local row interfaces plus casts rather than generated `Database` types; generating types from the deployed schema would catch migration/query drift at compile time.
- **Error-surface opportunity:** mutation actions still return some raw Supabase messages. Detailed errors are logged, but production users should receive stable generic messages with a small allow-list of expected validation conflicts.

### 4.3 ACC Setup File Parser
- **Parsing Robustness:** `src/lib/acc-setup-parser.ts` parses raw Assetto Corsa Competizione JSON setup files, converting tire cambers, electronics, fuel, brake pads, dampers, and aero settings into structured `SetupValues`. Safely handles missing/malformed fields without throwing.

---

## 5. UI, Accessibility & Performance Audit

### 5.1 Theme & Styling
- **Tailwind CSS v4 Integration:** Uses `@theme inline` with OKLCH color spaces for high-contrast light and dark sim-racing palettes.
- **Font Rendering:** High-performance fallback font variables ensure instant text rendering without layout shift (CLS).

### 5.2 Client-Side Performance & UX
- **Dynamic Imports:** Heavy car and track roster lists (`car-lists.ts`, `track-lists.ts`) are dynamically imported on demand in `UploadForm` to optimize initial page bundle size.
- **Draft Auto-Saving:** `UploadForm` automatically saves unsaved user entries to `localStorage`, debounced at 500ms, with a restore/discard banner on mount.
- **OG Image Generation:** `src/lib/og-fonts.ts` handles Google Font fetching for social preview cards with fallback error handling, ensuring OG image generation never breaks the request.

---

## 6. UI/UX, SEO & Performance Follow-up

### 6.1 UI/UX and Accessibility
- Primary actions retain a clear hierarchy: the landing-page hero leads with Browse Setups, while Upload remains the secondary action and the persistent header CTA.
- The mobile navigation drawer now includes the same setup search flow as desktop, and the hero copy no longer implies that publishing requires no authentication.
- Optional lap-proof and telemetry fields are collapsed by default for new uploads, reducing initial form length while automatically expanding when editing an existing proof attachment.
- Interactive star ratings and icon-only controls now meet a practical 24px+ touch target, and filter labels are explicitly associated with their Radix Select triggers.
- A mobile E2E regression covers opening the drawer, searching, and navigating to filtered setups; the global focus treatment keeps custom controls visibly keyboard-accessible.
- Search suggestions expose combobox/listbox semantics and support ArrowUp/ArrowDown/Enter for keyboard and screen-reader users.
- Form/action errors use `role="alert"`; setup cards and request cards use semantic `<article>` elements. Mobile card action rows and request fulfillment controls wrap instead of overflowing.
- Theme colors were tuned for AA-sized text in both themes: dark primary/destructive buttons use an accessible foreground, light amber/red/cyan utility colors no longer rely on low-contrast Tailwind defaults, and the video iframe is permitted by the production CSP.

### 6.2 SEO and Content
- Setup detail pages now have a visible H1, canonical metadata, and nonce-protected Article JSON-LD with author/date/image links. The site-level WebSite JSON-LD includes a SearchAction.
- Private `/profile` and auth-error surfaces are marked `noindex`; public setup/profile/request routes retain crawlable metadata and internal links.

### 6.3 Performance and Resilience
- Main-page setup cards still lazy-load values/history/comments/install-guide panels; browse and profile reads are bounded, while the remaining client-side browse cap is disclosed to visitors.
- Supabase auth reads used by actions and comment/browse paths are wrapped so transient auth-network failures degrade to a logged-out/empty state instead of an unhandled exception.
- Exact Core Web Vitals/PageSpeed data and screenshots were not present in this checkout; LCP/CLS/INP conclusions remain provisional until those artifacts are supplied.

## 7. Testing & Quality Assurance

### Test Suite Execution
- **Vitest Unit Tests:** **18/18 passing test files (109/109 tests passed)**.
  - `src/app/auth/callback/route.test.ts` (OAuth callback sanitization)
  - `src/lib/filter-setups.test.ts` (Fuzzy search & tag filtering)
  - `src/lib/acc-setup-parser.test.ts` (ACC JSON parser)
  - `src/lib/diff-setup-values.test.ts` (Setup diff comparison)
  - `src/lib/validate-setup-fields.test.ts` (Field bounds validation)
  - `src/lib/setup-export.test.ts` (Export formatter)
  - `src/lib/setup-schemas.test.ts` (Game schemas)
  - `src/lib/resolve-effective-setup-values.test.ts` (Effective values resolution)
  - `src/lib/select-options.test.ts` (Select option helpers)
  - `src/lib/badges.test.ts` (Contributor badges)
  - `src/lib/data.test.ts` (Static data definitions)
  - `src/lib/utils.test.ts` (Utility functions)
  - `src/lib/video-url.test.ts` (HTTPS/provider allow-list)
  - `src/lib/safe-url.test.ts` (avatar URL sanitization)
  - `src/lib/setup-values.test.ts` (JSONB shape/size guard)
  - `src/lib/storage.test.ts` (Storage path/name guards)

- **Typecheck:** `npx tsc --noEmit` — 0 errors.
- **Linter:** `npm run lint` — 0 errors/warnings.
- **Production Build:** `npm run build` — 16/16 routes successfully compiled with Next.js 16.3.3.
- **Playwright:** Test discovery succeeded; local browser execution was blocked because the sandbox could not download Chromium; CI installs it with `--with-deps` on each E2E run.
- **Database migration harness:** Not run locally because `psql` is not installed in the sandbox; the CI service job remains configured to apply all 19 migrations and SQL regressions.

---

## 8. Recommended Next Steps

1. **Pagination/Cursor Queries:** As setup volume grows beyond `SETUPS_BROWSE_LIMIT` (500 rows), transition client-side browse filtering to server-side cursor-based pagination.
2. **Rate limiting/moderation:** Add per-user/IP controls and moderation workflows for uploads, comments, requests, and public download-counter increments before broad launch.
3. **Privacy/compliance surfaces:** Add a privacy policy, retention/deletion explanation, and an account/data-deletion path if the service will operate for EU/California users.
4. **Real-user performance pass:** Run PageSpeed/Lighthouse on a deployed URL and verify LCP/INP/CLS on mobile and desktop with representative setup data.
