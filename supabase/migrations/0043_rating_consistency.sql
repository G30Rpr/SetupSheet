-- Preserve existing dismissals independently of the download history window.
create table public.rating_prompt_dismissals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  setup_id uuid not null references public.setups (id) on delete cascade,
  primary key (user_id, setup_id)
);

alter table public.rating_prompt_dismissals enable row level security;
revoke all on public.rating_prompt_dismissals from public, anon, authenticated;
grant select, insert on public.rating_prompt_dismissals to authenticated;
create policy "Read own rating prompt dismissals" on public.rating_prompt_dismissals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own rating prompt dismissals" on public.rating_prompt_dismissals
  for insert to authenticated with check ((select auth.uid()) = user_id);

insert into public.rating_prompt_dismissals (user_id, setup_id)
select distinct user_id, setup_id from public.setup_download_events
where prompt_dismissed_at is not null;

-- Capture dismissals from older app instances during deployment.
create function public.record_legacy_rating_prompt_dismissal()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.rating_prompt_dismissals (user_id, setup_id)
  values (new.user_id, new.setup_id)
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.record_legacy_rating_prompt_dismissal() from public;
create trigger record_legacy_rating_prompt_dismissal
after update of prompt_dismissed_at on public.setup_download_events
for each row when (new.prompt_dismissed_at is not null and old.prompt_dismissed_at is null)
execute function public.record_legacy_rating_prompt_dismissal();

-- Reports change rating eligibility when added or removed. Attribution
-- updates do not change eligibility.
create function public.refresh_rating_after_field_test()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  affected_setup uuid := coalesce(new.setup_id, old.setup_id);
  affected_user uuid := coalesce(new.user_id, old.user_id);
begin
  if exists (
    select 1 from public.setup_ratings r
    where r.setup_id = affected_setup and r.user_id = affected_user
  ) then
    perform public.recompute_setup_rating_for(affected_setup);
  end if;
  return null;
end;
$$;
revoke execute on function public.refresh_rating_after_field_test() from public, anon, authenticated;
create trigger refresh_rating_after_field_test
after insert or delete on public.field_test_reports
for each row execute function public.refresh_rating_after_field_test();

select public.recompute_setup_rating_for(affected.setup_id)
from (
  select distinct f.setup_id
  from public.field_test_reports f
  join public.setup_ratings r on r.setup_id = f.setup_id and r.user_id = f.user_id
) affected;
