-- ============================================================================
-- BD Clarity (by Banao Digital) — Customer Experience Action Engine,
-- Milestone 2: 3-state lifecycle
-- ============================================================================
-- Extends the EXISTING business_action_status table (0004) with one
-- additive CHECK constraint change — no new table, no new column. Does not
-- touch any other table, RLS policy, or trigger. 0004 itself is not
-- edited.
--
-- Adds exactly one new allowed status value, 'in_progress', between the
-- existing 'open' and 'done'. Every row written before this migration
-- (status 'open' or 'done') remains valid and untouched — this is a
-- widening of the constraint, not a data migration.
--
-- Run this AFTER 0001-0011, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

alter table public.business_action_status
  drop constraint if exists business_action_status_status_check;

alter table public.business_action_status
  add constraint business_action_status_status_check
  check (status in ('open', 'in_progress', 'done'));

comment on column public.business_action_status.status is
  'open -> in_progress -> done. Widened from a 2-state (open/done) to a 3-state lifecycle in Action Engine Milestone 2 — existing open/done rows are unaffected by this change.';
