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
- Nothing schedules this yet. Until a scheduled job exists (see
  `LAUNCH_CHECKLIST.md`), run it whenever you complete a deletion request, and at least
  weekly.

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

## Before launch

- Apply migrations `0023` through `0029` after `0022`, in numeric order
  (`0027` adds the most-wanted view, `0028` the Storage retention helpers, `0029` the
  bucket size cap). `npm run test:db` applies all of them in order against a scratch
  database and is the CI gate for this.
- Confirm the `leaderboard` view exposes `total_ratings` and `setup_search` exposes
  `author_username`, and that the new objects exist:

  ```sql
  select count(*) from public.setup_requests_most_wanted;      -- view from 0027
  select has_function_privilege('authenticated','public.orphaned_setup_files(interval)','execute');  -- expect f
  select has_function_privilege('service_role','public.orphaned_setup_files(interval)','execute');   -- expect t
  select file_size_limit from storage.buckets where id = 'setup-files';  -- expect 10485760
  ```

- Configure WAF/CDN limits for uploads, Server Actions, authentication failures, and
  anonymous download-counter traffic. Server-side upload rate limiting does not exist yet
  (the `0021` triggers cover `setups`/`setup_comments`/`setup_requests` inserts only), so
  the edge limit is currently the only thing in front of `uploadSetupFile`.
- Configure malware scanning/quarantine if community uploads are not manually reviewed.
- Replace repository-based privacy contact language with a monitored contact.
- Restrict SQL Editor/service-role access to trusted operators and rotate credentials according to the provider policy.
- Backups/restore and migration rollback policy are **not** documented anywhere yet. Until
  they are, take a `pg_dump` before any destructive step on this page.
