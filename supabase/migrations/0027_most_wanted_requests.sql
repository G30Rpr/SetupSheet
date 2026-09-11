-- Aggregate the "Most wanted" board in Postgres instead of in React.
--
-- The original reader fetched the *oldest* 500 open requests
-- (`order created_at asc` + `limit 500`) and grouped them in JavaScript, which
-- meant the demand signal froze permanently the moment the board held more than
-- 500 open rows: every newer request was outside the window it read, so
-- "requests per (game, car, track)" stopped counting real demand while the list
-- below it kept growing.
--
-- A view fixes both halves: the window is explicit (rolling 90 days, matching
-- how a request that nobody has answered for three months is stale rather than
-- in-demand), and the ranking/sorting happens where the rows already are, so the
-- app only ever transfers the handful of summary rows it renders.
--
-- security_invoker keeps both underlying RLS policies in force for anon and
-- authenticated callers (same pattern as 0006_leaderboard_view.sql and
-- 0024_setup_search_view.sql); the view exposes aggregates only, never request
-- bodies or requester ids.

create or replace view public.setup_requests_most_wanted
with (security_invoker = true)
as
select
  r.game,
  r.car,
  r.track,
  count(*)::int as request_count,
  min(r.created_at) as oldest_request_at,
  max(r.created_at) as newest_request_at
from public.setup_requests as r
where r.fulfilled_setup_id is null
  and r.created_at >= now() - interval '90 days'
group by r.game, r.car, r.track;

-- Explicit grants, matching 0024: the API roles need SELECT on the view itself,
-- independent of any default-privilege configuration on the project.
grant select on public.setup_requests_most_wanted to anon, authenticated;
revoke all on public.setup_requests_most_wanted from public;

-- No new index: 0013 already ships `setup_requests_open_idx` (created_at desc,
-- partial on fulfilled_setup_id is null) for the window and
-- `setup_requests_game_car_track_idx` (game, car, track, same predicate) for the
-- grouping, and both match the view's filter exactly. A wider composite index
-- would mostly add write cost to a table that every request insert touches.
