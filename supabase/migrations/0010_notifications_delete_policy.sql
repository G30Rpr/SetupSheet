-- Notifications had no delete policy at all, so a user had no way to
-- prune their own read notifications and the table would otherwise grow
-- unbounded forever. Lets a user delete their own rows (used by the new
-- "Clear read" action), same row-scoping as the existing select/update
-- policies.

create policy "Users can delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);
