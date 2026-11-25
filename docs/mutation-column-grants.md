# Draft mutation-column privilege repair

Status: source prepared; no hosted grants, schema or data changed.

On November 23, a read-only effective-grant inventory found authenticated
INSERT access to every request field, including fulfillment attribution and
created_at, and UPDATE access to rating identity, created_at and derived rig
axes. Upvote created_at was also insertable. These differ from the column
boundaries in migrations 0018 and 0021. Anonymous table grants are broader than
necessary too; grants alone are not proof of an anonymous write bypass because
RLS still applies.

The additive reconciliation resets INSERT/UPDATE table **and column** grants
from PUBLIC, anon and authenticated on six explicitly reviewed tables, then
restores only these authenticated fields:

| Table           | INSERT                                                         | UPDATE                                      |
| --------------- | -------------------------------------------------------------- | ------------------------------------------- |
| setup_requests  | requester_id, game, car, track, notes                          | notes                                       |
| setup_comments  | setup_id, user_id, body                                        | none                                        |
| setup_upvotes   | user_id, setup_id                                              | none                                        |
| setup_favorites | user_id, setup_id                                              | none                                        |
| follows         | follower_id, followed_id                                       | none                                        |
| setup_ratings   | user_id, setup_id, pace, predictability, rater_rig, updated_at | pace, predictability, rater_rig, updated_at |

The rating rig is a supported user choice from migration 0037. Include its
column explicitly; merely replaying 0021's older allowlist would break rig
ratings. Derived axes stay database-owned. updated_at remains writable for
compatibility with the established mutation contract; created_at does not.
Profiles are deliberately left to #48. Setup content grants already inspected
as restricted are untouched, as are SELECT, DELETE, service-role privileges,
RLS policies and all existing rows. Effective service-role INSERT/UPDATE
privileges are checked before and after the repair; conflicts abort instead
of silently breaking a custom service-role inheritance setup.

Table revocation does not remove old column grants. The migration removes both
layers and checks effective privileges for every column/role afterward.
Unexpected inherited privileges fail the transaction instead of reporting false
protection or silently editing a custom parent role. Missing/RLS-disabled tables
also fail. Modern disposable migrations use the same transaction wrapper as
manual delivery; the file has a five-second lock timeout and can be reapplied.

## Rating API compatibility

The existing application used PostgREST upsert with user_id/setup_id in the
payload. Such upserts can request UPDATE of the conflict keys even when their
values do not change, which conflicts with immutable-key grants. Do not fix
that by granting ownership/target columns UPDATE again.

The matching app calls `save_setup_rating(setup_id, pace, predictability, rig)`.
This SECURITY INVOKER helper derives the user from auth.uid(), validates input,
and atomically inserts or updates only mutable score/rig/time fields. RLS,
self-rating guards and aggregate/rig-axis triggers still run. It has an empty
search_path and authenticated-only execution; it adds no elevated routine.
The new app uses server time and sends no owner ID or timestamp parameter.

This requires a coordinated, isolated-tested database/app rollout. Old browser
upsert code may receive permission errors after tightening; missing-RPC errors
must not trigger an unsafe legacy fallback. Verify PostgREST schema refresh and
real new/repeated ratings, null/known rigs, scoring aggregates, authorization,
request/comment creation and fulfillment before final exact-SHA approval.

## Evidence and checks

Disposable SQL tests deliberately restore blanket, individual-column and
PUBLIC grants, reconcile/reapply, and exercise real API roles. Positive cases
cover community inserts, notes edits, rating creation/update with derived axes,
owner deletes and privileged fulfillment. Negative cases cover forged request
fulfillment, backdated requests/comments, rating target/timestamp/axis changes,
self-rating, missing identity and invalid scores. An inherited grant on the last
target table must abort and roll back earlier ACL repairs. A separate fixture
makes a service-role capability depend on PUBLIC; its removal must abort too.

Read-only effective privileges can be inspected without user-row data:

```sql
begin read only;
select c.relname as table_name, a.attname as column_name,
       has_column_privilege('authenticated',c.oid,a.attnum,'INSERT') as insert_allowed,
       has_column_privilege('authenticated',c.oid,a.attnum,'UPDATE') as update_allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
where n.nspname='public' and c.relname in
  ('setup_requests','setup_comments','setup_upvotes','setup_favorites','follows','setup_ratings')
order by c.relname,a.attnum;
rollback;
```

Do not paste the repair into production to bypass #41/#46/#47/#66 release gates.
Local SQL fixtures are not hosted Auth/PostgREST integration. Existing database
PRs remain drafts; this repair does not authorize production deployment.
