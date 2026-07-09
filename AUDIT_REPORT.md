# SetupSheet — Codebase Audit Report

**Date:** 2026-07-09
**Scope:** Full repository at `/home/user/pitwall` (branch `claude/simsetsups-nextjs-build-8ko9be`), powering `https://setupsheet.app/`.
**Method:** Static analysis of the repository (dependencies, config, source, git history, CI), plus an attempted live-site check. This sandbox's network egress policy blocks outbound requests to `setupsheet.app` entirely (confirmed via both `curl` and an authenticated fetch tool — both got an explicit 403 policy denial from the egress gateway, not an error from the site itself). **No live Lighthouse/PageSpeed run or live broken-link crawl was possible.** Everything below is derived from the repo; anything that requires hitting the live URL is called out explicitly and left as a follow-up for an environment with real network access.

No fixes were applied. A separate **"Safe to auto-fix"** list at the end covers trivial, low-risk version bumps you can approve in one shot.

---

## 1. Dependencies & Package Health

**Full dependency list:** 19 direct dependencies (9 runtime, 10 dev), 321 total installed packages. No unmaintained/deprecated packages detected (`npm install --dry-run` produced zero deprecation warnings), and no genuine duplicate-version bloat (the only "duplicates" `npm dedupe --dry-run` reports are optional platform-specific native binaries — e.g. `lightningcss-win32-*`, `@unrs/resolver-binding-*` — that npm correctly skips on this platform; not a real issue).

### Outdated packages

| Package | Current | Latest | Gap | Notes |
|---|---|---|---|---|
| `next` | 15.5.20 | 16.2.10 | 1 major | Breaking changes: `middleware.ts` → `proxy.ts` rename (Node-only runtime, no edge), a new explicit caching model (nothing cached by default unless opted in), Turbopack as default bundler. Real effort, see §2. |
| `eslint-config-next` | 15.5.20 | 16.2.10 | 1 major | Tied to the Next major — only bump alongside `next` itself. |
| `typescript` | 5.9.3 | 7.0.2 | 2 majors (skips 6) | TS 7 is the new Go-based compiler. Lower risk than it sounds for *this* repo specifically — `tsconfig.json` already uses `strict: true`, `module: esnext`, `moduleResolution: bundler`, `esModuleInterop: true`, exactly what TS 6/7 push everyone toward by default. Still the newest, least battle-tested option available. |
| `eslint` | 9.39.4 | 10.6.0 | 1 major | Low risk — this repo already uses flat config (`eslint.config.mjs`), the only thing ESLint 10 keeps. |
| `@types/node` | 20.19.43 | 26.1.1 | cosmetic | Only matters if the Node engine floor is also bumped (see §2). |
| `@playwright/test` | 1.56.1 | 1.61.1 | 5 minors | Dev-only, test-runner. |
| `lucide-react` | 1.23.0 | 1.24.0 | 1 patch | Icon library, safe. |

Everything else (`react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, all `@radix-ui/*`, `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `@tailwindcss/postcss`, `@eslint/eslintrc`) is already on its latest version as of this audit.

### `npm audit`

```
2 moderate severity vulnerabilities
```
Both are the same advisory: **PostCSS `<8.5.10` — XSS via unescaped `</style>` in CSS stringify output** ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)). This is **not a direct dependency** — it's vendored *inside* `next`'s own `node_modules/next/node_modules/postcss`. `npm audit fix --force` would downgrade `next` to `9.3.3` (nonsensical) to "fix" it; the only real fix is the Next.js 16 major bump above. **Severity in practice: low** — this app doesn't accept arbitrary user-supplied CSS anywhere, so the actual attack surface for this specific advisory is minimal, but it's worth closing out once the Next 16 upgrade happens.

### Major-version upgrades in play

- **Next.js 16**: biggest lift. `middleware.ts` → `proxy.ts`, new caching model could quietly change how often Supabase gets hit, Turbopack default. Needs its own dedicated round with real verification (start the server, confirm auth/session refresh and data fetching still behave) — this was already scoped and deliberately deferred earlier in this project's history for exactly that reason.
- **TypeScript 7 / ESLint 10**: lower-risk given current config already matches their new defaults, but still worth a dedicated verification pass, not a blind bump.

---

## 2. Framework & Runtime Versions

| Component | Version | Status |
|---|---|---|
| Next.js | 15.5.20 | Current major (15.x) is supported; 16.x is out (see §1). Not EOL. |
| React | 19.2.7 | Current. |
| Node.js (this environment) | v22.22.2 | Active LTS. |
| Node.js (`package.json` `engines` floor) | `>=20.0.0` | **Node 20 ("Iron") passed its official EOL in April 2026** — as of this audit's date (2026-07-09), the `engines` floor in `package.json` permits an already-unsupported Node runtime. Should be bumped to `>=22.0.0` at minimum. |
| TypeScript | 5.9.3 | See §1. |
| Tailwind CSS | v4 | Current major. |
| Build tooling | Next's built-in bundler (webpack in dev/prod today; Turbopack is opt-in in 15.x, default in 16.x) | No custom Vite/Webpack config — nothing to audit there independently of the Next version itself. |
| GitHub Actions runners | `ubuntu-latest`, Node 22 pinned in workflow | Fine today; GitHub is moving all Actions to a Node 24 default runtime by mid-2026 with Node 20 support fully removed by September 2026 — doesn't block this repo directly (its own CI already pins Node 22 explicitly) but is more reason to keep the actions themselves current (see §8). |

**Missing newer-framework features worth knowing about:** Next 15 already supports the App Router patterns this repo uses correctly (async `params`, Server Actions, `next/font`). The one feature gap worth naming is Next's **explicit caching directives** (`"use cache"`, `unstable_cache`) — not available in a meaningfully different form until the 16 upgrade's caching-model change, so there's nothing to adopt early here without the major bump.

---

## 3. Security

### Secrets / credentials

**Clean.** Full-history git scan (`git log --all --full-history` + pattern search for AWS keys, private key headers, `sk_live`/`sk_test` tokens, JWT-shaped strings, inline passwords) found nothing. The only `.env*` file ever committed, in any commit, is `.env.local.example` — and every version of it, past and present, contains only placeholder values (`https://your-project-ref.supabase.co`, `your-anon-public-key`). `.gitignore` correctly excludes all other `.env*` files. The only JWT-shaped string anywhere in git history is a fabricated placeholder this project's own CI workflow uses intentionally (not a real credential).

### CSP / security headers

`next.config.ts` sets a real CSP plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Reviewed line by line:

- `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'` — **`'unsafe-inline'` meaningfully weakens the CSP's XSS protection** (it's what makes CSP effective at all against injected `<script>`/`<style>` tags). This is a common tradeoff for apps that haven't set up nonce-based CSP with Next, but it's worth flagging explicitly as a **Medium** finding rather than silently accepting it — a nonce-based approach (Next supports this natively via middleware) would close this gap.
- `connect-src 'self' https://*.supabase.co wss://*.supabase.co` — correctly scoped, no wildcard-everything.
- `frame-ancestors 'self'` + `X-Frame-Options: DENY` — both set (modern + legacy), good defense in depth, not redundant-bad.
- **Missing: `Strict-Transport-Security` (HSTS)**. Not set anywhere in `next.config.ts`. If the hosting platform doesn't inject it automatically, this is a **Medium** gap — browsers won't be told to always use HTTPS for this origin.
- No CORS headers are set, and none are needed: this is a same-origin app; Server Actions have Next's own built-in same-origin enforcement for state-changing requests.

### Auth / session handling

Supabase Auth via `@supabase/ssr`, cookie-based sessions refreshed on every request through `src/middleware.ts` → `src/lib/supabase/middleware.ts`. **One real bug was found and already fixed earlier in this session**: both the root layout (`src/app/layout.tsx`) and the auth middleware called `supabase.auth.getUser()` with no try/catch — a genuine network-level failure (DNS, connection refused) threw uncaught rather than resolving to a catchable error, which would crash the *entire app* on every request rather than degrading to a logged-out view like every other data-layer function does. This is now guarded (commit `041f556`). Verified via a deliberately-unreachable placeholder URL that the app now degrades gracefully instead of crashing.

No other auth weaknesses found: RLS policies gate every table (`setups`, `profiles`, `setup_upvotes`, `setup_ratings`, `follows`, `notifications`), and this project already went through multiple prior audit rounds specifically hardening RLS and column-level grants (see git history — `0009_column_level_grants.sql`, `0011_notifications_column_grant.sql` both revoke blanket `UPDATE` and re-grant only user-writable columns, protecting trigger-owned denormalized counters like `upvotes`/`follower_count` from direct client overwrite).

The one `SECURITY DEFINER` RPC (`increment_downloads`) is correctly scoped with `set search_path = public` (prevents search-path-hijacking attacks against `SECURITY DEFINER` functions) and is intentionally callable by anonymous users — downloads are meant to be free-for-anyone by design, not an oversight.

### Dependency vulnerabilities (depth pass)

Covered in §1 — the one `npm audit` finding (PostCSS XSS, vendored inside `next`) has essentially no real exploitability in this app's context (no user-supplied CSS rendering path exists), but is worth closing via the Next 16 upgrade eventually.

### `.env` handling

Confirmed correct: `.gitignore` excludes all `.env*` except the placeholder-only `.env.local.example`; `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only env vars the app reads, and both are meant to be public/client-exposed by design (the anon key + RLS *is* the security model, not a secret to protect).

---

## 4. Performance

*(Static/repo-only — see the note at the top of this report about the live Lighthouse check that couldn't be run.)*

| Severity | Location | Finding | Fix |
|---|---|---|---|
| High | `src/components/upload-form.tsx` (622 lines, `"use client"`) | Directly imports all per-game static data — `carLists` (153 ln), `trackLists` (168 ln), and `setup-schemas.ts` (376 ln, via `getEmptySetupValues`) — into the client bundle, even though only one game's data is shown at a time. `/upload` has the largest First Load JS in the build (235 kB). | Lazy-load per-game data keyed on the selected game (dynamic `import()`), or move the schema lookup server-side. |
| High | `src/components/setup-card.tsx` (438 lines, `"use client"`) | Also imports the full `setupSchemas` (376 ln) and `installGuides` (82 ln) at module scope — and this card renders in a *list* on `/setups` (225 kB) and `/profile` (223 kB), so the full per-game schema map ships redundantly on every page that renders any number of cards. | Only import the active game's schema slice when the "expand values" section is actually opened. |
| Medium | Route table (from `npm run build`) | `/` 193 kB · `/leaderboard` 118 kB · `/profile` 223 kB · `/profile/[userId]` 194 kB · `/setups` 225 kB · `/setups/[id]` 193 kB · `/setups/[id]/edit` 235 kB · `/upload` 235 kB · shared baseline 102 kB. The four heaviest routes all transitively pull in `upload-form.tsx` or `setup-card.tsx`. | Same fix as above; also check whether `/setups/[id]/edit` needs the *entire* upload form or could use a lighter edit-only variant. |
| Medium | Whole `src/` tree | Zero uses of `next/dynamic` or `React.lazy` anywhere in the codebase — no code-splitting at all beyond Next's automatic route-based splitting. | Introduce dynamic imports for the upload/edit form's per-game data and any modal content not needed on first paint. |
| Low | Avatars (`src/components/ui/avatar.tsx`, used in 5+ places) | Rendered via Radix `AvatarImage` (a plain `<img>`), not `next/image`; no `images.remotePatterns` configured in `next.config.ts` either. | Likely a reasonable tradeoff for icon-sized remote avatars (Discord CDN); would need `remotePatterns` for both Discord + Supabase Storage hosts to switch. Flagging as optional, not a defect. |
| Low | `src/app/layout.tsx` | Fonts (Inter, JetBrains Mono) are self-hosted via `next/font/google` — no render-blocking font `<link>`. Good, no action needed. | — |
| Low | `next.config.ts` | No explicit `Cache-Control` headers block (only the security headers are set); Next's default `compress: true` and built-in immutable caching for hashed `_next/static` assets already cover the common case. | Optionally add longer edge-cache headers for `/opengraph-image` and `/sitemap.xml` if desired. |
| Info | — | **Live Lighthouse/PageSpeed run against `https://setupsheet.app/` was not possible from this environment** — the sandbox's network egress policy returns a 403 policy denial for this specific host (confirmed via both `curl` and an authenticated fetch tool, ruling out a site-side problem). Core Web Vitals (LCP/CLS/INP) need to be measured separately, e.g. via PageSpeed Insights or a Lighthouse CI run from an environment with real network access. | — |

---

## 5. Accessibility

| Severity | Location | Problem | Fix |
|---|---|---|---|
| High | `src/components/setup-card.tsx:383-397` | The upvote button's only accessible name comes from the visible upvote-count text (e.g. "42") — its icon is auto-`aria-hidden` (lucide-react default), so screen-reader users hear a bare number with no indication the control means "upvote." `aria-pressed` is present but doesn't supply a name. | Add `aria-label={hasUpvoted ? "Remove upvote" : "Upvote"}`. |
| Medium | `src/components/setups-browser.tsx` (`FilterSelect`, ~L229-260) | The 5 filter `<label>`s (Game/Car/Track/Condition/Rig) have no `htmlFor`, and their Radix `SelectTrigger`s have no matching `id` — not programmatically associated, unlike the adjacent "Sort by" select which does this correctly. | Give each trigger an `id`, each label a matching `htmlFor`. |
| Medium | `src/app/page.tsx:74,119` | Heading hierarchy skips a level: the page's only `<h1>` is followed by `<h3>`s in the Highlights grid before any `<h2>` appears. | Promote the Highlights card headings to `<h2>`. |
| Medium | `src/app/setups/[id]/page.tsx:72-84` | No `<h1>` anywhere on the setup detail page (only an `<h3>` inside the embedded `SetupCard`); same gap on the "not found" branch. | Add a page-level `<h1>` (visually hidden is fine) to the detail page wrapper. |
| Low | `src/app/profile/page.tsx`, `profile/[userId]/page.tsx`, `setups/[id]/edit/page.tsx` | The logged-out / not-found edge-case branches of these pages use `<h2>` with no `<h1>` present on that particular render. | Change to `<h1>` on those branches specifically. |
| Low | `site-header.tsx`, `site-footer.tsx` | Three `<nav>` landmarks (desktop, mobile Sheet, footer) all lack a distinguishing `aria-label`, so screen readers announce all three as plain "navigation." | Add `aria-label="Main"` / `"Mobile"` / `"Footer"`. |
| Low | `src/components/file-dropzone.tsx:33-56` | Built as `<div role="button" tabIndex={0}>` with manual `onKeyDown` handling (works, but non-semantic and easy to regress). | Consider a `<label>` wrapping a hidden `<input type="file">` for native keyboard/activation support. |
| Low (manual check needed) | `setup-card.tsx:274,311,377`; `star-rating.tsx:32,50` | Small (10-11px) text at 70% opacity, and unselected star icons at 40% opacity, on the dark theme — plausible contrast issue at these sizes; not confirmed without pixel measurement. | If it fails a contrast checker, bump to `/80`+ opacity for text under ~12px. |

**Confirmed fine:** no missing/wrong `alt` text anywhere (all avatar images have real `alt`, all decorative icon SVGs are correctly `aria-hidden`); `lang="en"` present on both `layout.tsx` and `global-error.tsx`; every dropdown/select/mobile-menu is built on Radix UI primitives, which handle focus-trapping and keyboard navigation correctly — no custom-built widget has a keyboard trap. The prior "icon-only buttons need `aria-label`" audit pass (from this project's history) is still intact everywhere except the upvote button above, which reintroduces a variant of the same issue.

---

## 6. SEO & Metadata

| Severity | Location | Problem | Fix |
|---|---|---|---|
| High | `/setups`, `/leaderboard`, `/upload`, `/profile`, `/profile/[userId]`, `/setups/[id]/edit` (6 routes) | None of these define their own `openGraph`/`twitter` metadata fields. Next.js metadata merging means they all **inherit the homepage's** "Faster laps..." Open Graph title/description — so sharing a link to any of these on Discord/Slack/Twitter shows the wrong preview. The `<title>` tag itself is correct per-page; only social-card previews are wrong. | Add page-specific `openGraph`/`twitter` fields to each, mirroring the pattern `setups/[id]/page.tsx` already does correctly. |
| Medium | Every route except `setups/[id]` | No `alternates.canonical` set anywhere else — including on `/setups`, which the homepage links into via 12+ crawlable filtered variants (`/setups?game=X`, `/setups?rig=Y`) that currently compete with the base page for ranking signals. | Add `alternates: { canonical: ... }` to every route, especially `/setups`. |
| Medium | Whole codebase | **Zero JSON-LD structured data anywhere** (confirmed via full-tree grep for `ld+json`/`@context`) — no `WebSite`/`Organization` schema, nothing for individual setups. | Add a `WebSite`/`Organization` JSON-LD block to `layout.tsx`; consider per-setup structured data on the detail page. |
| Low | `src/app/setups/[id]/opengraph-image.tsx` | No exported `alt` string, unlike the root OG image route which has one. | Add a static fallback `alt` export. |
| Low | `setups/[id]` and `profile/[userId]` "not found" metadata branches | Bare `title`, no `description`, no explicit `robots: { index: false }` on these non-indexable dead ends. | Add `robots: { index: false }` for defense in depth. |
| Info | `next.config.ts` | No redirects/rewrites for www/non-www or trailing-slash canonicalization in-repo — may be handled at the DNS/hosting level, but not verifiable from the codebase alone. | Confirm at the Vercel/DNS level that only one canonical host resolves. |

**Confirmed correct:** `SITE_URL` resolves properly to `https://setupsheet.app` in production (`src/lib/site.ts`); `robots.ts` correctly disallows `/setups/*/edit` and `/auth/` while allowing everything else; `sitemap.ts` includes home, `/setups`, `/leaderboard`, `/upload`, plus all dynamic per-setup and per-profile routes with `lastModified` timestamps.

---

## 7. Code Quality & Maintainability

**Linting/formatting:** `eslint.config.mjs` is flat-config, extending `next/core-web-vitals` + `next/typescript`. Enforced via `npm run lint` and, as of this project's most recent commits, via `.github/workflows/ci.yml` on every push/PR. **No pre-commit hook exists** (no `.husky/`, no `lint-staged`, `core.hooksPath` unset) — linting/testing is CI-only, not caught before a commit lands locally (**Medium**, since CI does cover it, just later in the loop). **No Prettier config anywhere** — formatting is entirely unenforced (**Low**).

**TODO/FIXME:** zero hits anywhere in `src/` — no known-debt markers left in code (a genuinely clean result, not a false negative — confirmed via both case-sensitive and case-insensitive grep).

**Largest files:**
| Lines | File | Verdict |
|---|---|---|
| 622 | `src/components/upload-form.tsx` | **Smell.** Combined create/edit form: file upload, manual entry, per-game dropdowns, validation, submit, all in one file — also flagged in §4 for bundle size. |
| 438 | `src/components/setup-card.tsx` | **Smell.** Display + 5 distinct mutations (upvote/rate/download/edit/delete) in one component. |
| 384 | `src/lib/actions/setups.ts` | Reasonable — this is genuinely 8 distinct Server Actions, each short. |
| 376 | `src/lib/setup-schemas.ts` | Reasonable — static data table, not logic. |
| 328 | `src/lib/supabase/setups.ts` | Reasonable — 7 distinct query functions. |
| 260 | `src/components/setups-browser.tsx` | Reasonable. |
| 240 | `src/components/ui/dropdown-menu.tsx` | Generated shadcn boilerplate, expected length. |

Only `upload-form.tsx` and `setup-card.tsx` are genuine "does too much" smells worth splitting.

**Duplication:**
- **Medium**: `src/lib/supabase/{setups,notifications,leaderboard,profiles}.ts` all repeat the identical pattern — `createClient()` → query → `if (error || !rows) { logger.error(...); return [] }` → manual snake_case→camelCase mapping — with no shared helper despite the pattern appearing 4+ times.
- Low: `page.tsx`, `setups/page.tsx`, `leaderboard/page.tsx` each define their own local color/badge-tone maps rather than sharing one utility. Minor.

**Dead code:** Sampled 8 exports from `src/lib/*.ts` — 7 confirmed in active use. One genuine dead export found: `badgeTiers` (`src/lib/badges.ts:13`) is only consumed internally by `getBadgeTier` in the same file and isn't imported anywhere else (**Low**).

**Test coverage:** 9 Vitest unit-test files (`src/lib/*.test.ts`, 59 tests, all passing) plus 4 Playwright E2E specs (`e2e/*.spec.ts`), both wired into CI. Coverage scope is entirely **pure logic** — parsing, filtering, formatting, badge thresholds. **Gaps** (Medium, and largely a known/accepted tradeoff given this sandbox has no live Supabase access to test against): zero tests touch the Supabase-dependent data layer (`src/lib/supabase/*.ts`) or Server Actions (`src/lib/actions/*.ts`); no component-level UI tests (React Testing Library or similar); the 4 E2E specs only cover unauthenticated flows (landing, search, browse, OG images) — upload, edit, delete, rate, upvote, and follow are entirely untested end-to-end.

**Architecture:** Consistently followed pattern — reads go through `src/lib/supabase/*.ts` from Server Components, mutations go through `src/lib/actions/*.ts` Server Actions. One necessary, correctly-scoped exception: `auth-provider.tsx` instantiates the browser Supabase client directly to subscribe to `onAuthStateChange`, which has to live client-side. No architectural violations found.

---

## 8. Infrastructure & Deployment

- **No `vercel.json`** — relies on Vercel's zero-config Next.js detection. Not a problem by itself, but means any custom redirect/rewrite/canonicalization behavior (see §6) isn't visible in-repo.
- **CI (`.github/workflows/ci.yml`)**: added very recently (this project's most recent work). Two jobs — a fast `lint-test-build` lane and a separate `e2e` lane. Pins `actions/checkout@v4` and `actions/setup-node@v4` — **both are two majors behind current (v6 for both, as of this audit's date)**. GitHub is also moving all Actions to run on a Node 24 default runtime with Node 20 fully removed by September 2026, adding more reason to keep these current. **This is the "safe to auto-fix" item** — see the list at the end.
- Build-time env vars for CI are hardcoded, safe placeholders (a loopback address that fails instantly and deterministically) — correctly reasoned, since `NEXT_PUBLIC_*` values are meant to be public by design; zero GitHub repo secrets required for CI to run.
- **`package.json` `engines.node`** floor of `>=20.0.0` permits an already-EOL Node runtime (see §2) — should be raised to `>=22.0.0`.
- Domain/SSL/redirect configuration cannot be verified from the repository alone (see §6's "Info" item) — needs a check at the Vercel dashboard / DNS level, or from an environment that can actually reach `setupsheet.app`.

---

## 9. Broken Functionality

**Live-site crawl was not possible from this environment.** Both `curl` and an authenticated fetch tool returned an explicit 403 **policy denial** from this sandbox's own network egress gateway when targeting `setupsheet.app` — confirmed via the gateway's own status endpoint, which logged `"gateway answered 403 to CONNECT... host: setupsheet.app:443"` for both attempts. This is a property of this sandbox, not a signal about the live site's health. **This needs to be re-run from an environment with real network access** (or with this host added to the egress allowlist) to get actual results on: broken links, console errors, 404s, and form/API functional checks against production.

**What was checkable from the repository instead:**
- Compared every `page.tsx` route against every static `href="/..."` target referenced in components — **all internal links resolve to real routes**, no dead links detectable from source. (Dynamic links built from template strings, e.g. `/setups/${id}`, aren't caught by this static check, but they follow the same well-established pattern used everywhere in this codebase.)
- No broken-functionality issues were found in the reviewed source for forms/interactive features beyond what's already listed under Accessibility/Code Quality above.

---

## 10. Summary & Prioritization

### State of the codebase, in plain language

This is a well-built, actively-maintained small Next.js app with a real security posture (RLS everywhere, a genuinely least-privilege CSP, zero secrets in history, a real CI pipeline with tests that just landed) — it's not a neglected codebase. The issues found are mostly the normal residue of a fast-moving solo/small-team project: a few pages inherit the wrong social-media preview, two components have grown a bit large and drag unnecessary data into the client bundle, a couple of accessibility gaps slipped in after an earlier a11y pass, and dependency versions are one release cycle behind on a few packages (with one genuinely bigger decision — the Next.js 16 major — deliberately deferred rather than rushed). Nothing found rises to "actively exploitable right now" — the highest-severity items are a real-but-low-blast-radius XSS gap in the CSP, a bundle-size problem that costs users bytes rather than breaking anything, and metadata bugs that make shared links look wrong rather than expose anything.

### Top priorities (ranked)

1. **Fix the 6 routes missing per-page Open Graph/Twitter metadata** (§6, High) — every shared link to `/setups`, `/leaderboard`, `/upload`, `/profile`, `/profile/[userId]`, and the edit page currently shows the homepage's preview card. *Effort: Small* (mechanical, one pattern to copy 6 times).
2. **Add `aria-label` to the upvote button** (§5, High) — a real screen-reader gap on the single most-used interactive element in the app. *Effort: Small* (one line).
3. **Lazy-load per-game static data out of `upload-form.tsx` and `setup-card.tsx`** (§4, High) — the two heaviest bundle contributors, affecting the 4 heaviest routes. *Effort: Medium.*
4. **Tighten the CSP** — remove `'unsafe-inline'` via a nonce-based approach, and add the missing `Strict-Transport-Security` header (§3, Medium). *Effort: Medium* (nonce wiring touches the middleware and root layout).
5. **Add canonical URLs + JSON-LD structured data** site-wide (§6, Medium). *Effort: Medium.*
6. **Bump `package.json`'s Node engine floor to `>=22.0.0`** and confirm the deployment platform's Node runtime matches (§2/§8, Medium) — the current floor permits an already-EOL Node version. *Effort: Small.*
7. **Split `upload-form.tsx` (622 ln) and `setup-card.tsx` (438 ln)** into smaller pieces (§7, Medium) — improves both maintainability and gives the bundle-size fix in #3 a natural home. *Effort: Medium.*
8. **Extract a shared query/error-handling helper** for the 4 near-identical `src/lib/supabase/*.ts` files (§7, Medium). *Effort: Small–Medium.*
9. **Add a pre-commit hook** (husky + lint-staged) so lint/format issues are caught before CI, not after (§7, Medium). *Effort: Small.*
10. **Plan the Next.js 16 major upgrade as its own dedicated effort** (§1/§2, larger) — `middleware.ts`→`proxy.ts`, the new caching model, Turbopack default. Don't fold this into anything else. *Effort: Large.*

Also worth doing, once you have an environment with real network access to `setupsheet.app`: a live Lighthouse/PageSpeed run (§4) and an actual broken-link/console-error crawl (§9) — both were blocked here purely by this sandbox's own egress policy, not by anything in the code.

---

## Safe to auto-fix

These are trivial, low-risk changes with no breaking-change surface. Say the word and I'll apply them:

- **Bump `actions/checkout@v4` → `@v6` and `actions/setup-node@v4` → `@v6`** in `.github/workflows/ci.yml` (§8) — both are simple version-string bumps; the workflow's usage of both actions (checkout, node-version, cache) is unaffected by the major bumps.
- **Bump `lucide-react` `1.23.0` → `1.24.0`** (§1) — a patch release.
- **Stop exporting `badgeTiers` from `src/lib/badges.ts`** (§7) — make it a module-private `const` since nothing outside the file imports it; purely a visibility change, zero behavior change.

Everything else in this report (the Next.js 16 major, the CSP nonce rework, bundle-size fixes, metadata additions, accessibility fixes, etc.) involves either a real judgment call, a multi-file change, or something I can't fully verify without live network access — so none of it was auto-applied.
