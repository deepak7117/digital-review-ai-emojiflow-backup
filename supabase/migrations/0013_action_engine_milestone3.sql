-- ============================================================================
-- BD Clarity (by Banao Digital) — Customer Experience Action Engine,
-- Milestone 3: Measurement / baseline comparison
-- ============================================================================
-- Adds ONE new table. Does not touch any existing table, column,
-- constraint, or RLS policy — business_action_status (0004, widened in
-- 0012) and every other completed table are unaffected.
--
-- Captures a real, server-computed evidence count the FIRST time an owner
-- moves an action out of "open" (see setActionStatus() in
-- src/app/dashboard/intelligence/actions.ts for exactly when/how this is
-- written) — never a client-supplied number, and never overwritten once
-- set, so the original starting point for an action is preserved even if
-- the owner reopens and restarts work on it later.
--
-- Run this AFTER 0001-0012, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.action_baseline_snapshots (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  action_key        text not null,
  baseline_count    integer not null,
  evidence_label    text not null,
  captured_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),

  constraint action_baseline_snapshots_unique unique (business_id, action_key),
  constraint action_baseline_snapshots_count_check check (baseline_count >= 0)
);

comment on table public.action_baseline_snapshots is
  'One row per action_key per business, written once — the first time that action moves out of "open" (see setActionStatus()). baseline_count is always a real, server-recomputed evidence count at that moment, never client-supplied. Never overwritten by a later transition, by design: it stays the original measurement point for this action.';

create index if not exists action_baseline_snapshots_business_id_idx
  on public.action_baseline_snapshots (business_id);

alter table public.action_baseline_snapshots enable row level security;

-- Owner: full access to their OWN business's baselines — same pattern
-- already used for business_action_status and every other owner-scoped
-- table in this project.
drop policy if exists "action_baseline_snapshots_all_own" on public.action_baseline_snapshots;
create policy "action_baseline_snapshots_all_own"
  on public.action_baseline_snapshots for all
  using (
    exists (select 1 from public.businesses b where b.id = action_baseline_snapshots.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = action_baseline_snapshots.business_id and b.owner_id = auth.uid())
  );

-- Admin: read-only, same "_select_admin" pattern already used elsewhere.
drop policy if exists "action_baseline_snapshots_select_admin" on public.action_baseline_snapshots;
create policy "action_baseline_snapshots_select_admin"
  on public.action_baseline_snapshots for select
  using (public.is_admin());

-- No anon/public policy of any kind.
