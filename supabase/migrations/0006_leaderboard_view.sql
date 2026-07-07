-- Leaderboard: per-user aggregate of setup count + total upvotes, for the
-- Top Contributors page and per-user contributor badges. security_invoker
-- so the view runs as the querying role rather than its owner -- both
-- underlying tables are already "viewable by everyone", so this just keeps
-- the view honest about whose privileges it runs under.
create view public.leaderboard
with (security_invoker = true)
as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  count(s.id)::int as setup_count,
  coalesce(sum(s.upvotes), 0)::int as total_upvotes
from public.profiles p
left join public.setups s on s.user_id = p.id
group by p.id, p.username, p.avatar_url;
