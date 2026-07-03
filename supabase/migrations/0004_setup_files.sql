-- Wires up the file storage that setups.file_path was reserved for back in
-- migration 0001. The bytes live in Supabase Storage, not the database;
-- setups.file_path/file_name just mirror the Storage object so the app can
-- link to it and show its original name.

alter table public.setups add column file_name text;

-- ============================================================================
-- Storage bucket + RLS
-- One folder per uploader (auth.uid()), enforced the same way public.setups
-- rows are scoped by user_id. storage.foldername/objects/buckets and RLS on
-- storage.objects already exist as part of every Supabase project's Storage
-- schema -- this only adds the bucket and this project's own policies.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('setup-files', 'setup-files', true)
on conflict (id) do nothing;

create policy "Setup files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'setup-files');

create policy "Users can upload setup files to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own setup files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own setup files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Download counter
-- security definer so an anonymous visitor can bump the count without
-- needing write access to public.setups (setups are publicly downloadable,
-- not just publicly viewable).
-- ============================================================================

create function public.increment_downloads(setup_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.setups set downloads = downloads + 1 where id = setup_id;
$$;
