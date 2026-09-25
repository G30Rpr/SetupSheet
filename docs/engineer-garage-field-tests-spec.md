# Engineer, Garage, and Field Tests — Source of Truth

**Status: Gate 1 complete; Gate 2 basic workflow implemented and under validation.** ACC and Le Mans Ultimate are the initial Engineer games. This is the implementation contract distilled from the handoff; future-gate details can be finalized before their implementation. Items marked **Proposal** still need explicit sign-off.

## Product sequence and invariants

Build this as independently verifiable vertical slices; do not merge the handoff's full migration/file set at once. The Engineer must remain useful without a database. Garage data is private. Public field-test data is a deliberately sanitized projection, never the raw private records. Later evidence may improve recommendations, but must never replace or block the static knowledge base.

## Gate 1 — Static Engineer (`/engineer`)

The route works anonymously and has no Supabase dependency. Its input is:

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

**Approved game scope:** Assetto Corsa Competizione (ACC) and Le Mans Ultimate (LMU), matching the existing setup schemas in this repository. Other catalog games remain experimental/unsupported for Engineer-specific advice. Suppress pressure advice for GT7 unless a reviewed, game-specific translation exists. The handoff does not include the actual symptom/rule corpus, so Gate 1 will use a conservative, clearly documented first-pass knowledge base for ACC and LMU, aligned to their in-repo parameter schemas and requiring domain review before any broader game rollout.

## Gate 2 — Garage workflow

Start with an authenticated Garage workflow: create a session and baseline snapshot atomically, add immutable revision snapshots, record one-change run-plan items with a `better | worse | inconclusive` result, and log laps linked to a revision and condition. The current implementation follows the four-table normalized proposal—`garage_sessions`, `garage_revisions`, `garage_run_plan_items`, and `garage_laps`—so run-plan items and laps stay queryable rows rather than embedded JSON. This is the chosen implementation shape for the slice, but the four-versus-three-table question has not been separately confirmed as a final schema decision.

Every write through the Garage Server Actions is authenticated and validated server-side and is also protected by Supabase RLS. A narrow no-login writer role keeps session-plus-baseline creation atomic without granting authenticated clients direct session inserts. Child-row policies verify ownership through the parent session; composite revision foreign keys prevent attaching a lap or plan item to a revision from a different session. Anonymous access is denied. Session deletion safely cascades to its private child records. SQL tests cover the atomic baseline RPC, cross-user session/revision reads, inserting a lap into another user's session, anonymous access, direct session-insert denial, and deletion cascades. The initial app workflow supports ACC and LMU only.

After the basic Garage workflow has been exercised, add `/garage?from=<setup-id>`. The server validates and reads the public setup through the existing setup reader, and supplies its metadata to the new-session form. Setup values are copied only after explicit user opt-in. The browser is never authoritative for source-setup metadata.

## Gate 3 — Field tests

A field test is created from a Garage session, not arbitrary client-entered metrics. The client submits only `{ garageSessionId, setupId, note }`. The server verifies session ownership and the session/setup relationship, then derives lap count, best lap, consistency, validated changes, and report attribution from owned Garage records. A valid report requires at least one lap and at least one run-plan item marked **better**. No client-supplied summary metrics are accepted.

Enforce one report per reporting user/setup/day with a database-level unique invariant or an equivalent atomic transaction/lock—not a check-then-insert. Include a concurrency test.

Expose only an approved public projection: `setup_id`, `game`, `condition`, `validated_changes`, `laps_run`, `consistency_pct`, `best_lap_ms`, `created_at`, and either an intentionally public display name or anonymous attribution. Never expose Garage session IDs, private notes, sensitive rig details, or internal user IDs by default. Add a setup-page summary, setup-card badge, and field-test report list; notify the setup owner.

Start with an aggregate/read helper for counts. Add a denormalized `field_test_count` only if measured query cost warrants it; if added, test insert/delete triggers, duplicate handling, and rollback behavior.

## Gates 4–5 — Later public surfaces and calibration

Only after the core field-test loop works, add “Proven” sorting, a landing-page proven rail, request-board field-test chips, “Open in garage” links, profile statistics, and leaderboard fields. Calibration follows these public surfaces and remains optional over the static base. Test Beta smoothing, the 0.6–1.4 bound, low sample counts, pooled versus game-specific evidence, immutability, wet behavior, and exclusion of private run-plan data.

## Release gates and change manifest

1. **Static Engineer:** anonymous; no database; unit tests pass; deterministic fallback. Complete.
2. **Garage core:** authenticated session/baseline, revisions, run-plan results, and laps; Server Action validation; RLS and SQL regression tests. In progress. Start-from-public-setup is a later addition after the basic loop works.
3. **Field tests:** server-derived metrics, concurrency-safe cooldown, sanitized projection, and notification tests.
4. **Public surfaces:** summaries/badges/links and correct cache invalidation.
5. **Calibration:** public-only evidence, safe fallback, wet/calibration tests, no private-data leakage.

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

## Decisions needed before implementation

1. ACC and LMU are approved for the initial Engineer slice; the static knowledge-base content is a conservative first-pass draft tied to the existing setup schemas and should be reviewed before expanding beyond those games.
2. The basic Garage slice follows the four-table proposal. Confirm whether to keep that model before later schema expansion; if preferring three tables, document the alternative and migration rationale.
3. Confirm public attribution policy (proposal: anonymous by default; display name only by explicit opt-in).
4. Before field-test implementation, approve the report-day timezone, consistency formula (including behavior with only one lap), and exact session/setup relationship.
5. Before calibration implementation, approve Beta prior/update formula, minimum sample threshold, and staleness window. These do not block Gate 1.

## Repository baseline

The existing SetupSheet checkout is the implementation target. It already defines eight catalog games and `Dry | Wet | Mixed` conditions; the Engineer should have an explicit reviewed support allowlist rather than implying all catalog games are supported. Map its `dry | wet` input explicitly to existing product types and do not treat `Mixed` as a reviewed Engineer condition by accident.
