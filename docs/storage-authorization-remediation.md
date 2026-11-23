# Storage authorization remediation

Status: extension-policy repair proposed; quota and atomic cleanup remain open.
No hosted bucket settings, policies, objects or account data were changed.

## Extension-policy drift repair

On 2026-11-20 the four live `storage.objects` policies matched the original
owner-folder rules from `0004_setup_files.sql`. The INSERT and UPDATE policies
did not contain the supported-extension restrictions committed in
`0019_storage_extension_hardening.sql`.

`20261120151501_reconcile_storage_extension_policies.sql` accepts exactly those
legacy predicates or the reviewed 0019 predicates and restores 0019's gate.
It preserves the owner-folder restriction, both UPDATE predicates, authenticated
role targeting, public SELECT and owner DELETE policies. It makes no bucket or
object changes. It rejects missing/changed target policies or an unexpected
INSERT/UPDATE/ALL policy inventory that might bypass the gate. It uses a
five-second lock timeout and restores caller settings after success.

The disposable SQL regression recreates the actual live drift, repairs it,
reapplies the migration, and compares every Storage policy to 0019's definition.
It checks all 16 supported setup/telemetry extensions, uppercase names, valid
owner updates, foreign folders, other buckets, HTML/JS and double extensions,
unsafe renames, missing identity and anonymous denial. API table/schema grants
are supplied in the test so an accidentally missing shim privilege cannot
stand in for an RLS denial. Run with `npm run test:db` against a dedicated
local disposable PostgreSQL instance only.

This preserves the existing filename-based boundary. It does not certify file
content or impose tighter path-shape, MIME or byte constraints. The 10 MiB
bucket cap remains the outer limit; the app's 5 MiB setup limit is enforced
when confirming/attaching a file. Review `docs/storage-mime-compatibility.md`
before proposing a bucket MIME allowlist.

## Remaining quota boundary

`createUploadTarget` consumes a shared database rate limit before signing a
URL, but an authenticated client can call Storage directly under the existing
INSERT policy. Extension reconciliation does not make that limiter universal.
Do not describe it as a per-account Storage byte/object quota.

A proposed follow-up needs a single trusted issuance path and durable upload
reservations, validated on isolated staging before policy changes:

1. Reserve object count and worst-case bytes atomically per account before
   minting a path-bound, non-upsert upload capability. Use the bucket's full
   maximum size for reservations until actual size is verified; do not trust
   the browser's reported size.
2. Deny ordinary authenticated direct uploads and direct URL minting. Only
   the authenticated application server may use a server-only signing
   credential after reservation succeeds. Keep privileged keys out of public
   variables and clients. Verify the Storage service's actual signing and
   upload behavior before relying on these boundaries.
3. Reconcile abandoned reservations after the capability expires; do not free
   their quota while an outstanding capability can still create an object.
4. Verify actual metadata/content before attachment and preserve quotas under
   concurrent mint requests, oversized uploads, token replay and failed uploads.

This is a design proposal, not an implemented quota mechanism. Exact account
budgets and credential/deployment changes still require a reviewed rollout.

## Remaining attachment versus cleanup race

An eligibility SELECT followed by Storage API removal is not atomic with
setup creation or editing. The inventory-only sweep default from #65 stays
necessary. A safe implementation needs a database attachment state machine:
mark an unreferenced object pending deletion under a lock, prevent new current
or version-history references to pending objects in the same locking protocol,
then remove bytes through the Storage API and finish idempotently. A failed
API request must leave a recoverable state; it must not silently reopen the
object to attachment. Never delete `storage.objects` rows directly.

Until implemented and verified, destructive cleanup requires explicit apply
and a coordinated write pause/recheck. Keep unattended deletion disabled.

## Isolated staging acceptance matrix

Run against a separately verified staging project with synthetic accounts and
fixtures, never against the production-linked Preview environment:

- Every supported extension through direct and signed upload flows, including
  the observed platform MIME variants; verify returned bytes and metadata.
- Anonymous, cross-account, unsupported extension, double extension, missing
  identity, renamed object, upsert and expired-token behavior.
- Concurrent issuance at the quota boundary, client size lies, upload failure,
  expired reservations, duplicate token use and cleanup recovery.
- Concurrent setup/telemetry attachment and version creation while a candidate
  enters cleanup; no referenced object may disappear.
- Auth session rotation and deletion, profile edit and reporting flows with
  the exact application and migration SHAs planned for release.

Local metadata SQL tests do not execute Auth, PostgREST, signed upload tokens,
backing blob deletion or CDN invalidation. These checks remain unverified until
an isolated full-stack run is recorded. Follow issue #66 and the migration
release controls before merging or applying this database draft.
