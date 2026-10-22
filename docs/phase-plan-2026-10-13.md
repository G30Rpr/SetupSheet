# SetupSheet — combined plan for prompts 1–4 (2026-10-13)

Status: **proposed, not approved.** No code has been written. This document
reconciles the four briefs with what is actually in the repo today and lays
out the work in reviewable phases/commits.

---

## 1. Stack summary

- **Next.js 16.3 (App Router)**, React 19, TypeScript, Tailwind CSS v4
  (`src/app/globals.css` holds the theme tokens), shadcn/ui-style primitives
  in `src/components/ui`, lucide-react icons, sonner toasts.
- **Supabase**: Postgres + Auth (Discord OAuth) + Storage. Client via
  `@supabase/ssr` (`src/lib/supabase/`), server actions in
  `src/lib/actions/`, 35 hand-written SQL migrations in
  `supabase/migrations/` (source of truth for schema/RLS; applied via SQL
  Editor or `supabase db push`).
- **Fonts/tokens already match prompt 3**: Inter (`--font-sans`) + JetBrains
  Mono (`--font-mono`), dark-first with `--racing-coral` as primary action,
  cyan data accents, amber/green available in the theme. Prompt 3's hex
  values map onto the existing oklch tokens — audit/align rather than
  re-invent.
- **Testing**: vitest (unit, `src/**/*.test.ts(x)`), Playwright (`e2e/`),
  `scripts/test-db.sh` (spins a scratch Postgres, applies every migration,
  runs `supabase/testing/*.test.sql`), eslint + typecheck + husky.
- **No `.env.local` in this sandbox** — no live DB connection here. Schema
  inspection is from migrations + `seed.sql`; DB assertions run through
  `test-db.sh`; live apply happens on your Supabase project as documented in
  the README.

## 2. Data model summary (from migrations)

| Table | Purpose | RLS highlights |
|---|---|---|
| `profiles` | mirror of auth.users (username, avatar) | public read, owner update; auto-created on signup |
| `setups` | game/car/track/condition, `lap_time`, `tags` (Safe/Beginner/Quali/Race/Aggressive/Wet Weather), `rig_profile` (4 combined categories), `setup_values` jsonb (per-game field maps, see `src/lib/setup-schemas.ts`), file path/name, denormalized `pace`/`predictability` (numeric 2,1) + `rating_count`, `upvotes`, `downloads`, video/telemetry | public read; owner insert/update/delete; column-level grants hardening (0009/0018) |
| `setup_ratings` | one row per (user, setup): pace, predictability 1–5 | owner-only rows; trigger recomputes `setups.pace/predictability/rating_count` as a **plain average of all rows — including the author's own rating** |
| `setup_upvotes`, `setup_favorites`, `setup_comments`, `follows` | social | owner-scoped; upvote-of-own-setup blocked in the action only |
| `setup_versions` | edit snapshots (public changelog) | public read, trigger-written |
| `setup_requests` | requests board; `fulfill_setup_request()` SECURITY DEFINER RPC + hardening (0016); "Most wanted" view (0027) | public read; fulfillment via RPC only (column grants block fake fulfillment) |
| `garage_sessions`, `garage_revisions`, `garage_run_plan_items`, `garage_laps` (0030/0031) | **private** Garage workflow | owner-only, heavy RLS test suite in `supabase/testing/garage_rls.test.sql` |
| `field_test_reports` (0032) | public reports derived from Garage laps | public read; uniqueness/concurrency tested |
| `notifications`, `content_reports`, `account_deletion_requests` | moderation/platform | owner-scoped |
| Storage buckets | `setup-files` (public read, owner-folder writes), plus proof/telemetry buckets with limits (0029) and GC (0028) | foldername-scoped policies |

RPCs/views: `increment_downloads`, `create_setup_with_rating` (setup +
uploader's own rating in one tx — **this inserts a self-rating today**),
`fulfill_setup_request`, leaderboard view (0006), `profile_setup_stats`,
`setup_search` view.

## 3. What the prompts ask for vs. what already exists

Already in the repo (mostly prompt-2 territory, built earlier):

- ACC JSON parser + car-name map (`src/lib/acc-setup-parser.ts`, tested).
- Manual `setup_values` per-game schemas (`setup-schemas.ts`), value diffing
  (`diff-setup-values.ts`) and a `/setups/compare` page (same-game only, full
  field list, no "changed only" toggle, no file-parser-driven values).
- Install bundle + install guides (destination folder, copy button).
- Requests board with fulfillment RPC and own-setup matching.
- Garage private sessions + public field-test reports derived from laps.
- Upload auto-detect for ACC files (fills car), optional proof/telemetry
  fields, notifications, comments, favorites, version history.

Still missing (the actual work):

- **Trust layer**: no self-rating block anywhere (action, RPC or RLS);
  `create_setup_with_rating` inserts the author's rating by design; no
  Bayesian ranking; no rating-count/tier treatment on cards (a lone 4.2 with
  a star looks like consensus); no Pace/Predictability tooltips.
- **Homepage**: still the manifesto hero with "N community setups ·
  8 sim titles supported", "Most upvoted" section, feature cards.
- **Cards**: still carry install guide + version history + comments
  accordions, upvote/favorite controls, "Be the first" download count.
- **Browse**: no query-string prefill from a finder, no "Best match" sort,
  no hidden-rig line, empty state is generic (not a request+engineer
  handoff).
- **Nav**: Home / Browse Setups / Engineer / Garage / Requests / Leaderboard
  / Upload all in the top nav.
- **Detail**: no "Who this is for" line, field-test module can render a
  public error, upvote/download noise, no score definitions.
- **Phase 2/3**: LMU `.svm` parser, normalized sheet rendering with range
  bars/medians, `game_version` + staleness, two-axis rig profile + saved
  rig + per-rig sub-scores, rater's-rig ratings ("On a similar rig"), author
  note (3 prompts) + "File only" label, related setups by car×track, request
  prefill/fulfill-credit flow, post-download rating prompt, Garage-verified
  rating weight, leaderboard rework, Engineer loop.

## 4. Prompt conflicts and proposed resolutions

| # | Conflict | Resolution (default) |
|---|---|---|
| 1 | P1 homepage (per-sim counts, "Fresh this week", pledge) vs P3 homepage (combo finder is "the page") | **P3 wins.** The finder *is* the honest-coverage answer: no counts, no claims. P1's coverage acceptance is met by never misstating coverage. |
| 2 | P1 nav ("Fix My Car", "My Garage") vs P3 nav (Browse, Engineer, Requests; Garage/Leaderboard out of top nav) | **P3 wins.** P2 later assumes P3's world. Garage stays reachable from account menu/upload; Leaderboard footer-only. |
| 3 | P1 "replace 'Be the first' with '0 downloads'" vs P3 "never show '0 downloads'" | **P3 wins**: zero download counts are simply not displayed. |
| 4 | P1 tiers (Unrated <3, Early 3–9, Established 10+) vs P3 tiers (Unrated 0, Early 1–4, Established 5+) | **P3 wins** (it is the copy spec). Bayesian ranking satisfies P1's acceptance ("1 rating never outranks better-evidenced ones") regardless of tier boundaries. |
| 5 | P1 tag taxonomy (Character/Session/Skill, tyre-compound colors) vs P3 ("chips already on the setup", coral-only action palette, amber/green reserved for Pace/Predictability) | **P3 wins for now.** Keep existing 6 tags as chips. Tag-taxonomy + color migration moves to Phase 3 and needs your sign-off on colors first (P1's "reserve red/yellow" contradicts P3 tokens). |
| 6 | P1 browse grouping (car×track rows, density toggle, filter counts) vs P3 browse (cards + Best match + handoff empty state) | **P3 first.** Grouping + density toggle deferred to Phase 3; filter result counts too (nice-to-have, not in P3's done-when). |
| 7 | P1 "seed 10 requests with is_seed" vs P3 "no seeded fake data" / "don't invent data" | **Default: no seeding.** If you want the requests board primed, I will add `is_seed boolean not null default false` + seed rows you can delete in one `delete from setup_requests where is_seed` — but only on your explicit go-ahead. |
| 8 | P2 assumes "Phase 1 (trust layer, honest coverage, grouped browse, Character tags) is already shipped" | Repo says otherwise (see §3). Plan order: P3-UX + P1-trust now → P4 → P2. Grouped browse/Character tags are Phase 3 items in this plan. |
| 9 | P4 "compare only parsed values" needs parsers for ACC **and LMU**; only ACC exists | **Need your sample files before Phase 2 compare work** (P2 explicitly says: don't guess formats). ACC path can proceed. |
| 10 | P4 rater's rig vs P2 two-axis rig migration | Store rater's rig on ratings with the **current 4 categories** first (additive, no migration coupling); the two-axis migration later rewrites `rig_profile` values additively with a documented mapping. |

Non-negotiables from all four briefs treated as hard constraints: no
paywalls/gating of what exists; browsing account-free; additive migrations
only (any drop/rewrite is announced first); RLS on every table touched;
never expose Garage data; no invented data; Engineer is a static knowledge
base and is never called AI; keep the SETUP/SHEET wordmark + double-chevron;
WCAG AA; mobile-first; numbers in tabular mono (0–5, one decimal, plus
count, everywhere).

## 5. Phased plan

### Phase 1 — "Trust + finder" (P3's four items + P1's rating trust layer)
Five small commits, in P1's prescribed order (tokens → ratings+migrations →
homepage → browse → detail/polish):

**1a. Tokens + score format groundwork**
- Audit `globals.css` against P3's palette (coral action-only, amber Pace,
  green Predictability, cyan rig/hardware). Adjust token values/aliases
  where they diverge; no new palette.
- `src/lib/ratings.ts` (new): `bayesianAverage(sum, n, {m, C=5})` in one
  documented place; `formatScore` (0–5, one decimal) and tier helper
  (`Unrated` | `Early` | established) per P3 thresholds; `formatRatingCount`
  ("1 rating"/"3 ratings").
- `src/components/rating-bar.tsx`: split into `PaceBar` (amber) and
  `PredictabilityBar` (green); show `Unrated` (muted, no empty bar) at 0
  ratings; otherwise score + bar + count. Tooltips defining Pace and
  Predictability (P1a).
- Files: `globals.css`, `src/lib/ratings.ts` (+tests), `rating-bar.tsx`,
  `star-rating.tsx`, `src/lib/color-contrast.test.ts` (extend).

**1b. Rating trust — migration + logic** (`supabase/migrations/0036_rating_trust.sql`)
- **Block self-rating in the database** (acceptance is DB-enforced):
  trigger or RLS `with check` on `setup_ratings` so a user can never
  insert/update a rating on their own setup; also update
  `create_setup_with_rating()` to stop inserting the uploader's rating (a new
  setup is `Unrated` — matches "Unrated until someone has run it"). Keep the
  function signature compatible or version it; announce before any drop.
- **Exclude self-ratings from aggregates without deleting rows**:
  `recompute_setup_rating()` re-derives pace/predictability/rating_count from
  `setup_ratings r where r.user_id <> setups.user_id`; then a one-shot
  recompute backfill (reversible: values re-derive if the filter is removed).
- Optionally store the Bayesian rank key(s) here or compute in app code from
  (sum, n, global mean). Proposal: app-side from the same fetch (no extra
  columns), `C=5` in a tiny `app_settings` row so it is configurable.
- Self-rating already in the DB stays (P1: "without deleting them") but no
  longer counts toward displayed scores; no historical data lost.
- Tests: new `supabase/testing/zz_rating_trust.test.sql` (author cannot
  rate own setup; aggregates exclude self-rating; counts correct), update
  `z_create_setup.test.sql`, vitest for `ratings.ts`.
- UI: hide the Rate control on your own setups (DB is the enforcement).
- Files: migration, `src/lib/actions/setups.ts` (`rateSetup`), `createSetup`
  path, `supabase/testing/*`, `src/components/setup-card*.tsx` (rate UI).

**1c. Homepage combo finder** (`src/app/page.tsx` + new `src/components/combo-finder.tsx`)
- Eyebrow `100% free · No account to browse`; H1 `The setup that fits your
  rig.`; supporting line exactly as briefed.
- Four controls Game → Car → Track → Rig. Games = the 8 in `lib/data.ts`;
  rigs = the 4 current `rigProfiles`. Car options derive from real published
  setups for the selected game; track options from game+car when data
  allows, otherwise client-side from published setups plus a free-typed
  known track so empty combos remain requestable (no dead end).
- Persist last rig in `localStorage` and preselect it.
- Primary `Find a setup → /setups?game&car&track&rig`; secondary `The car is
  misbehaving → /engineer`.
- Three one-line points exactly as briefed (no feature cards):
  Pace/Predictability unrated until run · filtered for your rig · free.
- `Starting points`: ≤3 real setups matching saved rig, else 3 most recently
  updated (`updatedAt`); section omitted entirely if <1 exists. No
  placeholders.
- Bottom CTA: `Can't find the combo? Ask the community.` →
  `Request a setup → /requests`, `Upload a setup → /upload`; Discord copy is
  exactly `Sign in with Discord. No new password.`
- Delete: setup count line, "8 sim titles supported", "Most upvoted",
  highlights grid.
- `src/lib/supabase/setups.ts`: `getStartingPoints(rig?)`; tests for the
  finder (rig persistence, dependent options, empty combos).

**1d. Browse page** (`src/components/setups-browser.tsx`,
`src/lib/filter-setups.ts`, `src/lib/browse-filters.ts`,
`src/app/setups/page.tsx`)
- Keep `Browse Setups` H1 + new subcopy; prefill filters from query string.
- Default sort `Best match`: rig match to selected/saved rig → higher
  `ratingCount` → higher Predictability (evidence-first ordering, which is
  also P1's "a 1.0/1 never outranks well-rated 3.8s" acceptance). Keep
  `Newest` explicit. (Bayesian applies wherever score-ordering happens.)
- Hidden-rig quiet line with real hidden rig names + `show them` control.
- Empty state per P3 copy: `No setup for this combo yet.` / `Nobody has
  shared a [rig] setup for [car] at [track] in the [condition].` /
  `Ask for this combo → /requests?game&car&track&condition&rig` /
  `Get a first change to test → /engineer`. Never a blank list.
- `src/components/setup-request-form.tsx`: read search params and prefill
  game/car/track/notes (+ rig/condition in notes or new fields — see Phase 2,
  item 4).

**1e. Slim cards + nav + detail light touch + footer**
- `setup-card.tsx` refactor: card shows only P3's list (game+condition, car
  title → detail link, track subtitle, lap time in mono with `self-reported`
  label when author-reported, existing chips, rig name + thin line icon,
  two meters, one `Download` button). Remove from cards: install guide,
  version history, comments accordions, Rate control, upvote, favorite,
  "Be the first", any zero download count. Those live on the detail page
  (a `setup-card-full`/detail panel keeps them so nothing is lost).
- Nav (`nav-links.ts`, `site-header.tsx`): primary = Browse, Engineer,
  Requests (each with the one-line descriptor where the layout allows);
  header keeps wordmark, search (`/` shortcut — already exists), Upload
  Setup. Garage moves to account menu/upload area; routes keep working.
  Leaderboard footer-only and hidden until ≥10 contributors with ≥1 setup
  each (P1d; route stays reachable if you disagree — open question).
- Detail (`src/app/setups/[id]/page.tsx`, `public-field-test-reports.tsx`):
  `Who this is for` line (rig, condition, tags, `Unrated` or `Early ·
  1 rating` under 5 ratings; drop Early at 5+); one sentence: `Pace is how
  much lap time drivers think it finds. Predictability is whether it does
  the same thing next lap.`; on field-test load failure hide the module
  silently (no error). Download install bundle is primary CTA, Open in
  Garage secondary (P1d, small).
- Footer tagline → `Free setups, matched to your rig.`
- Numbers (lap times, scores, values) get `tabular-nums` + mono; fix label
  spacing on cards/detail.
- Playwright: update `e2e/landing.spec.ts`, `setups-browse.spec.ts`,
  `setup-detail.spec.ts`, `header-search.spec.ts`; manual pass at desktop +
  390px on home / populated browse / empty browse / detail (P3's done-when).
- Accessibility target: Lighthouse ≥ 95 on home, browse, detail.

**Phase 1 done-when** = P3's five bullets + P1 acceptance: DB-blocked
self-rating; 1-rating setups never look established; no misstated coverage;
no public error states; tabular numbers.

### Phase 2 — P4's four items ("stop when these four work on real data")

1. **Detail author note + related setups.** Migration 0037: `author_note
   jsonb` (or 3 text columns: `likes`, `hates`, `changes_from_baseline`) on
   `setups` (+ `setup_versions` snapshot columns + RPC param additions —
   additive only). Upload form: the three prompts, required. Existing rows
   render a `File only` label. `related-setups.tsx`: same car **and** track,
   different rig or style — never random same-game cars.
2. **Compare, parsed values only.** For two ACC or LMU setups show only the
   differing parsed parameters (wing, ride height, ARB, diff, brake bias,
   ABS, TC, pressures) with units/deltas; unparseable file → explicit
   "couldn't parse" message; no duplicated full cards. **Blocked on your
   sample files** (see §6). Reuses `diff-setup-values.ts` +
   `setups/compare` shell; adds LMU `.svm` parser + ACC parsed-value
   extraction into the normalized structure, unit-tested against samples.
3. **Ratings with rater's rig.** Migration 0038: `setup_ratings.rig_profile`
   (current 4 categories; see conflict #10). Detail splits `On a similar
   rig` vs `Everyone else`; `Best match` ranks similar-rig ratings first.
   Bayesian + no-self-rating rules still apply.
4. **Requests close the loop.** Empty-browse request prefill (form gains
   rig/condition fields, prefilled from query params). Uploading against an
   open request marks it fulfilled via the existing
   `fulfill_setup_request()` RPC and credits the uploader
   (`fulfilled_by`); upload UI surfaces "This fulfills an open request".
   Fulfills-in-app-only notifications (no email — per constraints).

### Phase 3 — P2 remainder + P1 leftovers (planned, not scheduled)

**Decisions (2026-10-19, Phase 3 kickoff):** LMU `.svm` parser and
normalized sheet rendering are **deferred** until the user provides 2–3
sample `.svm`/`.json` files (never guess formats); patch compatibility
starts with **uploader-entered `game_version`** (stale badge on detail when
the operator-maintained `games_versions` row differs); the **Engineer loop
is approved to build** (still a static knowledge base, never called AI).
Rig axes: input ∈ {gamepad, wheel, direct_drive} × brake ∈ {standard,
load_cell, handbrake}, mapped injectively from the 4 legacy categories.
Phase 3 order: patch compatibility → two-axis rig migration → contribution
flow (parser-independent parts) → Engineer loop. P1 leftovers below stay
unscheduled unless asked.

- Normalized sheet rendering: sections/params/units/min-max, range bars
  with community-median markers once n allows; full diff with `changed only`
  toggle. No fabricated ranges — omit the bar when min/max unknown.
- Patch compatibility: `game_version` on setups (+ per version row),
  `games_versions` table, staleness badges, Report stale / Confirm still
  works (one per user per version), in-app author notification.
- Rig as two axes (input device × brake type), additive migration with
  documented mapping of the 4 old categories; saved rig profile (RLS:
  owner only); `Best for my rig` sort; `Matches your rig` chip; per-rig-type
  rating sub-scores at n ≥ 3.
- Contribution flow: full upload auto-detect (sim/car/track), lap context
  (tyre/compound, ambient temp, game version, proof badge), 24h post-download
  3-tap rating prompt, Garage-verified rating weight in one documented
  function, leaderboard ranked by laps driven by others / field-tested
  setups.
- P1 leftovers: car×track grouped browse + density toggle; filter result
  counts; Character/Session/Skill tag migration (needs your call on colors —
  conflict #5).
- Engineer loop stretch: symptom → highly-rated setups mapping — **I will
  ask before building** (P2 says define the mapping together).

## 6. What I need from you

1. **Sample setup files before Phase 2 item 2**: ACC `.json` and LMU `.svm`
   exports for 2–3 cars each (P2: "do not guess file formats").
2. **Game version source** for the staleness badge (Steam build? user-entered?
   If unknown I'll propose a validated user-entered field).
3. Answers to the open questions below.

## 7. Open questions

1. Tier thresholds: go with P3 (Unrated 0 / Early 1–4 / established 5+) as
   default — OK?
2. Tag colors: defer Character/Session/Skill + tyre-compound palette to
   Phase 3 (P3's coral-only action rule conflicts with P1's red/yellow
   reservation) — OK?
3. Request seeding: default is **no seeded rows**. Want `is_seed` seeding
   anyway (P1) despite P3's "no seeded fake data"?
4. Browse grouping + density toggle deferred to Phase 3 — OK?
5. Nav = Browse, Engineer, Requests (P3), with Garage in the account menu
   and Leaderboard footer-only (hidden below 10 real contributors) — OK?
6. Bayesian C ≈ 5, configurable in `app_settings`; `Best match` keeps P3's
   rig → count → predictability order while score-ordering uses the Bayesian
   value — OK?
7. Rater's rig stored with current 4 categories until the Phase 3 two-axis
   migration — OK?
8. Phase 1 acceptance includes a Lighthouse a11y ≥ 95 check on home/browse/
   detail — confirm that's the bar for this pass.
