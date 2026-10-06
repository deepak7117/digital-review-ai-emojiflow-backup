-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 7 Milestone E: owner-
-- configurable customer context questions
-- ============================================================================
-- Adds ONE new table. Does NOT touch any existing table, column,
-- constraint, index, trigger, or RLS policy — Modules 1-6 and Module 7
-- Milestones A-D are unaffected.
--
-- Product rule: a business may have AT MOST 2 ACTIVE questions at a time.
-- Only the business owner can create/edit/delete/reorder/activate them.
-- Customers can only read active questions (via a narrow anon SELECT
-- policy) and answer them — there is no code path anywhere that lets a
-- non-owner write to this table.
--
-- Defaults are seeded from the segment registry
-- (src/lib/segments/registry.ts) at the APPLICATION layer the first time a
-- business's questions are listed — the registry remains the single
-- source of default text; this table only ever stores a business's own
-- (possibly customized) copy, never a second parallel catalog.
--
-- Run this AFTER 0001-0005, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.business_context_questions (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  question_text  text not null,
  options        text[] not null,
  sort_order     smallint not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint business_context_questions_text_length check (length(question_text) between 1 and 200),
  constraint business_context_questions_options_count check (cardinality(options) between 2 and 4),
  constraint business_context_questions_options_length check (public.text_array_max_length(options) <= 60)
);

comment on table public.business_context_questions is
  'Owner-configurable customer context questions. Product rule: at most 2 ACTIVE rows per business_id, enforced by the trigger below — not just at the application layer.';

create index if not exists business_context_questions_business_id_idx
  on public.business_context_questions (business_id, sort_order);

drop trigger if exists set_business_context_questions_updated_at on public.business_context_questions;
create trigger set_business_context_questions_updated_at
  before update on public.business_context_questions
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Enforce: at most 2 ACTIVE questions per business. A simple CHECK
-- constraint can't reference other rows, so this needs a trigger — same
-- pattern precedent as Module 6's business_action_status upsert-only
-- design, just enforcing a count instead of uniqueness.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_max_active_context_questions()
returns trigger
language plpgsql
as $$
declare
  v_active_count int;
begin
  if new.is_active then
    select count(*) into v_active_count
    from public.business_context_questions
    where business_id = new.business_id
      and is_active = true
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if v_active_count >= 2 then
      raise exception 'A business may have at most 2 active context questions.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_max_active_context_questions_trigger on public.business_context_questions;
create trigger enforce_max_active_context_questions_trigger
  before insert or update on public.business_context_questions
  for each row execute procedure public.enforce_max_active_context_questions();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.business_context_questions enable row level security;

-- Owner: full CRUD on their own business's questions.
drop policy if exists "business_context_questions_all_own" on public.business_context_questions;
create policy "business_context_questions_all_own"
  on public.business_context_questions for all
  using (
    exists (select 1 from public.businesses b where b.id = business_context_questions.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_context_questions.business_id and b.owner_id = auth.uid())
  );

-- Public: read-only, ACTIVE questions only — this is the entire
-- customer-facing surface. No anon/authenticated INSERT, UPDATE, or DELETE
-- policy exists anywhere on this table; customers can only ever read.
drop policy if exists "business_context_questions_select_public_active" on public.business_context_questions;
create policy "business_context_questions_select_public_active"
  on public.business_context_questions for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "business_context_questions_select_admin" on public.business_context_questions;
create policy "business_context_questions_select_admin"
  on public.business_context_questions for select
  using (public.is_admin());
