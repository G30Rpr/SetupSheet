# Migration release controls

Pushes validate the full migration chain on a disposable database and list
pending hosted migrations. They never apply hosted SQL. A manual dispatch also
defaults to a read-only inventory. The inventory uses explicit read-only
transactions and does not create missing migration-history objects.

## Configure before the first release

1. Protect `SetUpSheet` with required CI and review. Configure the
   `production-database` GitHub Environment with required reviewers and a
   default-branch deployment restriction. Referencing an Environment in YAML
   does not establish those protection rules automatically.
2. Configure `SUPABASE_DB_URL` for inventory, preferably using a role that can
   only read `supabase_migrations.schema_migrations`. The inventory deliberately
   fails if its credential is absent or cannot read history.
3. Store `SUPABASE_RELEASE_DB_URL` only in the protected `production-database`
   Environment. This separate credential must have the reviewed migration
   privileges. Do not configure or use it until Environment protection,
   the reviewed release order, and the explicit production risk decision have
   been verified. No credentials belong in an issue, PR, or log.

## Accepted recovery-risk exception (November 18, 2026)

The project owner removed the encrypted backup and isolated restore exercise
from the active plan. [Issue #44](https://github.com/G30Rpr/SetupSheet/issues/44)
is closed as **not planned**, not verified or completed. This is **not proof of
recoverability**: a failed hosted migration or lost records could be
irreversible. Do not reinterpret the exception as a successful test or quietly
turn off GitHub approvals, SQL tests, or permission checks.

Before any manual production apply, an authorized reviewer must explicitly
acknowledge this unverified-recovery risk in the release record alongside the
exact commit SHA and pending migration list. If nobody accepts that risk, do
not dispatch an apply. No database release is authorized by this document.

## Release procedure

1. Inspect live constraints, policies, grants, migration history and function
   definitions using a read-only connection. Recorded versions alone do not
   establish hosted compatibility. Document current drift and the missing
   recovery verification in the release record.
2. Rehearse every pending migration against an isolated **disposable test
   database populated with reviewed non-sensitive fixtures**, including
   0042–0047 and the new timestamped repairs. Exercise old/new application
   compatibility, anonymous and cross-user permission denial, concurrent
   fulfillment and invalid writes. Fresh-schema CI alone does not reproduce
   hosted drift; where it cannot be simulated, list the remaining uncertainty
   as an explicit release risk.
3. Confirm protected `SetUpSheet` branch rules, required CI and the
   `production-database` Environment's required reviewers/branch restrictions
   are actually enabled in GitHub settings. Confirm inventory and release
   credentials exist only in their appropriate scopes. Review the exact
   deployment SHA, approved changes, release rollback/forward-fix strategy,
   current Vercel production SHA and the explicit risk acknowledgment.
4. Dispatch **Deploy Migrations** on the default branch with `dry_run=true`
   and the exact full commit SHA. Review the pending list.
5. For the approved release, dispatch again with that same full SHA and
   `dry_run=false`. The apply job uses the protected Environment and refuses
   another branch, a mismatched SHA, or a default branch that advanced while
   awaiting approval. Keep merges paused for the duration of the release.
6. Verify hosted catalogs and anonymous/cross-user denial cases, then promote
   the matching Vercel deployment. Check `/api/health`, public reporting,
   downloads, login, upload and private Garage flows. Stop on failed checks.

Each file and its history entry are committed atomically, but the whole batch
is not one transaction. On failure, earlier files can already be applied;
inspect the state and prepare a forward fix. Do not restore insecure grants or
assume that a Vercel rollback reverses SQL. Missing history makes apply fail
closed rather than replaying the entire migration chain.

Legacy four-digit versions and CLI-generated fourteen-digit timestamps are
supported. Never edit a migration already applied to an environment to repair
drift there: create a new forward migration.

## Pre-promotion public reporting compatibility

Run the following read-only preflight with an authorized database operator
connection **before** promoting the matching application build:

```bash
psql -X -v ON_ERROR_STOP=1 -f scripts/check-public-reporting-contract.sql
```

Configure database credentials privately. The SQL uses `SET LOCAL ROLE anon`
and `LIMIT 0`, so it tests public view permissions without reading records.
If either reporting view fails, stop the promotion. Fix the public
projection; **never** grant anonymous access to private field-test reports
as a workaround.

On November 20, 2026, production returned SQLSTATE 42501 for both
`field_test_reports_public` and `field_test_counts`. The corresponding
migration has not been applied. A successful build alone is not release
approval.
