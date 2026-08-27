-- Keep direct Storage API callers from uploading active content types or
-- unrelated binaries to the public setup-files bucket. The Server Actions
-- perform the same extension checks, but Storage policies are the real
-- boundary when a client talks to Supabase directly.

drop policy if exists "Users can upload setup files to their own folder" on storage.objects;
create policy "Users can upload setup files to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '.*\.(sto|json|ini|svm|sav|txt|xml|csv|ld|ldx|ibt|vbo|drf|zip|zvp|telemetry)$'
  );

drop policy if exists "Users can update their own setup files" on storage.objects;
create policy "Users can update their own setup files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '.*\.(sto|json|ini|svm|sav|txt|xml|csv|ld|ldx|ibt|vbo|drf|zip|zvp|telemetry)$'
  )
  with check (
    bucket_id = 'setup-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '.*\.(sto|json|ini|svm|sav|txt|xml|csv|ld|ldx|ibt|vbo|drf|zip|zvp|telemetry)$'
  );
