-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Panel, Milestone 1: Foundation
-- ============================================================================
-- Adds THREE new objects plus one additive column. Does NOT touch any
-- existing table, column, constraint, index, trigger, RLS policy, or the
-- existing binary profiles.role / is_admin() mechanism that 9 tables
-- already depend on — every completed BD Clarity module is unaffected.
--
-- Design: profiles.role = 'admin' remains the coarse platform gate
-- (unchanged). admin_role_assignments is a NEW, separate fine-grained tier
-- on top of it — a user needs BOTH to use the admin panel's tiered
-- features. This keeps every existing "_select_admin" RLS policy (which
-- reads only is_admin()) working exactly as before.
--
-- Run this AFTER 0001-0007, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_role_assignments
-- One row per admin user, holding their CURRENT tier. Role CHANGE HISTORY
-- lives in audit_logs (below), not here — this table is deliberately just
-- current state, kept simple and fast for get_admin_role() to read on
-- every admin-panel request.
-- ----------------------------------------------------------------------------
create type public.admin_role as enum (
  'super_admin',
  'support_admin',
  'operations_admin',
  'read_only_analyst'
);

create table if not exists public.admin_role_assignments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  admin_role   public.admin_role not null,
  granted_by   uuid references auth.users (id) on delete set null,
  granted_at   timestamptz not null default now(),
  -- Soft-revoke, never deleted: revoking access is a status change, not an
  -- erasure. A revoked user's admin_role_assignments row stays as a
  -- historical record; get_admin_role() below only honors rows where this
  -- is null.
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.admin_role_assignments is
  'Current admin tier per user (at most one active row per user_id). Historical changes are recorded in audit_logs, not here. Bootstrapping the first Super Admin requires a one-time manual insert — see the Milestone 1 report for the exact statement, since no admin exists yet to grant it through the app.';

drop trigger if exists set_admin_role_assignments_updated_at on public.admin_role_assignments;
create trigger set_admin_role_assignments_updated_at
  before update on public.admin_role_assignments
  for each row execute procedure public.set_updated_at();

-- Self-escalation guard: no user — not even a Super Admin — may create or
-- modify their OWN admin_role_assignments row. Granting/changing/revoking
-- access always requires a DIFFERENT admin to act on your behalf.
create or replace function public.prevent_admin_self_assignment()
returns trigger
language plpgsql
as $$
begin
  if new.user_id = auth.uid() then
    raise exception 'You cannot grant, change, or revoke your own admin role assignment.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_admin_self_assignment_trigger on public.admin_role_assignments;
create trigger prevent_admin_self_assignment_trigger
  before insert or update on public.admin_role_assignments
  for each row execute procedure public.prevent_admin_self_assignment();

-- get_admin_role(): the tiered analogue of is_admin() (0001_init.sql) —
-- same SECURITY DEFINER, same-recursion-safe pattern, always reads only
-- the caller's own row via auth.uid(), never client-supplied input.
create or replace function public.get_admin_role()
returns public.admin_role
language sql
security definer
stable
set search_path = public
as $$
  select admin_role
  from public.admin_role_assignments
  where user_id = auth.uid() and revoked_at is null;
$$;

comment on function public.get_admin_role() is
  'The calling user''s current active admin tier, or null if they have none (including if they were revoked, or if they are not an admin at all). SECURITY DEFINER for the same reason as is_admin(): reading admin_role_assignments here must not re-trigger that table''s own RLS.';

revoke all on function public.get_admin_role() from public;
grant execute on function public.get_admin_role() to anon, authenticated;

alter table public.admin_role_assignments enable row level security;

-- Any admin (any tier) may see who else is an admin and at what tier —
-- read-only for everyone except Super Admin, enforced below for writes.
drop policy if exists "admin_role_assignments_select_admin" on public.admin_role_assignments;
create policy "admin_role_assignments_select_admin"
  on public.admin_role_assignments for select
  using (public.is_admin());

-- Only a Super Admin may grant, change, or revoke a role — and per the
-- trigger above, never their own.
drop policy if exists "admin_role_assignments_write_super_admin" on public.admin_role_assignments;
create policy "admin_role_assignments_write_super_admin"
  on public.admin_role_assignments for insert
  with check (public.get_admin_role() = 'super_admin');

drop policy if exists "admin_role_assignments_update_super_admin" on public.admin_role_assignments;
create policy "admin_role_assignments_update_super_admin"
  on public.admin_role_assignments for update
  using (public.get_admin_role() = 'super_admin')
  with check (public.get_admin_role() = 'super_admin');

-- Deliberately no delete policy for anyone — revocation is a soft-delete
-- via revoked_at, preserving history. Matches the immutability discipline
-- already used for feedback_submissions and audit_logs below.

-- ----------------------------------------------------------------------------
-- businesses.status — additive column, default 'active' so every existing
-- business keeps working identically. Milestone 1 only adds and reads this
-- column; the activate/suspend/reactivate ACTION is Milestone 2 scope.
-- ----------------------------------------------------------------------------
create type public.business_status as enum ('active', 'inactive', 'suspended');

alter table public.businesses
  add column if not exists status public.business_status not null default 'active';

comment on column public.businesses.status is
  'Platform-level account status, managed by admins (Milestone 2). Distinct from feedback_links.is_active, which is the owner-facing "is my QR page live" toggle — a business can be status=active with its QR paused, or vice versa.';

-- No RLS change needed: existing businesses_select_own / _update_own /
-- _select_admin policies already cover this new column, since RLS is
-- row-level, not column-level.

-- ----------------------------------------------------------------------------
-- audit_logs — insert-only, immutable, same discipline as
-- feedback_submissions: no update or delete policy exists for ANY role,
-- including admins. A logging mistake is corrected with a new, separate
-- row (e.g. result='correction'), never by editing history.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid references auth.users (id) on delete set null,
  action         text not null,
  target_type    text,
  target_id      uuid,
  reason         text,
  result         text not null default 'success',
  metadata       jsonb,
  created_at     timestamptz not null default now(),

  constraint audit_logs_result_check check (result in ('success', 'failure'))
);

comment on table public.audit_logs is
  'Immutable record of every sensitive admin action. No update or delete policy exists for any role, including Super Admin — this table can only grow.';

create index if not exists audit_logs_admin_user_id_idx on public.audit_logs (admin_user_id, created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.is_admin());

-- An admin may only ever insert a log row attributed to THEMSELVES — never
-- forge another admin's id — and only while they are genuinely an admin.
drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own"
  on public.audit_logs for insert
  with check (public.is_admin() and admin_user_id = auth.uid());

-- No update/delete policy for any role — enforced by omission, matching
-- the same pattern already used for feedback_submissions.
