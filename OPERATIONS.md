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

- Apply migrations `0023` through `0026` after `0022`.
- Confirm the `leaderboard` view exposes `total_ratings` and `setup_search` exposes `author_username`.
- Configure WAF/CDN limits for uploads, Server Actions, authentication failures, and anonymous download-counter traffic.
- Configure malware scanning/quarantine if community uploads are not manually reviewed.
- Replace repository-based privacy contact language with a monitored contact.
- Restrict SQL Editor/service-role access to trusted operators and rotate credentials according to the provider policy.
