-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 1: Foundation schema
-- ============================================================================
-- Creates: profiles, businesses
-- Enables: Row Level Security with owner-scoped policies
-- Adds:    updated_at triggers + auto-create-profile-on-signup trigger
--
-- Run this in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles
-- One row per authenticated user. Created automatically on signup.
-- ----------------------------------------------------------------------------
create type public.profile_role as enum ('business_owner', 'admin');

create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  full_name   text,
  email       text not null,
  phone       text,
  role        public.profile_role not null default 'business_owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated user. role drives access to /admin (must be checked server-side, never trusted from the client).';

-- ----------------------------------------------------------------------------
-- businesses
-- A business account owned by a profile/user. A business can later connect
-- to QR codes, feedback, reviews, analytics, and subscriptions (Modules 2-6).
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  business_name      text not null,
  category           text,
  phone              text,
  email              text,
  address            text,
  city               text,
  website            text,
  google_review_url  text,
  logo_url           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.businesses is
  'A business account owned by a single user (owner_id). Future module tables (QR codes, feedback, reviews, analytics, subscriptions) should reference businesses.id.';

create index if not exists businesses_owner_id_idx on public.businesses (owner_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth.users row is created.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;

-- profiles: a user may only read/update their own profile row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profiles are inserted only by the handle_new_user trigger (security
-- definer), so no public insert policy is needed. Deliberately no delete
-- policy — deleting a user should go through auth admin, not direct SQL.

-- businesses: an owner may fully manage only businesses they own. No public
-- (anon/unauthenticated) access is granted at all.
drop policy if exists "businesses_select_own" on public.businesses;
create policy "businesses_select_own"
  on public.businesses for select
  using (auth.uid() = owner_id);

drop policy if exists "businesses_insert_own" on public.businesses;
create policy "businesses_insert_own"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "businesses_update_own" on public.businesses;
create policy "businesses_update_own"
  on public.businesses for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "businesses_delete_own" on public.businesses;
create policy "businesses_delete_own"
  on public.businesses for delete
  using (auth.uid() = owner_id);

-- Admins get read access across all businesses/profiles for the future admin
-- area (Module 1 only builds the shell; this policy just makes the data
-- layer ready for it). Role is read from the caller's own profile row, so
-- this cannot be spoofed by client-supplied input.
--
-- IMPORTANT: this check must go through a SECURITY DEFINER helper function,
-- not an inline subquery on profiles. An inline `exists (select 1 from
-- public.profiles ...)` inside a policy ON profiles itself causes Postgres
-- to re-evaluate profiles' own RLS while evaluating that same policy —
-- "infinite recursion detected in policy for relation profiles" — which
-- was verified against a real Postgres 16 instance while hardening this
-- migration. The function below runs with the privileges of its owner
-- (bypassing RLS on the table it owns), which breaks the recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where user_id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True if the calling user''s own profile has role = admin. SECURITY DEFINER so it can read profiles without re-triggering profiles'' own RLS policies (which would otherwise recurse). Always reads the caller''s own row via auth.uid() — never client-supplied input.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "businesses_select_admin" on public.businesses;
create policy "businesses_select_admin"
  on public.businesses for select
  using (public.is_admin());
