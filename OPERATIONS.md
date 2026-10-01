# SetupSheet operations guide

This file documents the operator-only steps that cannot safely run through the public application. Run the SQL below from the Supabase SQL Editor or a protected service-role job, never from a browser client.

## Review deletion requests

```sql
select id, user_id, status, created_at
from public.account_deletion_requests
where status in ('pending', 'processing')
order by created_at asc;
```

After verifying the request and following the applicable retention/legal policy, deleting the user from `auth.users` cascades through the public profile and owned records created by the migrations:

```sql
begin;

-- Mark the request complete before the account delete. The request row
-- references auth.users with ON DELETE CASCADE, so it is removed together
-- with the account; export any audit record first if retention requires it.
update public.account_deletion_requests
set status = 'completed', completed_at = now()
where user_id = '<USER_UUID>'::uuid
  and status in ('pending', 'processing');

-- Replace with the reviewed request's user_id.
delete from auth.users
where id = '<USER_UUID>'::uuid;

commit;
```

If the delete is performed through an external Supabase Admin API instead, update the request row afterward from a protected operator context. Do not grant `authenticated` or `anon` permission to delete from `auth.users`.

**The cascade does not reach Storage.** `auth.users → profiles → setups → …` removes
rows; the ex-user's uploaded setup/telemetry files keep their objects in the public
`setup-files` bucket and stay downloadable at their `getPublicUrl` path. Capture and
delete them as part of the same request — see
[Storage lifecycle](#storage-lifecycle-uploads-orphans-and-deletions).

## Storage lifecycle: uploads, orphans, and deletions

### How a file becomes public

1. `uploadSetupFile` / `uploadTelemetryFile` (`src/lib/actions/setups.ts`) put the object
   at `{userId}/{uuid}-{safeFileName}` — telemetry: `{userId}/telemetry-{uuid}-{safeFileName}` —
   in the public `setup-files` bucket. The upload happens **before** the `setups` row
   exists, because the row stores the path.
2. `createSetup` / `updateSetup` then write `file_path` / `telemetry_file_path`. A path is
   only ever accepted for a row owned by the same user ID (`isOwnedStoragePath` in
   `src/lib/storage.ts`, enforced by `validateAttachment`), so one account cannot attach
   another account's object.
3. The bucket policies (`0004`, tightened by `0019`) let `authenticated`
   insert/update/delete only inside its own folder, and insert/update additionally require
   a known setup/telemetry extension. `0029` caps any object in the bucket at 10 MiB,
   which binds direct REST callers too — the app's 5 MB/10 MB limits alone do not.
   Anyone can read objects in `setup-files`: the bucket is public, which is what makes a
   shared download link work without a session.

Consequence of step 1: a submit that fails after the upload (validation error, rate limit,
crashed request) leaves a publicly fetchable object with no row referencing it. The form
hands those paths to `discardUploadedFiles` (best effort), and `orphaned_setup_files()`
below is the backstop for anything that still slips through.

### Deleting an object — the only correct path

Always delete through the Storage API:

```bash
# service_role key; server/operator context only, never in a browser bundle
curl -X DELETE "$SUPABASE_URL/storage/v1/object/setup-files/<path>" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

or the Storage tab in the dashboard.

Do **not** `delete from storage.objects where name = '...'`. The bucket is backed by object
storage; removing only the catalog row leaves the bytes (and their CDN entries) in place,
so the file stays downloadable while looking gone. The inverse is just as bad: bytes
without a catalog row can no longer be found by any of the queries below.

The application's own cleanup path (`discardUploadedFiles`, and Storage removal in
`deleteSetup`) does not need the service key: it deletes through the signed-in user's
session, which the owner-scoped delete policy in `0004` already allows, and
`isOwnedStoragePath` narrows each request to that same folder before it is sent. Operator
sweeps are different — you are deleting objects nobody is signed in as — so they use the
service-role key.

### Sweeping orphans

`public.orphaned_setup_files(grace interval default '24 hours')` (from `0028`) returns every
`setup-files` object that (a) is older than the grace window and (b) is not referenced by any
`setups.file_path`, `setups.telemetry_file_path`, `setup_versions.file_path` or
`setup_versions.telemetry_file_path`.

```sql
select * from public.orphaned_setup_files();                  -- then delete each name
select count(*) from public.orphaned_setup_files('7 days');   -- audit first
```

- The grace window exists because the row insert may legitimately still be in flight. Don't
  lower it below a few minutes.
- Historical `setup_versions` paths are deliberately **not** garbage: the version trail is
  what moderation and the edit history read. A setup whose current file was replaced still
  has the old object referenced by its history.
- Both functions are `security definer`, `select`-only, and executable by `service_role`
  (revoked from `anon`/`authenticated`) because the object names they list belong to other
  users.
- Deletion is intentionally not implemented in SQL. Run the list, then delete via the
  Storage API above; re-running the query afterwards should return 0 rows.
- Automated CLI tool: run `npm run storage:sweep -- --dry-run` to audit orphans without
  deleting, or `npm run storage:sweep` to delete in batches via the Storage API.
  For completed account deletions: `npm run storage:sweep -- --user <user-uuid>`.
- Scheduled sweeps: configure a scheduled workflow (or cron) running `npm run storage:sweep`
  with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to automate weekly maintenance.

### Per-account listing

`public.setup_files_for_user(p_user_id uuid)` returns every object under one account's
folder, referenced or not — capture it **before** the `auth.users` delete, and use it
afterwards to confirm the folder is actually empty:

```sql
select * from public.setup_files_for_user('<USER_UUID>');
```

### Verifying a completed deletion

```sql
select exists(select 1 from public.profiles where id = '<USER_UUID>');  -- expect f
select * from public.setup_files_for_user('<USER_UUID>');                -- expect 0 rows
select count(*) from public.orphaned_setup_files();                      -- should not grow
```

`setup_files_for_user` is the check row counts alone cannot give you: the database can be
fully clean while the departed user's uploads are still being served.

## Review content reports

```sql
select
  id,
  reporter_id,
  target_type,
  target_id,
  reason,
  details,
  status,
  created_at
from public.content_reports
where status in ('pending', 'reviewing')
order by created_at asc;
```

After investigating, an operator can update only the report workflow fields:

```sql
update public.content_reports
set status = 'resolved', reviewed_at = now()
where id = '<REPORT_UUID>'::uuid;
```

Remove or hide violating content using the existing owner/admin process, and preserve evidence only as long as the approved retention policy requires.

## Engineer, Garage, and field-test data

- The Garage tables (`garage_sessions`, `garage_revisions`, `garage_run_plan_items`, and
  `garage_laps`) are private, owner-scoped data. Do not expose them through new anonymous
  queries or grant broad table access; child-row RLS follows ownership through the parent
  session.
- `field_test_reports` is also private. Public reads must use the explicit
  `field_test_reports_public` and `field_test_counts` views; never add public access to the
  base table or expose private notes, Garage session IDs, or internal user IDs.
- `engineer_calibration_evidence` contains only recent aggregates and no report/setup/session/
  user identifiers. Static Engineer recommendations remain the fallback if this view is
  absent or unreadable. Calibration is a ranking adjustment, not a change to the recommended
  setup amounts.
- The Engineer and Garage workflow currently support ACC and Le Mans Ultimate only; do not
  treat other catalog games as reviewed.

## Before launch

- Apply migrations `0023` through `0035` after `0022`, in numeric order. This includes
  `0027` (most-wanted view), `0028` (Storage retention helpers), `0029` (bucket size cap),
  `0030` (private Garage tables/RLS and atomic baseline creation), `0031` (server-derived
  start-from-setup RPC), `0032` (field-test reports and sanitized public projections),
  `0033` (90-day privacy-safe Engineer calibration evidence), `0034` (audit remediation),
  and `0035` (shared atomic upload-target rate limiting). Do not deploy the matching app
  changes before applying the migrations. The `db-migrations` CI job runs the full harness
  against PostgreSQL 16; live configured-Supabase validation remains a separate deployment
  check.
- Confirm the `leaderboard` view exposes `total_ratings` and `setup_search` exposes
  `author_username`, and that the new objects exist:

  ```sql
  select count(*) from public.setup_requests_most_wanted;      -- view from 0027
  select has_function_privilege('authenticated','public.orphaned_setup_files(interval)','execute');  -- expect f
  select has_function_privilege('service_role','public.orphaned_setup_files(interval)','execute');   -- expect t
  select file_size_limit from storage.buckets where id = 'setup-files';  -- expect 10485760

  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'garage_sessions', 'garage_revisions', 'garage_run_plan_items', 'garage_laps',
      'field_test_reports', 'field_test_reports_public', 'field_test_counts',
      'engineer_calibration_evidence'
    );

  select has_function_privilege('anon','public.create_field_test_report(uuid,uuid,text)','execute');
  -- expect f
  select has_function_privilege('authenticated','public.create_field_test_report(uuid,uuid,text)','execute');
  -- expect t
  ```

- Configure and verify shared WAF/CDN rate limits before launch. Suggested starting ceilings
  (tune against normal traffic and provider limits):
  - `POST /api/telemetry` and `POST /api/csp-report`: 30 requests/minute/IP. The handlers
    already cap bodies at 8 KiB and 16 KiB respectively, and discard unrecognized payloads.
  - Next Server Actions (`POST /_next/action`): 120 requests/minute/IP as a broad abuse ceiling;
    retain the tighter per-user database limits for uploads and other writes.
  - `GET /api/setups/*/bundle`: 60 requests/minute/IP. Do not require login for ordinary
    setup downloads; this limit is to constrain automated fetch amplification.
  - Authentication failures: configure the provider's Auth rate limits separately, since
    browser auth requests go directly to Supabase rather than through the app's WAF path.
  Migration `0035` provides a shared atomic 30-requests/user/hour upload-target quota. Edge
  limits remain defense in depth and protect unauthenticated endpoints, anonymous download
  counter actions, and serverless capacity. Confirm the deployed plan supports the rules;
  if not, configure equivalent limits at the CDN or another shared edge provider and record
  a burst/false-positive review before enforcement.
- Configure malware scanning/quarantine if community uploads are not manually reviewed.
- Replace repository-based privacy contact language with a monitored contact.
- Restrict SQL Editor/service-role access to trusted operators and rotate credentials according to the provider policy.

## Operator SLAs and Review Procedures

### Account Deletion Requests (`account_deletion_requests`)
- **Target SLA:** Review and execute within **7 calendar days** of submission (well within statutory GDPR 30-day and CCPA 45-day requirements).
- **Execution Runbook:**
  1. Inspect pending requests:
     ```sql
     select id, user_id, status, created_at
     from public.account_deletion_requests
     where status = 'pending'
     order by created_at asc;
     ```
  2. Mark request as `processing`:
     ```sql
     update public.account_deletion_requests
     set status = 'processing'
     where id = '<REQUEST_ID>'::uuid;
     ```
  3. Purge user's files from Supabase Storage:
     ```bash
     npm run storage:sweep -- --user <USER_UUID>
     ```
  4. Complete request and delete user from `auth.users` (cascading public profiles, setups, versions, ratings, comments, and upvotes):
     ```sql
     begin;
     update public.account_deletion_requests
     set status = 'completed', completed_at = now()
     where user_id = '<USER_UUID>'::uuid;

     delete from auth.users where id = '<USER_UUID>'::uuid;
     commit;
     ```

### Content Moderation Reports (`content_reports`)
- **Target SLA:**
  - **Critical (spam, unsafe_file, harassment):** Review within **24 hours**.
  - **Standard (copyright, other):** Review within **72 hours**.
- **Investigation Runbook:**
  1. Query active moderation queue:
     ```sql
     select id, reporter_id, target_type, target_id, reason, details, status, created_at
     from public.content_reports
     where status in ('pending', 'reviewing')
     order by created_at asc;
     ```
  2. Inspect target entity:
     - For `setup`: `select * from public.setups where id = '<TARGET_ID>'::uuid;`
     - For `comment`: `select * from public.setup_comments where id = '<TARGET_ID>'::uuid;`
     - For `profile`: `select * from public.profiles where id = '<TARGET_ID>'::uuid;`
  3. Action:
     - If violating: delete the offending comment or setup (followed by `npm run storage:sweep`), and suspend/ban the author if malicious.
     - Update report status:
       ```sql
       update public.content_reports
       set status = 'resolved', reviewed_at = now()
       where id = '<REPORT_ID>'::uuid;
       ```
     - If benign or false positive:
       ```sql
       update public.content_reports
       set status = 'dismissed', reviewed_at = now()
       where id = '<REPORT_ID>'::uuid;
       ```

## Backup, Restore, and Migration Rollback Policy

### Automated & On-Demand Backups
1. **Automated Backups:** Ensure daily automated backups and Point-In-Time Recovery (PITR) are enabled in the Supabase Dashboard under **Project Settings > Database > Backups**.
2. **On-Demand Operator Snapshot:** Before running any manual DDL or running migrations against production, take an explicit logical schema + data snapshot:
   ```bash
   # Schema + data backup via Supabase CLI
   supabase db dump --project-ref <PROJECT_REF> -f "backup_$(date +%Y%m%d_%H%M%S).sql"

   # Or via pg_dump
   pg_dump "$DATABASE_URL" --format=custom --file="setupsheet_$(date +%Y%m%d_%H%M%S).dump"
   ```

### Restoration Runbook
- **Point-In-Time Restore (PITR):** In the Supabase Dashboard, select PITR to restore to a specific timestamp or spin up a restored branch.
- **SQL Dump Restore:** To restore a custom dump file to a recovery database:
  ```bash
  psql "$RECOVERY_DATABASE_URL" -f backup_YYYYMMDD_HHMMSS.sql
  ```

### Migration Rollback Policy
- **Forward-Fix Principle:** SetupSheet operates on a strict forward-fix migration policy. Never delete historical migration files that have already been applied to production. Write a new sequential migration (`0035_...`) to revert or adjust schema definitions.
- **Transactional DDL:** PostgreSQL supports fully transactional DDL (`CREATE INDEX`, `ALTER TABLE`, `CREATE FUNCTION`). Wrap manual DDL alterations in `BEGIN ... COMMIT;` blocks so a failed alteration rolls back completely without leaving partial schema changes.
- **Rolling Back Specific 0034 Changes:**
  - To drop added indexes if needed: `drop index if exists public.<index_name>;`
  - All trigger replacements in `0034` are idempotent `create or replace function`, making rollback as simple as re-applying previous function bodies if necessary.
