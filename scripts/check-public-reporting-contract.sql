-- Read-only public API compatibility probe for an authorized operator.
-- Run using a PostgreSQL connection whose role can SET ROLE anon.
-- No user records or counts are returned. Missing grants fail ON_ERROR_STOP.
-- This is a deploy gate, not a migration; never add to supabase/migrations.
begin read only;
set local role anon;
select 1 from public.field_test_reports_public limit 0;
select 1 from public.field_test_counts limit 0;
select 1 from public.leaderboard limit 0;
rollback;
