-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Panel, Milestone 2: Business
-- Account Management
-- ============================================================================
-- Adds ONE new table. Does not touch any existing table, column,
-- constraint, index, trigger, or RLS policy — Milestone 1's foundation
-- (admin_role_assignments, businesses.status, audit_logs) and every
-- completed BD Clarity module are unaffected.
--
-- Account status changes (activate/suspend/reactivate) and account change
-- history use Milestone 1's existing businesses.status column and
-- audit_logs table respectively — no new schema needed for either, only
-- new application code (see the Milestone 2 report).
--
-- Run this AFTER 0001-0008, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- business_support_notes — internal, owner-invisible notes an admin
-- attaches to a business account. Never surfaced anywhere in the owner-
-- facing dashboard; the business owner's own RLS policies (businesses_
-- select_own etc.) have no relationship to this table at all, so there is
-- no code path by which an owner could ever read their own notes.
-- ----------------------------------------------------------------------------
create table if not exists public.business_support_notes (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  admin_user_id  uuid references auth.users (id) on delete set null,
  note           text not null,
  created_at     timestamptz not null default now(),

  constraint business_support_notes_length check (length(note) between 1 and 2000)
);

comment on table public.business_support_notes is
  'Internal admin-only notes about a business account. Never exposed to the business owner — no relationship exists to businesses_select_own or any other owner-facing policy. Immutable: no update or delete policy for any role, matching audit_logs.';

create index if not exists business_support_notes_business_id_idx
  on public.business_support_notes (business_id, created_at desc);

alter table public.business_support_notes enable row level security;

-- Read: Super Admin, Operations Admin, and Support Admin per the approved
-- permission matrix (Read-only Analyst cannot manage support notes).
-- Enforced here via get_admin_role(), not just hidden in the UI.
drop policy if exists "business_support_notes_select_authorized" on public.business_support_notes;
create policy "business_support_notes_select_authorized"
  on public.business_support_notes for select
  using (public.get_admin_role() in ('super_admin', 'operations_admin', 'support_admin'));

-- Write: same three tiers, and — same forgery-prevention pattern already
-- used for audit_logs and feedback_question_answers — an admin may only
-- ever attribute a note to themselves.
drop policy if exists "business_support_notes_insert_authorized" on public.business_support_notes;
create policy "business_support_notes_insert_authorized"
  on public.business_support_notes for insert
  with check (
    public.get_admin_role() in ('super_admin', 'operations_admin', 'support_admin')
    and admin_user_id = auth.uid()
  );

-- No update/delete policy for any role — immutable, matching audit_logs.
-- A correction is a new note, never an edit to history.
