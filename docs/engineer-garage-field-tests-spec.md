# Engineer, Garage, and Field Tests — Source of Truth

**Status: Gates 1–5 core are implemented; configured-Supabase/RLS validation remains pending. Gate 3 and Gate 5 decisions were approved on 2026-09-26.** ACC and Le Mans Ultimate are the initial Engineer games. This is the implementation contract distilled from the handoff; later optional surfaces remain deferred.

## Product sequence and invariants

Build this as independently verifiable vertical slices; do not merge the handoff's full migration/file set at once. The Engineer must remain useful without a database. Garage data is private. Public field-test data is a deliberately sanitized projection, never the raw private records. Later evidence may improve recommendations, but must never replace or block the static knowledge base.

## Gate 1 — Static Engineer (`/engineer`)

The static baseline works anonymously and does not require Supabase; optional calibration is a separate public read that may fail without affecting static recommendations. Its input is:

```ts
type EngineerInput = {
  symptomId: string;
  severity: "slight" | "moderate" | "severe";
  condition?: "dry" | "wet";
  game?: string;
};
```

Each recommendation has this shape:

```ts
type EngineerRecommendation = {
  parameter: string;
  direction: "increase" | "decrease" | "soften" | "stiffen";
  amount: number | string;
  unit?: string;
  score: number;
  explanation: string;
  warnings?: string[];
};
```

Known symptoms return at least one recommendation for both reviewed games; severity affects the suggested amount. The first-pass symptom set is front locking, mid-corner understeer/oversteer, exit oversteer/wheelspin, high-speed instability, and hot tyre pressure above/below its game-specific target. Conflicting recommendations are identified. Unknown symptom IDs fail safely. The baseline is deterministic and static. Wet behavior is a separate, immutable ruleset—not a generic multiplier: it halves pressure steps, adds one rear-wing step for high-speed instability, reverses the differential-preload direction for exit wheelspin, withholds brake-bias advice for wet front locking, and adds wet-specific warnings. GT7 pressure advice is suppressed unless a reviewed, game-specific translation exists.

Gate 1 tests cover: every symptom returning recommendations in ACC and LMU; severity changing amount; opposing recommendations being detected; wet modifiers not mutating static data; the wet-specific behaviors above; GT7 pressure suppression; safe unknown-symptom handling; and a working static path with no database or network call.

Recommendation order of operations, once calibration is introduced:

1. Static recommendation.
2. Applicable wet behavior.
3. Eligible public calibration.
4. Ranked UI output.

Calibration is ignored for insufficient or stale evidence, unknown game/condition, non-exact parameter matches, contradictory evidence, or query failure. Fallback always returns valid static recommendations. Calibration uses public evidence only, has Beta smoothing and a final factor bounded to **0.6–1.4**, and never mutates the base recommendation or consumes private run-plan data.

**Approved Gate 5 calibration defaults (2026-09-26):** Use a Beta(2,2) prior. Each distinct public setup with an exact matching game, Dry/Wet condition, parameter, and direction in its validated better changes adds one positive observation; omissions are never treated as failures. For `s` supporting setups, `p = (2 + s) / (4 + s)` and the ranking multiplier is `clamp(0.6 + 0.8 × p, 0.6, 1.4)`. The prior maps to `1.0`; calibration changes ordering only, never the static score, amount, explanation, or wet behavior. Require **5 distinct setup IDs** and ignore evidence older than **90 days**. If the public aggregate reports more than one direction for the exact game/condition/parameter, skip calibration for that parameter. Because Gate 3 publishes only validated better changes, this positive-only model can up-rank but cannot infer a down-rank from missing evidence. The SQL view enforces the 90-day window and returns aggregates without setup, report, session, or user IDs.

**Approved game scope:** Assetto Corsa Competizione (ACC) and Le Mans Ultimate (LMU), matching the existing setup schemas in this repository. Other catalog games remain experimental/unsupported for Engineer-specific advice. Suppress pressure advice for GT7 unless a reviewed, game-specific translation exists. The handoff does not include the actual symptom/rule corpus, so Gate 1 will use a conservative, clearly documented first-pass knowledge base for ACC and LMU, aligned to their in-repo parameter schemas and requiring domain review before any broader game rollout.

## Gate 2 — Garage workflow

Start with an authenticated Garage workflow: create a session and baseline snapshot atomically, add immutable revision snapshots, record one-change run-plan items with a `better | worse | inconclusive` result, and log laps linked to a revision and condition. The four-table normalized Garage model—`garage_sessions`, `garage_revisions`, `garage_run_plan_items`, and `garage_laps`—is approved for subsequent field-test work. Run-plan items and laps stay queryable rows rather than embedded JSON.

Every write through the Garage Server Actions is authenticated and validated server-side and is also protected by Supabase RLS. A narrow no-login writer role keeps session-plus-baseline creation atomic without granting authenticated clients direct session inserts. Child-row policies verify ownership through the parent session; composite revision foreign keys prevent attaching a lap or plan item to a revision from a different session. Anonymous access is denied. Session deletion safely cascades to its private child records. SQL tests cover the atomic baseline RPC, cross-user session/revision reads, inserting a lap into another user's session, anonymous access, direct session-insert denial, and deletion cascades. The initial app workflow supports ACC and LMU only.

`/garage?from=<setup-id>` now starts a Garage session from a public setup. The page rejects malformed IDs before lookup and reads a valid ID through the normal `getSetupById` reader. It sends only server-derived game/car/track/condition metadata and the count of compatible saved values to the form; the setup values themselves stay server-side. The copy checkbox starts unchecked, and only an explicit opt-in makes the authenticated Server Action re-read and schema-filter those values into the private baseline. The browser never supplies source metadata. A dedicated database RPC independently derives session metadata from the public setup row under RLS, stores `source_setup_id`, and atomically creates the baseline. The user's own rig profile remains an explicit form choice; the source uploader's rig is not copied. The public setup detail page does not yet add an “Open in Garage” CTA, which remains deferred with the later public surfaces.

## Gate 3 — Field tests

A field test is created from an owned Garage session, not arbitrary client-entered metrics. The create client submits exactly `{ garageSessionId, setupId, note }`; `note` is private, and no client summary metrics or source metadata are accepted. The server requires the session's `source_setup_id` to equal `setupId`, then derives every public metric from the owned session's laps and run-plan items. A valid report requires at least one lap and at least one run-plan item marked **better**. `validated_changes` includes only the better items' parameter, direction, and amount—never their private notes or revision IDs.

Approved reporting rules:

- One report per user/setup/UTC calendar day, enforced by a database unique invariant on `(user_id, setup_id, report_day_utc)`; a two-connection concurrent-create regression is included.
- `laps_run` counts all laps in the session; `best_lap_ms` is their minimum. Condition is derived from logged laps (implementation choice): one shared condition stays as-is, otherwise the report condition is `Mixed`.
- With at least two laps, consistency is `clamp(100 × (1 − sample standard deviation / mean lap time), 0, 100)`, rounded to one decimal. With one lap, consistency is `null` because variability cannot be estimated.
- Attribution is anonymous by default. A separate, owner-only action can opt a report into a sanitized display-name snapshot or revoke that choice; it does not add a fourth field to the report-create payload.

The public read model exposes only an explicit projection: report ID, `setup_id`, `game`, `condition`, `validated_changes`, `laps_run`, `consistency_pct`, `best_lap_ms`, `created_at`, and optional opted-in display name. It never exposes Garage session IDs, private notes, sensitive rig details, or internal user IDs. Notify the setup owner (except for self-reports). Gate 4 adds the setup-page summary, setup-card badge, and public report list.

Start with an aggregate/read helper for counts. Do not add a denormalized `field_test_count` unless measured query cost warrants it; if added later, test insert/delete triggers, duplicates, and rollback behavior.

## Gates 4–5 — Public surfaces and calibration

Only after the core field-test loop works, add the deferred “Proven” sorting, landing-page proven rail, request-board field-test chips, “Open in garage” links, profile statistics, and leaderboard fields. Gate 5 calibration is now implemented as an optional layer over the static base. It queries only the privacy-safe aggregate view, separates game and Dry/Wet evidence, refuses contradictory directions, requires the approved threshold/window, and fails back to static on missing or failed reads. Tests cover Beta smoothing, bounds, low samples, exact matching, game/condition isolation, conflicts, immutability, wet behavior, query failure, and exclusion of private Garage data. Since only positive “better” changes are public, no absent parameter or untested item is counted as a failure.

## Release gates and change manifest

1. **Static Engineer:** anonymous; no database; unit tests pass; deterministic fallback. Complete.
2. **Garage core:** authenticated session/baseline, revisions, run-plan results, laps, and the server-derived start-from-public-setup flow; Server Action validation; RLS and SQL regression tests. The app and unit tests are implemented; authenticated flows still need a configured Supabase run, and SQL RLS tests remain unexecuted because `psql` is unavailable in this environment.
3. **Field tests:** server-derived metrics, UTC-day uniqueness, anonymous-first snapshot attribution, sanitized projection, owner notification, count and notification tests. Implementation and tests are written; database tests still need execution.
4. **Public surfaces:** setup-page summary, count badge, public report list, and path revalidation. Implemented.
5. **Calibration:** public-only evidence, safe fallback, wet/calibration tests, no private-data leakage. Implemented with the approved Beta(2,2), five-distinct-setup threshold, and 90-day window; the public aggregate/RLS migration still needs execution in a configured database environment.

Literal changed-file integration manifest for the current Engineer + Garage work:

- `docs/engineer-garage-field-tests-spec.md` — approved scope, gate criteria, and this manifest.
- `src/lib/engineer-types.ts` — Engineer input, recommendation, symptom, and result types.
- `src/lib/engineer.ts` — static ACC/LMU symptom rules and ranking.
- `src/lib/engineer-wet.ts` — independent wet-behavior modifier.
- `src/app/engineer/page.tsx` — anonymous Engineer route metadata and entry point.
- `src/components/engineer/engineer-client.tsx` — interactive Engineer UI.
- `src/lib/__tests__/engineer.test.ts` — static corpus, severity, conflict, safe fallback, and wet-rule tests.
- `src/components/engineer/engineer-client.test.tsx` — anonymous and wet UI tests.
- `src/lib/garage.ts` — Garage DTOs, validation parsers, and lap-time parser.
- `src/lib/actions/garage.ts` — authenticated Server Actions for all Garage writes.
- `src/lib/supabase/garage.ts` — private session and child-row readers.
- `src/lib/supabase/database.types.ts` — Garage table and RPC contracts.
- `src/app/garage/page.tsx` — authenticated Garage route and signed-out state.
- `src/components/garage/garage-dashboard.tsx` — session, revision, run-plan, lap, and delete UI.
- `src/lib/__tests__/garage.test.ts` — Garage input and lap-time validation tests.
- `src/components/garage/garage-dashboard.test.tsx` — Garage empty and private-session rendering tests.
- `src/components/setup-values-fields.tsx` — optional field-ID prefix for multiple setup editors on one page.
- `src/lib/nav-links.ts` — Engineer and Garage navigation links.
- `next.config.ts` — allows Arena’s per-session `e2b.app` preview origin for development chunks and HMR.
- `supabase/migrations/0030_garage_private_workflow.sql` — four private tables, constraints, grants, RLS, and atomic session/baseline RPC.
- `supabase/testing/garage_rls.test.sql` — ownership, anonymous access, atomic create, and cascade regression checks.

Literal changed-file integration manifest for the `/garage?from=<setup-id>` slice:

- `docs/engineer-garage-field-tests-spec.md` — records the start-from-setup contract and remaining validation gates.
- `src/app/garage/page.tsx` — validates the query ID, reads via `getSetupById`, and passes only server-derived metadata/counts.
- `src/app/garage/page.test.tsx` — verifies normal-reader use, metadata projection, malformed IDs, and signed-out behavior.
- `src/components/garage/garage-dashboard.tsx` — read-only source metadata, unchecked opt-in checkbox, and no source values sent before opt-in.
- `src/components/garage/garage-dashboard.test.tsx` — verifies the checkbox defaults off and submits the source ID/choice without client metadata.
- `src/lib/garage.ts` — source summary type and schema-compatible value filtering/counting.
- `src/lib/__tests__/garage.test.ts` — source value allowlist and count tests.
- `src/lib/actions/garage.ts` — re-reads the source, derives metadata, validates values, and selects the atomic source RPC.
- `src/lib/actions/garage.test.ts` — server-derived metadata, opt-in copy, invalid/unsupported source, and existing create path tests.
- `src/lib/supabase/database.types.ts` — source-RPC contract.
- `supabase/migrations/0031_garage_start_from_setup.sql` — restricted setup read grant and atomic source-derived session/baseline RPC.
- `supabase/testing/garage_rls.test.sql` — source metadata derivation, unsupported-game, and anonymous RPC checks (not yet run locally; `psql` is unavailable).

Literal changed-file integration manifest for Gate 3 (field-test create and reporting):

- `docs/engineer-garage-field-tests-spec.md` — approved reporting rules, implementation status, and gate manifest.
- `src/lib/field-tests.ts` — exact input parsers, supported-game guard, lap-condition derivation, and sample-CV consistency formula.
- `src/lib/actions/field-tests.ts` — authenticated report-create RPC and separate owner-only attribution action; path revalidation.
- `src/lib/actions/field-tests.test.ts` — exact create payload, server-side metrics boundary, duplicate-day error, and separate opt-in tests.
- `src/lib/supabase/field-tests.ts` — safe public projection parser, bounded report query, and count-view helper.
- `src/lib/supabase/field-tests.test.ts` — projection allowlist, anonymous rows, supported games, and aggregate-count query tests.
- `src/lib/supabase/database.types.ts` — report table, public views, attribution/create RPCs, and notification column contracts.
- `src/components/garage/field-test-report-form.tsx` — eligibility UI, anonymous create flow, and separate opt-in/revoke controls.
- `src/components/garage/field-test-report-form.test.tsx` — eligibility, strict report payload, and separate attribution-action tests.
- `src/components/garage/garage-dashboard.tsx` — links the eligible, source-linked session workspace to field-test submission.
- `src/components/garage/garage-dashboard.test.tsx` — Garage workspace coverage with the report form.
- `src/lib/supabase/notifications.ts` and `src/lib/supabase/notifications.test.ts` — private owner-notification mapping through the public attribution projection; anonymous authors are not profile-queried.
- `src/components/notification-bell.tsx` — field-test notification label and setup navigation.
- `supabase/migrations/0032_field_test_reports.sql` — private reports, ownership policies, server-derived RPCs, UTC uniqueness, snapshot attribution, public/count views, and setup-owner notification trigger.
- `supabase/testing/garage_rls.test.sql` — ownership, eligibility, metrics, privacy, attribution, count, notification, and duplicate-day regression checks.
- `scripts/test-field-test-concurrency.sh` and `scripts/test-db.sh` — two-connection insert race added to the database regression harness.

Literal changed-file integration manifest for Gate 4 (core public surfaces):

- `src/components/public-field-test-reports.tsx` and `src/components/public-field-test-reports.test.tsx` — sanitized public report list and empty/error states.
- `src/app/setups/[id]/page.tsx` — setup-page field-test summary, public report list, and count badge.
- `src/components/setup-card.tsx` and `src/components/setup-card-honesty.test.tsx` — optional positive public count badge.
- `src/app/setups/page.tsx` and `src/components/setups-browser.tsx` — batch counts on the browse index and cards loaded by older-page actions.
- `src/lib/actions/setup-browse.ts` and `src/lib/actions/setup-browse.test.ts` — count-only projection for client-requested older browse pages.
- `src/app/page.tsx` — batch count for featured setup cards.

Literal changed-file integration manifest for Gate 5 (public-only calibration):

- `docs/engineer-garage-field-tests-spec.md` — records the approved Beta prior/update, distinct-setup threshold, 90-day freshness window, positive-only evidence limitation, and Gate 5 manifest.
- `src/lib/engineer-calibration.ts` and `src/lib/__tests__/engineer-calibration.test.ts` — Beta smoothing, exact aggregate mapping, conflict rejection, rank-only application, and immutability tests.
- `src/lib/actions/engineer-calibration.ts` — anonymous read-only Server Action; no auth requirement and no effect on the static fallback.
- `src/lib/supabase/engineer-calibration.ts` and `src/lib/supabase/engineer-calibration.test.ts` — bounded query of the privacy-safe public aggregate, validation, and failure fallback tests.
- `src/lib/supabase/database.types.ts` — typed public aggregate view contract.
- `src/components/engineer/engineer-client.tsx` and `src/components/engineer/engineer-client.test.tsx` — load evidence after static render, apply it only to ranking, and expose evidence/ fallback status.
- `supabase/migrations/0033_engineer_public_calibration.sql` — 90-day aggregate over the public report projection, distinct setup counts, and no IDs or private fields.
- `supabase/testing/garage_rls.test.sql` — public aggregate checks for minimum supporting setup counts, contradictory directions, stale/Mixed exclusion, and identifier privacy (not yet executed locally because `psql` is unavailable).

## Remaining review and validation

1. The static knowledge base is a conservative first-pass draft tied to the existing ACC/LMU setup schemas; review before expanding beyond those games.
2. Run migrations 0030–0033 and all RLS/concurrency regressions against configured PostgreSQL or Supabase. Local execution remains blocked because `psql` is unavailable.

## Repository baseline

The existing SetupSheet checkout is the implementation target. It already defines eight catalog games and `Dry | Wet | Mixed` conditions; the Engineer should have an explicit reviewed support allowlist rather than implying all catalog games are supported. Map its `dry | wet` input explicitly to existing product types and do not treat `Mixed` as a reviewed Engineer condition by accident.
