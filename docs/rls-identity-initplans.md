# RLS identity evaluation optimization

Status: proposed database change; no hosted migration has been applied.

`20261120150619_rls_identity_initplans.sql` wraps statement-independent
`auth.uid()` calls in scalar SELECTs in 17 explicitly listed policies:

- Garage sessions: three policies.
- Garage revisions: two policies.
- Garage laps and run-plan items: three policies each.
- Private field-test reports: three Garage-writer policies.
- Setup ratings: INSERT and UPDATE policies.
- Setup upvotes: INSERT policy.

These are the 17 `auth_rls_initplan` findings observed on production on
2026-11-20. A read-only catalog comparison confirmed that every target policy
matches the migration's legacy manifest, including roles and commands. The
local historical migrations contain additional direct identity calls that are
already optimized on production; this patch deliberately leaves them alone.

Each independent scalar SELECT can become an InitPlan, evaluated once per
statement execution. Multiple occurrences can produce multiple InitPlans;
this does not promise one total identity evaluation for an entire query. See
[Supabase's RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).
Correlated ownership lookups remain correlated; this patch does not remove
those lookups or claim to eliminate their cost.

The migration keeps every existing role, command, permissiveness setting,
USING clause and WITH CHECK ownership/anti-self-rating condition. It adds no
grants or SECURITY DEFINER functions and changes no data. An exact catalog
manifest accepts either the reviewed old predicates or the already optimized
predicates. Missing policies or unexpected authorization drift raise an error
and roll back the entire DO statement. It uses a five-second lock timeout and
restores the caller's search_path and lock_timeout after success.

## Validation

Run `npm run test:db` only against a dedicated disposable local PostgreSQL
instance, following the database isolation guard in `scripts/assert-local-test-db.sh`.

The new SQL regression checks cover idempotent reapplication, late policy
preflight failure with rollback of earlier optimizations, owner visibility
across 1,500 synthetic sessions, an EXPLAIN ANALYZE InitPlan with Actual Loops
of one, and prepared statements reused for two identities and a missing JWT.
The existing Garage and rating-trust SQL suites independently cover owner and
foreign-user writes, private report access, and self-rating denial.

Do not merge/apply solely because disposable SQL tests pass. Follow
`docs/migration-release-controls.md`, verify the Supabase GitHub integration
behavior tracked in issue #66, refresh the read-only policy inventory, and
complete the exact-SHA staging/release gates. PostgreSQL shim tests do not
verify hosted Auth, PostgREST or Storage integration.
