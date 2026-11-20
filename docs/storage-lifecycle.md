# Draft Storage quotas and claimed cleanup

Status: **source proposal only**. No hosted migration, Edge Function, secrets,
Storage settings or objects have been changed. This branch includes the earlier
extension-policy reconciliation from #68 and adapts its disposable test to run
before the new write restrictions. Do not merge or deploy this branch until the
staging and exact-SHA release gates below are met.

## Closed rollout gate

The migration creates a private rollout row with `legacy_drained_at = NULL`.
Reservations, ticket consumption and deletion claims fail closed (SQLSTATE 55000) until that gate is deliberately activated. Inventory remains read-only;
completion/finalization of previously acknowledged operations can still finish.
No API role, including service_role, can change the gate directly.

Before activation, stop legacy URL issuance and workers, invalidate/drain all
previously issued provider capabilities using a verified provider procedure,
and establish that already-started uploads have finished. Merely waiting the
documented signed-token lifetime is insufficient. If this cannot be established,
leave the gate closed; do not claim universal quota or safe legacy cleanup.

After the verified drain, isolated staging acceptance and exact-SHA approval,
the privileged release operator may execute this **separate reviewed activation**:

```sql
-- Never run as part of automatic migration or before verifying legacy drain.
update setupsheet_storage_private.rollout
set legacy_drained_at = clock_timestamp()
where singleton and legacy_drained_at is null;
```

This is not authorization to run the statement on any hosted environment.
Disposable SQL tests activate only their synthetic fixtures.

## Upload protocol

The proposed default budget is **100 upload slots and 1 GiB of reserved
capacity per account**. Charge every slot the full 10 MiB bucket ceiling,
regardless of the browser's size claim. The 100-slot limit binds first (1,000
MiB). Existing objects, abandoned reservations and objects pending deletion all
count. A grouped union counts an uploaded reservation once. Larger legacy objects
are charged at their provider-recorded size; unknown/malformed size metadata
blocks new reservations until inventory is reconciled. An account advisory lock
serializes quota checks and inserts; existing above-budget accounts retain
objects but cannot reserve more. These are draft product limits for review.

1. The authenticated Server Action retains its shared issuance rate limiter.
   It derives the owner from verified Auth, generates the path, and calls the
   service-only `reserve_storage_upload(owner, path, kind)` RPC. The private
   ledger records an owner-bound ticket valid for 15 minutes. The response's
   existing `token` field now carries that ticket UUID, **not a Storage JWT**.
2. The browser POSTs the binary file to `/functions/v1/storage-upload` on its
   configured Supabase backend, using its user access token and ticket. The
   function verifies the JWT through Auth.getUser and atomically consumes the
   matching ticket with `begin_storage_upload`. It never trusts decoded claims,
   user_metadata, caller-supplied owners or caller-supplied object paths.
3. The function bounds actual received bytes (5 MiB setup, 10 MiB telemetry)
   and total body read time (20 seconds), bounds each isolate to two active
   requests before consuming tickets, checks the shared file-signature
   rules, then performs one non-upsert privileged Storage upload. It forces
   `application/octet-stream` rather than trusting a browser MIME label.
4. Only after Storage acknowledges completion and its metadata exists can
   `complete_storage_upload` mark the path ready. The browser then retains the
   existing metadata verification step before attaching the file.

Ordinary authenticated/anonymous Storage INSERT, UPDATE and DELETE are closed.
Public reads are preserved. Privileged keys stay in server/Edge environments;
clients receive only their own session token and application ticket. New public
lifecycle RPCs are executable by service_role only; the private schema and
RLS-enabled ledger have no API grants. Lock waits are bounded to five seconds.

Why an Edge Function: proxying 5/10 MiB bodies through a Vercel Function would
regress the supported limits. A direct provider signed URL does not establish
that a request started before token expiry has finished streaming. This draft
therefore issues **no external Storage upload capability**. A begun upload is
one-use and remains `issuing` until its provider operation is acknowledged.

## Cleanup and attachment protocol

`storage_cleanup_candidates` is read-only, limited to 1,000 candidates per run,
and requires a grace period between 24 hours and 30 days. It includes expired
never-used tickets as well as legacy orphaned objects. Inventory is advisory.

For every deletion, the worker must first call `claim_storage_cleanup`. The RPC
locks the object path, checks both current setup and version-history references,
checks ticket/upload state and age, and records a durable claim. Triggers on
both attachment tables acquire those same sorted path locks before attachment
changes become visible. If attachment wins, cleanup sees the reference and
refuses. If cleanup wins, attachments to deleting/deleted paths are rejected,
including writes through privileged database paths. Stale repeatable-read
snapshots fail closed rather than skipping an invisible claim.

The worker calls the Storage API only for claimed paths. It then calls
`finish_storage_cleanup`; quota is released only when Storage metadata is
absent and references remain absent. Partial or empty Storage responses are not
trusted as evidence of deletion. Retries keep the original claim and permanent
tombstone; a failure never reopens a path. No application or worker code deletes
`storage.objects` rows directly.

Edits, setup deletion and `discardUploadedFiles` no longer immediately remove
bytes. Historical versions or concurrent saves may still need them. The
existing weekly job stays inventory-only; manual deletion still requires
`--apply`, the current default revision, and the existing account-deletion
confirmation when selecting an account. Account cleanup also respects references
and grace; its flag does not override the claim protocol.

## Failure states and retention

- An expired `reserved` ticket that never began a provider upload can be retired
  after the grace period. A retired ticket can never start an upload later.
- An interrupted or uncertain provider upload stays `issuing`, charged and
  ineligible for cleanup indefinitely. There is intentionally no automatic
  timeout that frees capacity while a delayed provider operation might finish.
- A failed delete stays `deleting`. Retrying removal and finalization is safe;
  never manually reset it to ready just to clear an error.
- Tombstones retain object paths and owner UUIDs and intentionally survive
  account deletion. Account-erasure/retention rules for this private ledger
  require review before release; do not blindly purge markers that still
  protect in-flight operations or references.

Read-only operator inventory (privileged database connection):

```sql
select state, count(*) as paths, min(created_at) as oldest
from setupsheet_storage_private.objects
group by state order by state;
```

Uncertain `issuing` cases need provider-operation reconciliation. This draft does
not automate that recovery or claim that inventory/HTTP success proves backing
blob deletion and CDN invalidation. Existing operator/admin service-key users
remain trusted: a caller with that credential can bypass Storage RLS, so drain
legacy workers and prevent out-of-protocol privileged deletion at cutover.

## Required isolated staging and release gates

1. Resolve #66's Supabase integration/config safety and #47's backend isolation.
   Do not fix db.major_version or deploy pending migrations automatically here.
2. Review the proposed account limits and private-ledger retention. Verify the
   complete migration batch and matching app/function/worker SHAs, and plan a
   coordinated maintenance window. The migration intentionally closes the old
   upload/delete path; it is not compatible with old browser upload code.
3. Deploy the function only to isolated staging. Set its nonsecret
   `STORAGE_UPLOAD_ORIGINS` to a comma-separated list of exact allowed HTTPS
   frontend origins (loopback HTTP is supported locally). No wildcards or
   automatic production-backend previews. Missing/malformed config fails closed.
   Use project-scoped server secrets; never NEXT_PUBLIC privileged credentials.
4. `verify_jwt=false` in the proposed function config is intentional: the handler
   always verifies the actual bearer token with Auth.getUser, supporting current
   signing keys. Confirm anonymous/expired and cross-account denials. Measure
   session-revocation behavior; do not assume logout immediately invalidates
   already-issued access tokens.
5. Confirm hosted 5/10 MiB request delivery, content/metadata/byte round-trips,
   browser CORS, supported formats, rate/quota boundaries, one-use tickets,
   duplicate requests, network/process failures and claim retries. Verify that
   no provider token is returned and direct upload/mint/update/delete fail.
6. Race setup/telemetry attachment, history creation, deletion and cleanup on a
   real isolated Auth/PostgREST/Storage stack. Verify bytes/CDN behavior, session
   rotation and account deletion/retention. Disposable metadata tests do not
   establish these results.
7. Approve the final default SHA and controlled release. Pause legacy cleanup
   workers, apply the complete SQL transaction, deploy the matching Edge/app/
   worker revisions and origins, and verify catalogs and real flows before
   activating the closed rollout gate and reopening uploads. Confirm the legacy
   provider-capability drain before activation. Do not restore client write policies as an ad hoc
   rollback while continuing to claim quota enforcement.

## Local validation commands

```sh
npm ci
npm run typecheck
npm run typecheck:edge
npm test
npm run lint
npm run format:check
npm run build:budget
# Dedicated disposable loopback PostgreSQL instance only:
npm run test:db
```

Deno and the Edge SDK are pinned; the Edge lockfile is checked frozen in CI.
Database tests include normal API grants, direct-client denial, shared quota
accounting, ticket ownership/replay, metadata-confirmed completion, history
protection, durable claims/tombstones and real overlapping sessions. The worker
uses mocked Storage HTTP in unit tests. No local suite invokes a hosted delete.
