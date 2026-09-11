-- Minimal stand-ins for the parts of Supabase's own schema (auth.*,
-- storage.*) that our migrations reference but don't create themselves --
-- on a real Supabase project these already exist; against a vanilla
-- Postgres instance (used here so the migrations can be exercised without a
-- live Supabase project) they need to be faked well enough for our
-- migrations to apply and run cleanly.
--
-- auth.uid() defaults to null (unauthenticated); tests that need a specific
-- caller identity override it with `create or replace function auth.uid()
-- ... select '<uuid>'::uuid`, same as this file already lets them.

create schema if not exists auth;

-- Vanilla Postgres has no Supabase API roles, but the migrations grant to
-- them (`grant ... to authenticated`) -- a bare `postgres:16` image fails
-- on the very first such grant with "role does not exist". Create them the
-- way Supabase's own bootstrap does: nologin roles that exist purely as
-- grant targets.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  -- Real Supabase carries these two on storage.buckets and 0029 writes
  -- file_size_limit, so the stand-in has to have them to be a usable harness.
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  -- Supabase's real storage.objects has created_at/updated_at; 0028's retention
  -- helpers read created_at, so the stand-in has to carry it too.
  created_at timestamptz not null default now()
);
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
