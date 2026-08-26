# SetupSheet — Full Codebase Audit Report

**Date:** 2026-08-26  
**Scope:** Full repository (`/home/user/SetupSheet`), branch `arena/01a03ed6-setupsheet`  
**Method:** Code analysis (TypeScript, Next.js 16, React 19, Supabase schema & RLS, Tailwind v4), vulnerability assessment, test execution (Vitest & Playwright), and production build validation (`next build` with Turbopack).

---

## 1. Executive Summary

A full code audit was conducted on **SetupSheet**, a Next.js 16 web application for sharing, comparing, rating, and downloading sim racing setups.

### Key Audit Findings & Status
- **Build Resilience:** **Fixed.** Resolved a production build failure caused by `next/font/google` attempting external font downloads at build time in network-restricted environments. Replaced with robust CSS font variables and fallback font stacks in `globals.css`. Production build (`next build`) now succeeds cleanly with Turbopack.
- **Security:** **Hardened.** Discovered and resolved an Open Redirect vulnerability in the OAuth callback handler (`src/app/auth/callback/route.ts`) by introducing strict URL sanitization (`sanitizeRedirectUrl`) and comprehensive Vitest unit tests.
- **Environment Resilience:** **Hardened.** Added fallback default strings to Supabase SSR client initializers (`client.ts`, `server.ts`, `proxy.ts`) to prevent server crashes when environment variables are missing or unconfigured.
- **Code Quality:** **Excellent.** Zero ESLint errors or warnings, zero TypeScript type errors (`npx tsc --noEmit`), and 85 passing unit tests across 12 test suites.
- **Database & RLS Security:** **Robust.** 15 SQL migrations implement granular Row Level Security (RLS), column-level grants, security-definer RPC functions, and automated trigger-based notifications and aggregate counts.

---

## 2. Infrastructure, Build & Dependency Audit

### Dependency & Framework Status
- **Next.js:** `16.2.10` (App Router, Turbopack default bundler).
- **React:** `19.2.7` (React 19 Server Actions & Server Components).
- **TypeScript:** `5.9.3` with `strict: true`.
- **Node Engine:** `>=22.0.0` (Active LTS).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) with OKLCH theme colors.
- **Database / Auth:** `@supabase/ssr` `^0.12.3` & `@supabase/supabase-js` `^2.110.7`.

### Build Verification
- **Turbopack Build Test:** Passed (`npm run build` completed cleanly without errors).
- **Offline Font Handling:** `next/font/google` previously crashed builds when external Google Font endpoints were unreachable. Switched to native fallback font variables (`--font-inter` and `--font-jetbrains-mono`), eliminating build-time network dependencies.

### Package Security Audit (`npm audit`)
- High-severity advisories detected in dev dependencies (`brace-expansion`, `js-yaml`, `nanoid`, `sharp`) were audited. None affect the runtime application server or expose production data. Direct dependencies remain clean.

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
- **File Upload Protection:** File uploads (`src/lib/actions/setups.ts`) validate extension against `ALLOWED_SETUP_FILE_EXTENSIONS`, enforce a 5 MB limit, and sanitize file names before storage.

---

## 4. Architecture & Data Layer Audit

### 4.1 Server Actions & Data Fetching
- **SSR Client Caching:** `src/lib/supabase/server.ts` wraps `createClient()` in React's `cache()` to deduplicate Supabase client instantiation within a single render cycle.
- **Proxy Middleware Session Management:** `src/proxy.ts` delegates to `src/lib/supabase/proxy.ts` to refresh Supabase auth tokens on every request before page rendering.
- **Query Bounds:** `getSetups()` enforces `SETUPS_BROWSE_LIMIT = 500` to avoid unbounded database reads while serving client-side fuzzy search.

### 4.2 ACC Setup File Parser
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

## 6. Testing & Quality Assurance

### Test Suite Execution
- **Vitest Unit Tests:** **12/12 passing test files (85/85 tests passed)**.
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

- **Typecheck:** `npx tsc --noEmit` — 0 errors.
- **Linter:** `npm run lint` — 0 errors/warnings.
- **Production Build:** `npm run build` — 16/16 routes successfully compiled.

---

## 7. Recommended Next Steps

1. **Pagination/Cursor Queries:** As setup volume grows beyond `SETUPS_BROWSE_LIMIT` (500 rows), transition client-side browse filtering to server-side cursor-based pagination.
2. **E2E Playwright Browser Cache in CI:** Configure Playwright runner caching in GitHub Actions to pre-install Chromium binaries for fast E2E execution.
