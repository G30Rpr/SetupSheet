-- 0037: store the rater's rig with each rating (P2 item 3).
--
-- The detail page splits scores into "On a similar rig" vs "Everyone else",
-- and Best match can prefer similar-rig evidence. Both need to know which
-- rig a rating came from.
--
-- Privacy: setup_ratings select RLS is own-rows-only (0003), so this column
-- is never readable per-row by anyone but its author. The only cross-user
-- access is the aggregate RPC below: sums and counts per rig bucket, never
-- user ids. A null rater_rig ("rig not shared") simply counts in the
-- "Everyone else" bucket.
--
-- Additive only: nullable column, no rewrite of existing rows (they stay
-- null), aggregates on setups are unchanged (the split is computed at read
-- time from rows, still excluding author self-ratings per 0036).

alter table public.setup_ratings add column rater_rig text null;

alter table public.setup_ratings
  add constraint setup_ratings_rater_rig_check
  check (
    rater_rig is null
    or rater_rig in (
      'Gamepad',
      'Wheel + 3 Pedals',
      'Wheel + Handbrake',
      'Direct Drive + Load Cell'
    )
  );

comment on column public.setup_ratings.rater_rig is
  'Rig profile the rater was on when rating; null = not shared. Aggregated only — never exposed per-row to other users.';

-- Splits for a batch of setups in one round trip (browse sorts and the
-- detail split both use this). SECURITY DEFINER because setup_ratings is
-- deliberately not readable across users; the function exposes sums and
-- counts grouped by rig bucket, and excludes author self-ratings so the
-- numbers match the recompute_setup_rating_for() aggregates.
create or replace function public.get_setup_rating_splits(p_setup_ids uuid[])
returns table (
  setup_id uuid,
  rater_rig text,
  pace_sum bigint,
  pace_n bigint,
  pred_sum bigint,
  pred_n bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.setup_id,
    r.rater_rig,
    sum(r.pace)::bigint as pace_sum,
    count(r.pace)::bigint as pace_n,
    sum(r.predictability)::bigint as pred_sum,
    count(r.predictability)::bigint as pred_n
  from public.setup_ratings r
  join public.setups s on s.id = r.setup_id
  where r.setup_id = any (p_setup_ids)
    and r.user_id <> s.user_id
  group by r.setup_id, r.rater_rig;
$$;

revoke execute on function public.get_setup_rating_splits(uuid[]) from public;
grant execute on function public.get_setup_rating_splits(uuid[]) to anon, authenticated;
