-- ============================================================================
-- BD Clarity (by Banao Digital) — Subscription / Owner Entitlement
-- ============================================================================
-- One new table, keyed directly by owner_id -> auth.users(id) (no new
-- identity system — auth.users remains the sole source of truth, per
-- the approved architecture). Zero changes to businesses, platform_settings,
-- or any existing RLS policy.
--
-- ARCHITECTURAL DECISION (flagged explicitly, per the approval's
-- instruction to explain any adjustment needed): an owner with NO row in
-- this table is not an error state — it means "not yet individually
-- configured by Super Admin," and such an owner falls back to exactly
-- today's behavior (the global platform_settings ceiling, nothing
-- stricter). This is what keeps every existing owner (including the one
-- already at 4 businesses from the prior Multi-Store milestone) working
-- unchanged the moment this migration runs — nobody is retroactively
-- locked out. Only once Super Admin explicitly sets a row for a specific
-- owner does a per-owner limit take effect, and even then it can only
-- ever be as permissive as the platform ceiling:
--   effective_limit = min(owner_entitlements.max_businesses, platform_settings.max_businesses_per_owner)
-- enforced in application code (createBusiness()), not in SQL here,
-- since it depends on two separate tables.
--
-- Run this AFTER 0001-0018, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.owner_entitlements (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null unique references auth.users (id) on delete cascade,

  subscription_status      text not null default 'active',
  plan_duration             text,
  start_date               date,
  expiry_date              date,
  payment_id               text,

  multi_business_enabled   boolean not null default true,
  max_businesses           integer not null default 4,

  multi_branch_enabled     boolean not null default false,
  max_branches             integer not null default 1,

  admin_notes              text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint owner_entitlements_status_check
    check (subscription_status in ('active', 'expired', 'suspended', 'disabled')),
  constraint owner_entitlements_duration_check
    check (plan_duration is null or plan_duration in ('1_year', '2_years', '3_years')),
  constraint owner_entitlements_max_businesses_check
    check (max_businesses between 1 and 4),
  constraint owner_entitlements_max_branches_check
    check (max_branches >= 1)
);

comment on table public.owner_entitlements is
  'Per-owner subscription/entitlement, set by Super Admin. Absence of a row for an owner means "not yet configured" and falls back to platform_settings'' global defaults, not a lockout. The effective business limit is always min(this.max_businesses, platform_settings.max_businesses_per_owner) — enforced in createBusiness(), never exceeding the platform safety ceiling regardless of what an individual row says.';

create index if not exists owner_entitlements_owner_id_idx on public.owner_entitlements (owner_id);

drop trigger if exists set_owner_entitlements_updated_at on public.owner_entitlements;
create trigger set_owner_entitlements_updated_at
  before update on public.owner_entitlements
  for each row execute procedure public.set_updated_at();

alter table public.owner_entitlements enable row level security;

-- Owner can READ their own entitlement (so a future dashboard surface
-- can show "2 of 4 businesses used" truthfully) but can NEVER write to
-- it — explicit requirement 1.6. Only super_admin may write.
drop policy if exists "owner_entitlements_select_own" on public.owner_entitlements;
create policy "owner_entitlements_select_own"
  on public.owner_entitlements for select
  using (auth.uid() = owner_id);

drop policy if exists "owner_entitlements_select_admin" on public.owner_entitlements;
create policy "owner_entitlements_select_admin"
  on public.owner_entitlements for select
  using (public.is_admin());

drop policy if exists "owner_entitlements_write_super_admin" on public.owner_entitlements;
create policy "owner_entitlements_write_super_admin"
  on public.owner_entitlements for all
  using (public.get_admin_role() = 'super_admin')
  with check (public.get_admin_role() = 'super_admin');

-- No anon policy — never customer-facing.
