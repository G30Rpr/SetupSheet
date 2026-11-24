# SetupSheet — Infrastructure security release status

Last reviewed: November 23, 2026. **This is a historical rollout record and current release checklist, not authorization to apply production SQL.**

## Repository state versus live database

- Historical PRs [#22](https://github.com/G30Rpr/SetupSheet/pull/22), [#23](https://github.com/G30Rpr/SetupSheet/pull/23), [#24](https://github.com/G30Rpr/SetupSheet/pull/24), [#25](https://github.com/G30Rpr/SetupSheet/pull/25), [#31](https://github.com/G30Rpr/SetupSheet/pull/31) and [#32](https://github.com/G30Rpr/SetupSheet/pull/32) are **closed and marked merged**, some into earlier stacked branches. A merged PR is not evidence that every change exists on the current `SetUpSheet` tip, has been applied in hosted PostgreSQL, or is serving production.
- The current default branch contains migrations 0044–0047. The 0048 RLS optimization file from #32 was present in its historical merge commit but **is absent from the current `SetUpSheet` branch**. Reconcile branch history; do not assume it has deployed or replay the migration.
- Read-only hosted checks on November 18 found no migration-history versions 0044–0048. Anonymous `EXECUTE` remained enabled for `public.sync_profile_from_auth(uuid,text,jsonb)`, and `authenticated` could still update `public.profiles.follower_count`. These live vulnerabilities remain open in [#40](https://github.com/G30Rpr/SetupSheet/issues/40).
- Draft [#48](https://github.com/G30Rpr/SetupSheet/pull/48) adds a forward profile privileges fix, [#51](https://github.com/G30Rpr/SetupSheet/pull/51) repairs request fulfillment, and [#52](https://github.com/G30Rpr/SetupSheet/pull/52) restores missing validation constraints. Merge status and passing fixture tests alone do not apply them to hosted data.

## Production release protection

[The current migration workflow](../.github/workflows/deploy-migrations.yml) **does not apply migrations on push**. Pushes validate and generate a read-only pending list. A write requires a manual `workflow_dispatch`, `dry_run=false`, an exact approved default-branch SHA, and the `production-database` GitHub Environment. The existence of the Environment name in YAML **does not guarantee required reviewers or deployment restrictions are configured**.

Before releasing:

1. Verify default-branch protection and required CI, plus the GitHub Environment's reviewer/branch rules and separate inventory/release database credentials. Never put credentials in GitHub discussions or logs.
2. Review actual hosted grants, constraints, function definitions, and migration history. Reconcile the entire pending sequence (including 0042–0047 and new timestamped repairs), and rehearse against disposable test data. Validate login, public browsing/reports, uploads/downloads, request fulfillment, Garage privacy and anonymous/cross-user denial.
3. Record exact release SHA, pending migration inventory, app/schema compatibility, production deployment SHA, forward-fix plan and explicit acceptance of unverified recovery risk. Run the manual **dry run** first.
4. Only after approvals, dispatch the protected apply for that exact SHA. Keep other changes paused. Verify live permission denials and data integrity, then promote a matching validated Vercel deployment. A Vercel rollback does **not** undo PostgreSQL migrations.

Follow [migration-release-controls.md](migration-release-controls.md) for the authoritative workflow and refusal conditions.

The [combined staging candidate](staging-release-candidate.md) pins all seven
current database drafts, source checksums and the hosted acceptance matrix.
It remains draft and does not establish isolated staging or release approval.

## Owner decision — backup verification omitted

On November 18, the owner chose to **skip** the encrypted backup and isolated restore exercise; [issue #44](https://github.com/G30Rpr/SetupSheet/issues/44) was closed **not planned**, not completed. This removes it from the active work list; it does **not** establish a recoverable database. Production data loss from a failed release could be irreversible. An approved release still requires its own explicit acknowledgment of that risk. No automatic SQL release is approved by this decision.

## Outstanding engineering and testing

- Run live security and performance advisors after a controlled staged release; preserve RLS isolation semantics and do not drop unused indexes solely because of advisory counts.
- Review Storage MIME support against actual client formats before tightening buckets; preserve existing download and uploader compatibility.
- Validate Vercel preview versus production Supabase isolation and secrets.
- #58 was closed after its advisory was withdrawn on November 18. The npm audit gate remains enabled; #56/#57/#59 are merged. Review new advisories and maintenance updates independently.
- After every approved deployment, monitor Supabase/Vercel permission-denied errors and verify the production site’s key authenticated and anonymous flows.

**Status:** These release instructions document required reviews and current known risks; no production migration, deployment, or recovery operation is authorized by this file.
