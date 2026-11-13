-- 0047_privileged_sql_least_privilege.sql
-- SS-AUD-004: internal trigger and aggregate helpers should not be directly
-- callable as elevated RPCs. Only explicitly intentional public API functions
-- retain EXECUTE. No public read/insert/update/delete grants are changed.

revoke execute on function public.enforce_comment_rate_limit()
  from PUBLIC, anon, authenticated;
revoke execute on function public.enforce_request_rate_limit()
  from PUBLIC, anon, authenticated;
revoke execute on function public.enforce_setup_creation_rate_limit()
  from PUBLIC, anon, authenticated;
revoke execute on function public.handle_setup_request_reopen()
  from PUBLIC, anon, authenticated;
revoke execute on function public.notify_setup_owner_of_field_test()
  from PUBLIC, anon, authenticated;
revoke execute on function public.prevent_self_rating()
  from PUBLIC, anon, authenticated;
revoke execute on function public.rating_weight(uuid,uuid)
  from PUBLIC, anon, authenticated;
revoke execute on function public.recompute_setup_rating_for(uuid)
  from PUBLIC, anon, authenticated;

-- RLS does not protect TRUNCATE. API roles do not need to create triggers or
-- foreign-key relationships either; remove these table-level privileges.
revoke TRUNCATE, TRIGGER, REFERENCES
  on all tables in schema public
  from PUBLIC, anon, authenticated;

-- Keep the saved-rig timestamp trigger non-definer; its only function call
-- is built-in now(), which exists in pg_catalog.
alter function public.touch_saved_rig_profile()
  set search_path = pg_catalog;
revoke execute on function public.touch_saved_rig_profile()
  from PUBLIC, anon, authenticated;

-- Intentional public aggregate read: get_setup_rating_splits(uuid[]) remains
-- callable by anon/authenticated and returns aggregated public ratings only.
-- Intentional authenticated operations (e.g. fulfill_setup_request,
-- create_field_test_report) remain callable by the approved user roles.
