-- Same class of gap as 0009's fix for setups/profiles, in a table that
-- one missed: "Users can mark their own notifications read" restricts
-- WHICH ROW a user can update (auth.uid() = user_id) but says nothing
-- about WHICH COLUMN, so a user could update actor_id/setup_id/type on
-- their own notification rows, not just read. Lower stakes than the
-- setups/profiles gap (only affects their own notification feed, not a
-- public trust signal), but it's the same bug, closed the same way.

revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
