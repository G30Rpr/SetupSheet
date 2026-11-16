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
   privileges. Do not set it until recovery readiness and release order have
   been verified. No credentials belong in an issue, PR, or log.

## Release procedure

1. Verify an independently recoverable encrypted backup, isolated restore and
   Storage-byte recovery using `recovery-operator-handoff.md`. Inspect live
   constraints, policies, grants and function definitions; recorded migration
   versions alone do not establish compatibility.
2. Rehearse every pending migration against the representative isolated backend,
   including 0042–0047. Verify both the running application and the proposed
   application against the migrated schema. A fresh-database CI pass does not
   cover drift in a hosted installation.
3. Dispatch **Deploy Migrations** on the default branch with `dry_run=true`
   and the exact full commit SHA. Review the pending list.
4. For the approved release, dispatch again with that same full SHA and
   `dry_run=false`. The apply job uses the protected Environment and refuses
   another branch, a mismatched SHA, or a default branch that advanced while
   awaiting approval. Keep merges paused for the duration of the release.
5. Verify hosted catalogs and anonymous/cross-user denial cases, then promote
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
