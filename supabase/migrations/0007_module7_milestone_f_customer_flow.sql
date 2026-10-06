-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 7 Milestone F: Customer
-- Voice → Review Flow — stores customer answers to a business's context
-- questions, and exposes the active questions publicly for the feedback
-- flow to render.
-- ============================================================================
-- Adds TWO new objects. Does NOT touch any existing table, column,
-- constraint, index, trigger, or RLS policy — feedback_submissions,
-- feedback_links, business_context_questions, and every other table from
-- Modules 1-6 and Module 7 Milestones A-E are unaffected.
--
-- Run this AFTER 0001-0006, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- feedback_question_answers
-- One row per customer answer to one of the business's (up to 2) active
-- context questions, linked to the resulting feedback_submissions row.
--
-- question_text is a SNAPSHOT taken at answer time, not a live join to
-- business_context_questions — if the owner later edits or deletes the
-- question, this historical record of what was actually asked is
-- preserved unchanged, matching the same "never silently rewrite
-- historical data" principle feedback_submissions already follows.
--
-- business_id and feedback_link_id are denormalized (same values already
-- on the paired feedback_submissions row) specifically so the anon INSERT
-- policy below can validate against feedback_links — a table anon can
-- already read — without ever needing a SELECT policy on
-- feedback_submissions, which stays exactly as private as it already is.
-- Referential integrity to feedback_submissions is still fully enforced by
-- the foreign key itself (checked by Postgres internally, independent of
-- RLS), not by this policy.
-- ----------------------------------------------------------------------------
create table if not exists public.feedback_question_answers (
  id                      uuid primary key default gen_random_uuid(),
  feedback_submission_id  uuid not null references public.feedback_submissions (id) on delete cascade,
  business_id             uuid not null references public.businesses (id) on delete cascade,
  feedback_link_id        uuid references public.feedback_links (id) on delete set null,
  question_id             uuid references public.business_context_questions (id) on delete set null,
  question_text           text not null,
  answer                  text not null,
  created_at              timestamptz not null default now(),

  constraint feedback_question_answers_question_text_length check (length(question_text) between 1 and 200),
  constraint feedback_question_answers_answer_length check (length(answer) between 1 and 500)
);

comment on table public.feedback_question_answers is
  'Customer answers to a business''s context questions, captured alongside a feedback_submissions row. question_text is a snapshot, not a live reference — editing/deleting the question later does not alter this historical record. Immutable: no update or delete policy exists for any role.';

create index if not exists feedback_question_answers_submission_id_idx
  on public.feedback_question_answers (feedback_submission_id);
create index if not exists feedback_question_answers_business_id_idx
  on public.feedback_question_answers (business_id, created_at desc);

alter table public.feedback_question_answers enable row level security;

-- Owner: read-only, same pattern as feedback_submissions_select_own.
drop policy if exists "feedback_question_answers_select_own" on public.feedback_question_answers;
create policy "feedback_question_answers_select_own"
  on public.feedback_question_answers for select
  using (
    exists (select 1 from public.businesses b where b.id = feedback_question_answers.business_id and b.owner_id = auth.uid())
  );

-- Public: insert-only, validated against an ACTIVE feedback_links row —
-- exactly the same pattern as feedback_submissions_insert_public. No
-- select/update/delete policy exists for anon/authenticated at all.
drop policy if exists "feedback_question_answers_insert_public" on public.feedback_question_answers;
create policy "feedback_question_answers_insert_public"
  on public.feedback_question_answers for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.feedback_links fl
      where fl.id = feedback_question_answers.feedback_link_id
        and fl.business_id = feedback_question_answers.business_id
        and fl.is_active = true
    )
  );

drop policy if exists "feedback_question_answers_select_admin" on public.feedback_question_answers;
create policy "feedback_question_answers_select_admin"
  on public.feedback_question_answers for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- public.feedback_page_questions — the only way an anonymous customer can
-- read a business's context questions. Same definer-style pattern as
-- public.feedback_pages (0002) and public.customer_pulse_pages (0004):
-- narrow, purpose-built view: exposes only question_id/text/options/
-- sort_order for ACTIVE questions belonging to an ACTIVE feedback link,
-- keyed by public_code — never business_id, never owner_id.
--
-- business_context_questions already has its OWN narrow anon SELECT
-- policy (is_active = true) from Milestone E, so this view isn't strictly
-- required for security — but it lets the feedback page resolve
-- "this business's 2 questions" in one query keyed by public_code, exactly
-- matching how feedback_pages already resolves business identity, rather
-- than making the public feedback route re-derive business_id from
-- feedback_links itself.
-- ----------------------------------------------------------------------------
drop view if exists public.feedback_page_questions;
create view public.feedback_page_questions as
select
  fl.public_code,
  q.id as question_id,
  q.question_text,
  q.options,
  q.sort_order
from public.feedback_links fl
join public.business_context_questions q on q.business_id = fl.business_id
where fl.is_active = true
  and q.is_active = true
order by q.sort_order;

comment on view public.feedback_page_questions is
  'Public-safe read model for /feedback/[code] — the up-to-2 active context questions for that business, keyed by public_code. Excludes business_id and every other business column.';

grant select on public.feedback_page_questions to anon, authenticated;
