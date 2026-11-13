# SetupSheet — Infrastructure security remediation rollout

Last reviewed: November 13, 2026. **This is a plan, not an approval to deploy.**

## Required deployment order

1. [PR #22](https://github.com/G30Rpr/SetupSheet/pull/22) — P0, remove untrusted SQL execution for legacy profile sync.
2. [PR #23](https://github.com/G30Rpr/SetupSheet/pull/23) — replace three privileged reporting views with RLS-protected public projections.
3. [PR #24](https://github.com/G30Rpr/SetupSheet/pull/24) — privileged server-only download counter with private daily quota.
4. [PR #25](https://github.com/G30Rpr/SetupSheet/pull/25) — revoke direct EXECUTE for internal routines and excessive table privileges.

These are **stacked draft PRs**, each based on the preceding branch. After the predecessor merges into `SetUpSheet`, retarget the next PR to the updated production branch and recheck the exact diff/SHA. Do not merge them out of sequence. SQL migrations are additive and must never be cherry-picked into production without preserving sequential filenames.

## Hard release blocker — verified backup required

The connected Supabase organization is on the **Free tier** and therefore does not have the automated daily backups and PITR available on paid plans. See [SS-AUD-005 issue #26](https://github.com/G30Rpr/SetupSheet/issues/26) and [Supabase backup docs](https://supabase.com/docs/guides/platform/backups).

Before any of these PRs merge:

- Perform an encrypted, operator-controlled database dump. Do **not** store credentials, auth records or dump bytes in GitHub/ChatGPT or public cloud storage.
- Preserve the existing Storage API object bytes separately; database dumps only capture Storage metadata.
- Successfully restore a snapshot in an isolated environment. Verify auth records, setup counts and migration compatibility.
- Confirm an accepted recovery point objective (RPO), recovery time objective (RTO) and secure backup retention.
- Confirm the current production deployment and rollback candidate. A Vercel rollback **does not** undo database migrations.

No Supabase paid upgrade, new project, or production SQL has been initiated by this work.

## Staging validation matrix

- Anonymous: public browse, rating summary, leaderboard, public reports with opt-out names hidden, free download and manual export, Help/Rig Mode.
- Authenticated: Discord signup, owner profile editing, contributor upload/edit, request fulfillment, ratings, notifications, Garage session/lap/field-report flows.
- Negative access: anon and another user cannot call legacy sync or other internal SECURITY DEFINER RPCs; untrusted roles cannot truncate tables; private Garage rows remain inaccessible.
- Data integrity: insertion/updates/deletion of reports and Garage laps update the new public projection; download count increments only through the bounded trusted server route.
- Compatibility: public view names, column types and API response shapes unchanged. No sensitive credentials included in client output.
- Verify Supabase Security and Performance Advisors again after staging migration.

## Production release and checks

1. Confirm exact PR head SHA has green SQL migration, lint/typecheck/unit/build and end-to-end workflows.
2. Confirm **verified backup and isolated restore** (issue #26).
3. Review each SQL migration and its interaction with the versioned deploy-migrations GitHub workflow.
4. Merge in order during a low-traffic window. Database migration workflow runs on `SetUpSheet`; monitor it to completion before merging the next PR.
5. Read-only inspect pg_proc, pg_policies and view reloptions, then smoke-test public pages and authenticated workflows.
6. Monitor Vercel and Supabase errors, especially permission-denied 42501 events, for at least one day.
7. For a critical failure, halt further merges and use a reviewed forward-fix migration. Restore from the verified snapshot only with explicit production-restore approval; don't blindly restore database data after new user writes.

## Other audit findings (not covered by these security PRs)

- SS-AUD-006: 17 RLS init-plan warnings and 28 index-use notices; benchmark real workloads before mass edits/index removal.
- SS-AUD-007: Storage MIME allowlist unset, but upload extensions/sizes already validated in app. Test sample supported game formats before restricting MIME at bucket level.
- SS-AUD-008: review Postgres 17.6.1 to current patched 17.x upgrade and password protection relevance; the saved-rig search path is addressed in PR #25.
- SS-AUD-009: verify Preview environment points to an isolated Supabase project; currently Vercel's public Supabase variables target both preview and production. Consider read-only availability checks and log alerting.

**No automatic production deployment is authorized by this runbook.**
