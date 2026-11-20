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

## Follow-up lifecycle draft

The proposed quota and cleanup implementation is documented in
[storage-lifecycle.md](storage-lifecycle.md). It replaces the earlier direct
signed-URL design with one-use application tickets and a trusted Edge upload
handler, preserving 5/10 MiB uploads outside Vercel's request-size limit. Token
expiry alone would not prove that an already-started upload had finished.

The lifecycle draft closes ordinary client writes, reserves capacity atomically,
coordinates attachment and cleanup, and keeps uncertain operations charged.
It supersedes the write-policy model above only at a separately validated,
coordinated release. This branch contains both migrations so the earlier
reconciliation test remains covered. No hosted changes or integrated staging
claims are implied; follow the detailed release gates in storage-lifecycle.md.
