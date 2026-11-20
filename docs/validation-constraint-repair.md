# Validation constraint repair

The forward migration `20261116211420_reconcile_validation_constraints.sql`
reconciles the 22 public-data CHECK constraints from historical migration 0018.
It restores the pure setup-values validator, preserves matching checks and their
validation status, and adds only missing checks as NOT VALID. It does not edit
application records, reapply 0018, change RLS or adjust table/RPC grants.

Before release, generate the read-only preflight SQL:

```bash
node scripts/validation-constraints-preflight.mjs > /private/path/validation-preflight.sql
```

Run that file through an authorized PostgreSQL connection using `psql -X` and
`ON_ERROR_STOP=1`. It reports presence, definition agreement, validation status
and violation counts; it does not return individual records or use credentials
from the application. The SQL starts a read-only transaction explicitly. Use an
operator role that can inspect all rows in the five affected tables; application
roles can hide rows through RLS. Stop if any `rls_filtering_active` flag is true.

Stop if a present definition disagrees or any violation count is nonzero. Review
historical data separately and prepare an approved reconciliation; do not delete
or truncate content automatically. Existing invalid setup rows can also be
blocked by history-snapshot constraints when edited, so resolve that data before
installing new validation. A zero-count snapshot is not recovery evidence.

The migration checks again while blocking writers to each affected table. It
aborts on incompatible rows or conflicting definitions and uses a five-second
lock timeout. Constraint additions take their normal ACCESS EXCLUSIVE lock;
rehearse the duration and coordinate a release window. Canonical expressions are
checked on the supported PostgreSQL 16/17 versions; review formatting/definition
changes before an engine upgrade rather than skipping mismatches.

Use the release gate and recovery prerequisites in `migration-release-controls.md`.
Apply each file and its history entry in one transaction. After release, rerun
the preflight and test both valid API writes and denial cases. Validate NOT VALID
constraints in a separately reviewed step; this repair preserves existing
validation status rather than downgrading already validated checks.
