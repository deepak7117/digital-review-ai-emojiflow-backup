-- ============================================================================
-- BD Clarity (by Banao Digital) — Multi-Store / Multi-Business Management
-- ============================================================================
-- One new, minimal table. Zero changes to businesses, its RLS, or any
-- other existing migration — businesses.owner_id already has no unique
-- constraint and already supports multiple rows per owner; RLS already
-- scopes via auth.uid() = owner_id, which is already plural-safe.
--
-- Single-row design (not a generic key-value settings store): this
-- project has no existing settings-table precedent, and a single row
-- with typed columns is simpler to query and validate than inventing a
-- generic KV pattern for just two values.
--
-- Run this AFTER 0001-0017, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.platform_settings (
  id                         boolean primary key default true,
  multistore_enabled         boolean not null default true,
  max_businesses_per_owner   integer not null default 4,
  updated_at                 timestamptz not null default now(),

  -- Enforces exactly one row ever existing (id is always `true`) and
  -- keeps the configurable max within the approved 1-4 range for this
  -- phase, server-side — not just a UI restriction.
  constraint platform_settings_singleton check (id = true),
  constraint platform_settings_max_range check (max_businesses_per_owner between 1 and 4)
);

comment on table public.platform_settings is
  'Single-row platform-wide configuration. Currently holds only the Multi-Store Management toggle and limit. Not a generic settings store — add typed columns here only when a new platform-wide (not per-business) setting is genuinely needed.';

insert into public.platform_settings (id, multistore_enabled, max_businesses_per_owner)
values (true, true, 4)
on conflict (id) do nothing;

drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute procedure public.set_updated_at();

alter table public.platform_settings enable row level security;

-- Every authenticated user (any owner) needs to read this to know
-- whether the switcher/Add Business UI should even appear.
drop policy if exists "platform_settings_select_authenticated" on public.platform_settings;
create policy "platform_settings_select_authenticated"
  on public.platform_settings for select
  using (auth.uid() is not null);

-- Only Super Admin may change it — reuses the existing is_admin()/
-- get_admin_role() helpers, no new permission system.
drop policy if exists "platform_settings_update_super_admin" on public.platform_settings;
create policy "platform_settings_update_super_admin"
  on public.platform_settings for update
  using (public.get_admin_role() = 'super_admin')
  with check (public.get_admin_role() = 'super_admin');

-- No anon policy — this is never customer-facing.
