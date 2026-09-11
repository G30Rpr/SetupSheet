-- Cap the size of anything landing in the public `setup-files` bucket.
--
-- The 5 MB (setup) / 10 MB (telemetry) limits live in the Server Actions
-- (src/lib/actions/setups.ts), but a caller with a valid session can skip the
-- actions entirely and POST straight to the Storage REST API, where the only
-- constraints were the 0004/0019 folder + filename-extension policies -- so a
-- direct upload could reach the project-wide default of 50 MB. Storage enforces
-- this column itself, which makes it the boundary rather than the app code.
--
-- Deliberately no `allowed_mime_types` here: Supabase compares it against the
-- Content-Type the client sent, and browser-supplied types for simulator setup
-- files (.sto, .json, .ini, .csv, ...) are inconsistent enough -- often
-- application/octet-stream or empty -- that a mime allow-list would reject
-- legitimate uploads without adding much that the extension policy and the
-- content/signature check in src/lib/file-validation.ts do not already cover.

update storage.buckets
set file_size_limit = 10485760 -- 10 MiB, the largest file this app accepts
where id = 'setup-files'
  and file_size_limit is distinct from 10485760;
