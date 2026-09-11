# Storage lifecycle & account deletion

Scope: how uploaded files are named, who may delete them, and the two queries an
operator uses when files outlive the rows that pointed at them. Migrations
`0004` (bucket + per-uploader folder policies), `0019` (upload/update extension
check), `0025` (account-deletion requests) and `0028` (orphan/version
enumeration) implement the rules described here.

**Not covered here:** backups/restore and migration rollback policy. Until those
are written down, treat every destructive step below as irreversible and take a
`pg_dump` first.

## How a file becomes public

1. `uploadSetupFile` / `uploadTelemetryFile` (`src/lib/actions/setups.ts`) put the
   object at `{userId}/{uuid}-{safeFileName}` — telemetry:
   `{userId}/telemetry-{uuid}-{safeFileName}` — in the public `setup-files`
   bucket. Upload happens **before** the `setups` row exists, because the row
   stores the path.
2. `createSetup` / `updateSetup` then insert/update the row with `file_path` /
   `telemetry_file_path`. A path is only ever written into a row owned by the same
   user ID (`isOwnedStoragePath` in `src/lib/storage.ts`, enforced by
   `validateAttachment` before any row is written), so one account cannot attach
   another account's object.
3. The bucket's policies (`0004`, tightened by `0019`) let `authenticated`
   insert/update/delete only inside its own folder, and insert/update additionally
   require a known setup/telemetry extension. Anyone can read objects in
   `setup-files`: the bucket is public, which is what makes a shared download link
   work without a session.

Consequence of step 1: a submit that fails after the upload (validation error,
rate limit, crashed request) leaves a publicly fetchable object with no row
referencing it. The form hands those paths to `discardUploadedFiles` (best
effort), and `public.orphaned_setup_files()` is the backstop for anything that
still slips through.

## Deleting an object — the only correct path

Always delete through the Storage API:

```bash
# service_role key; server/operator context only, never in a browser bundle
curl -X DELETE "$SUPABASE_URL/storage/v1/object/setup-files/<path>" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

or the Storage tab in the dashboard.

The app's own cleanup path (`discardUploadedFiles`) does not need the service key:
it deletes through the signed-in user's session, which the owner-scoped delete
policy in `0004` already allows, and `isOwnedStoragePath` narrows the request to
that same folder before it is ever sent. Operator sweeps are different — you are
deleting objects nobody is signed in as — so they use the service-role key.

Do **not** `delete from storage.objects where name = '...'`. The bucket is backed
by object storage; removing only the catalog row leaves the bytes (and their CDN
entries) in place, so the file stays downloadable while looking gone. The
inverse is just as bad: bytes without a catalog row can no longer be found by
any of the queries below.

## Sweeping orphans

`public.orphaned_setup_files(grace interval default '24 hours')` returns every
`setup-files` object that (a) is older than the grace window and (b) is not
referenced by any `setups.file_path`, `setups.telemetry_file_path`,
`setup_versions.file_path` or `setup_versions.telemetry_file_path`.

```sql
select * from public.orphaned_setup_files();          -- then delete each name
select count(*) from public.orphaned_setup_files('7 days');  -- audit first
```

Notes:

- The grace window exists because the row insert may legitimately still be in
  flight. Don't lower it below a few minutes.
- Historical `setup_versions` paths are deliberately **not** garbage: the version
  trail is what moderation and the edit history read. A setup whose current file
  was replaced still has the old object referenced by its history.
- Execute as `service_role`. The function is `security definer` with the exec
  grant revoked from `anon`/`authenticated`, since the object names it lists
  belong to other users.
- Deletion is intentionally not implemented in SQL. Run the list, then delete via
  the Storage API above; re-running the query afterwards should return 0 rows.

## Account deletion

There is deliberately **no self-service delete** in the app: `requestAccountDeletion()`
(`src/lib/actions/account-deletion.ts`) only inserts a row into
`account_deletion_requests`, and the user can cancel it while it is `pending`.
No application code can remove an `auth.users` row, because that needs the
service role, and the service role is not exposed to the deploy (`0025` spells out
this boundary). Completion is a manual operator task.

Work the queue in this order:

```sql
select id, user_id, created_at
from public.account_deletion_requests
where status = 'pending'
order by created_at;

update public.account_deletion_requests
set status = 'processing'
where id = '<request id>';
```

1. Capture `user_id` and, if you want a record of what was removed, the row counts
   for that user (`public.setups`, `public.setup_comments`, `public.setup_ratings`,
   `public.setup_requests`, `public.content_reports`).
2. List their files **before** deleting anything — after the profile row is gone,
   `setup_files_for_user()` still works but there is no name to tie them to:
   `select * from public.setup_files_for_user('<user id>');`
3. Delete the auth user with the service-role admin API (dashboard → Authentication
   → Delete user, or `POST /auth/admin/v1/users/delete` with `{"user_id": "..."}`
   using the service key). `profiles.id` references `auth.users` with
   `on delete cascade`, so that one delete removes the profile and, through it,
   setups (and with them ratings, comments, upvotes, favorites, version
   snapshots, notifications, follows, requests and content reports — every one of
   those FKs is `on delete cascade`).
4. Delete the objects from step 2 through the Storage API (see above). Skipping
   this is the mistake that keeps deleted users' files public.
5. Close the request:

```sql
update public.account_deletion_requests
set status = 'completed', completed_at = now()
where id = '<request id>';
```

A `23505` on the insert in step 1 of the user flow means they already have an
active request; the UI says so instead of creating a duplicate (the partial unique
index in `0025` is what enforces it).

### Verifying a completed deletion

```sql
select exists(select 1 from public.profiles where id = '<user id>');   -- expect f
select * from public.setup_files_for_user('<user id>');                -- expect 0 rows
select count(*) from public.orphaned_setup_files();                    -- should not grow
```

`setup_files_for_user` is the check that SQL row counts alone cannot give you: the
database can be fully clean while their uploads are still being served.

## Cross-checking the app's own rules

`supabase/testing/*.test.sql` (`npm run test:db`) run against this schema with a
`storage.objects` stand-in (`supabase/testing/shim.sql`), including
`zzzzzzz_setup_files_gc.test.sql`, which pins what `orphaned_setup_files()` does
and does not consider garbage. If you change the file-naming convention or the
version-snapshot behavior, update that test alongside this file.
