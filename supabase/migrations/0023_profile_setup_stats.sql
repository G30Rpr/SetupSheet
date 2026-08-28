-- Extend the public leaderboard aggregate with the total number of ratings
-- so profile pages can render accurate totals without transferring every
-- setup row just to reduce it in React.

create or replace view public.leaderboard
with (security_invoker = true)
as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  count(s.id)::int as setup_count,
  coalesce(sum(s.upvotes), 0)::int as total_upvotes,
  coalesce(sum(s.rating_count), 0)::int as total_ratings
from public.profiles p
left join public.setups s on s.user_id = p.id
group by p.id, p.username, p.avatar_url;
