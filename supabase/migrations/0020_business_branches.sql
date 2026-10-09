-- ============================================================================
-- BD Clarity (by Banao Digital) — Phase 3: Real Multi-Branch System
-- ============================================================================
-- The first real branch entity in this project. Confirmed during
-- inspection that no such table existed before this — the only prior
-- "branch" reference, google_business_connections.branch_label, is a
-- plain text label for a Google connection and remains completely
-- unrelated to this table.
--
-- Hierarchy: Owner -> Business -> Branch (business_id is the only
-- required link; a branch is never a business in its own right and is
-- never touched by the existing Multi-Business entitlement/limit).
--
-- owner_id is INCLUDED here (not strictly required by the hierarchy
-- alone, since business_id -> businesses.owner_id already establishes
-- ownership) because it materially simplifies and speeds up RLS: every
-- policy below is a direct auth.uid() = owner_id check rather than a
-- subquery join through businesses for every row, the same tradeoff
-- already made for google_business_connections and google_reviews in
-- earlier milestones. It is NOT a second source of truth — set once at
-- creation, from the authenticated session, and never independently
-- editable.
--
-- Zero changes to businesses, owner_entitlements, platform_settings, or
-- any existing RLS policy. This migration only adds a new table.
--
-- Run this AFTER 0001-0019, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.business_branches (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  owner_id       uuid not null references auth.users (id) on delete cascade,
  branch_name    text not null,
  address        text,
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint business_branches_status_check check (status in ('active', 'inactive')),
  constraint business_branches_name_not_blank check (length(trim(branch_name)) > 0)
);

comment on table public.business_branches is
  'Real branch entity: Owner -> Business -> Branch. A branch is NOT a business and is never counted against the Multi-Business entitlement/limit. "Maximum Branches" (owner_entitlements.max_branches) is the total ACTIVE branches across ALL of this owner''s businesses combined, not per-business — enforced in createBranch(), preventing an owner from bypassing the limit by spreading branches across several businesses. No separate platform-level branch ceiling was introduced in this phase — none was requested, and inventing one silently would contradict the explicit instruction not to add a global limit without cause; owner_entitlements.max_branches is the only cap today.';

create index if not exists business_branches_business_id_idx on public.business_branches (business_id);
create index if not exists business_branches_owner_id_idx on public.business_branches (owner_id, status);

drop trigger if exists set_business_branches_updated_at on public.business_branches;
create trigger set_business_branches_updated_at
  before update on public.business_branches
  for each row execute procedure public.set_updated_at();

alter table public.business_branches enable row level security;

drop policy if exists "business_branches_select_own" on public.business_branches;
create policy "business_branches_select_own"
  on public.business_branches for select
  using (auth.uid() = owner_id);

drop policy if exists "business_branches_insert_own" on public.business_branches;
create policy "business_branches_insert_own"
  on public.business_branches for insert
  with check (auth.uid() = owner_id);

drop policy if exists "business_branches_update_own" on public.business_branches;
create policy "business_branches_update_own"
  on public.business_branches for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "business_branches_select_admin" on public.business_branches;
create policy "business_branches_select_admin"
  on public.business_branches for select
  using (public.is_admin());

-- No anon policy, no delete policy (deactivate via status, per 3C — "do
-- not build archival complexity yet" means no hard-delete path at all
-- for this phase, keeping the historical record always intact by
-- construction, not just by convention).
