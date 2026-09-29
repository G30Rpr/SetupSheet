-- Expose only recent, privacy-safe aggregates of validated public changes for
-- Engineer ranking. No report, setup, session, or user identifiers are returned.
begin;

create index field_test_reports_engineer_calibration_idx
  on public.field_test_reports (game, condition, created_at desc)
  where condition in ('Dry', 'Wet');

create view public.engineer_calibration_evidence
with (security_barrier = true)
as
with recent_changes as (
  select
    report.game,
    report.condition,
    change_item.value ->> 'parameter' as parameter,
    change_item.value ->> 'direction' as direction,
    report.setup_id
  from public.field_test_reports_public report
  cross join lateral jsonb_array_elements(report.validated_changes) as change_item(value)
  where report.created_at >= now() - interval '90 days'
    and report.created_at <= now()
    and report.game in ('Assetto Corsa Competizione', 'Le Mans Ultimate')
    and report.condition in ('Dry', 'Wet')
    and jsonb_typeof(change_item.value) = 'object'
    and jsonb_typeof(change_item.value -> 'parameter') = 'string'
    and char_length(change_item.value ->> 'parameter') between 1 and 120
    and change_item.value ->> 'parameter' = btrim(change_item.value ->> 'parameter')
    and jsonb_typeof(change_item.value -> 'direction') = 'string'
    and (change_item.value ->> 'direction') in ('increase', 'decrease', 'soften', 'stiffen')
    and jsonb_typeof(change_item.value -> 'amount') = 'string'
    and char_length(btrim(change_item.value ->> 'amount')) between 1 and 100
), distinct_samples as (
  select distinct game, condition, parameter, direction, setup_id
  from recent_changes
), direction_counts as (
  select
    game,
    condition,
    parameter,
    direction,
    count(*)::integer as supporting_setup_count
  from distinct_samples
  group by game, condition, parameter, direction
), direction_sets as (
  select
    game,
    condition,
    parameter,
    array_agg(direction order by direction) as directions
  from direction_counts
  group by game, condition, parameter
)
select
  counts.game,
  counts.condition,
  counts.parameter,
  counts.direction,
  counts.supporting_setup_count,
  sets.directions
from direction_counts counts
join direction_sets sets
  using (game, condition, parameter);

revoke all on public.engineer_calibration_evidence from public;
grant select on public.engineer_calibration_evidence to anon, authenticated;

commit;
