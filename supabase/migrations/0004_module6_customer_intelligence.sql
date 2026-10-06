-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 6: Customer Intelligence
-- ============================================================================
-- Creates: unmet_demand_reports, customer_pulse_polls,
--          customer_pulse_responses, business_action_status,
--          public.customer_pulse_pages (view)
--
-- Deliberately does NOT touch feedback_submissions, feedback_links,
-- businesses, or profiles — Module 6's analytics are computed on top of
-- existing data (see src/lib/insights/*), not by duplicating it.
--
-- Run this AFTER 0001-0003, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- unmet_demand_reports
-- Answers to the optional "Was there anything you wanted today but couldn't
-- find?" question. Deliberately a separate table from feedback_submissions
-- (not every feedback flow includes this question, and it has a different
-- shape) but linked the same way — by business_id, resolved server-side
-- from the public_code, never trusted from the client.
-- ----------------------------------------------------------------------------
create type public.unmet_demand_reason as enum (
  'product_unavailable',
  'size_unavailable',
  'colour_unavailable',
  'too_expensive',
  'service_unavailable',
  'timing_issue',
  'other'
);

create table if not exists public.unmet_demand_reports (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  feedback_link_id      uuid references public.feedback_links (id) on delete set null,
  feedback_submission_id uuid references public.feedback_submissions (id) on delete set null,
  reason                public.unmet_demand_reason not null,
  detail                text,
  created_at            timestamptz not null default now()
);

comment on table public.unmet_demand_reports is
  'Optional "what did you want but could not find" answers. Feeds the Demand Detector / Lost Sales dashboard. Never used to calculate monetary figures — no pricing data is stored or inferred here.';

create index if not exists unmet_demand_reports_business_id_idx
  on public.unmet_demand_reports (business_id, created_at desc);

alter table public.unmet_demand_reports enable row level security;

drop policy if exists "unmet_demand_reports_select_own" on public.unmet_demand_reports;
create policy "unmet_demand_reports_select_own"
  on public.unmet_demand_reports for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = unmet_demand_reports.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "unmet_demand_reports_insert_public" on public.unmet_demand_reports;
create policy "unmet_demand_reports_insert_public"
  on public.unmet_demand_reports for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.feedback_links fl
      where fl.business_id = unmet_demand_reports.business_id
        and fl.id = unmet_demand_reports.feedback_link_id
        and fl.is_active = true
    )
  );

drop policy if exists "unmet_demand_reports_select_admin" on public.unmet_demand_reports;
create policy "unmet_demand_reports_select_admin"
  on public.unmet_demand_reports for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- customer_pulse_polls
-- One-question, up-to-4-option polls a business can run alongside their
-- feedback QR flow. Same public_code pattern as feedback_links.
-- ----------------------------------------------------------------------------
create table if not exists public.customer_pulse_polls (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  public_code  text not null unique,
  question     text not null,
  options      text[] not null,
  is_active    boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint customer_pulse_polls_public_code_format check (public_code ~ '^[a-z0-9-]{6,64}$'),
  constraint customer_pulse_polls_question_length check (length(question) between 1 and 200),
  constraint customer_pulse_polls_options_count check (
    cardinality(options) between 2 and 4
  ),
  constraint customer_pulse_polls_options_length check (
    public.text_array_max_length(options) <= 60
  )
);

comment on table public.customer_pulse_polls is
  'One-question polls (2-4 options) a business can run. options[i] index (0-based) is what customer_pulse_responses.option_index refers to.';

create index if not exists customer_pulse_polls_business_id_idx on public.customer_pulse_polls (business_id);
create index if not exists customer_pulse_polls_public_code_idx on public.customer_pulse_polls (public_code);

drop trigger if exists set_customer_pulse_polls_updated_at on public.customer_pulse_polls;
create trigger set_customer_pulse_polls_updated_at
  before update on public.customer_pulse_polls
  for each row execute procedure public.set_updated_at();

alter table public.customer_pulse_polls enable row level security;

drop policy if exists "customer_pulse_polls_select_own" on public.customer_pulse_polls;
create policy "customer_pulse_polls_select_own"
  on public.customer_pulse_polls for select
  using (
    exists (select 1 from public.businesses b where b.id = customer_pulse_polls.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "customer_pulse_polls_insert_own" on public.customer_pulse_polls;
create policy "customer_pulse_polls_insert_own"
  on public.customer_pulse_polls for insert
  with check (
    exists (select 1 from public.businesses b where b.id = customer_pulse_polls.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "customer_pulse_polls_update_own" on public.customer_pulse_polls;
create policy "customer_pulse_polls_update_own"
  on public.customer_pulse_polls for update
  using (
    exists (select 1 from public.businesses b where b.id = customer_pulse_polls.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = customer_pulse_polls.business_id and b.owner_id = auth.uid())
  );

-- Anon needs to resolve a poll's basic shape (question/options/is_active) to
-- know how many options exist before voting — same pattern as
-- feedback_links_select_public_active in Module 2. The public UI itself
-- reads through the customer_pulse_pages view below; this narrower policy
-- exists so the vote-submission server action can validate option_index
-- server-side without trusting the client.
drop policy if exists "customer_pulse_polls_select_public_active" on public.customer_pulse_polls;
create policy "customer_pulse_polls_select_public_active"
  on public.customer_pulse_polls for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "customer_pulse_polls_select_admin" on public.customer_pulse_polls;
create policy "customer_pulse_polls_select_admin"
  on public.customer_pulse_polls for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- customer_pulse_responses
-- One row per vote. No customer identity captured at all — not even a
-- hashed device id — so there is nothing PII-adjacent to protect here.
-- Duplicate-vote prevention is best-effort client-side (localStorage), per
-- the spec's "where practical" — documented as a known limitation.
-- ----------------------------------------------------------------------------
create table if not exists public.customer_pulse_responses (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references public.customer_pulse_polls (id) on delete cascade,
  option_index  smallint not null,
  created_at    timestamptz not null default now()
);

comment on table public.customer_pulse_responses is
  'One row per vote. option_index must be a valid index into the parent poll''s options array — enforced by the WITH CHECK below, at insert time, against the poll''s actual current option count.';

create index if not exists customer_pulse_responses_poll_id_idx on public.customer_pulse_responses (poll_id);

alter table public.customer_pulse_responses enable row level security;

drop policy if exists "customer_pulse_responses_select_own" on public.customer_pulse_responses;
create policy "customer_pulse_responses_select_own"
  on public.customer_pulse_responses for select
  using (
    exists (
      select 1 from public.customer_pulse_polls p
      join public.businesses b on b.id = p.business_id
      where p.id = customer_pulse_responses.poll_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "customer_pulse_responses_insert_public" on public.customer_pulse_responses;
create policy "customer_pulse_responses_insert_public"
  on public.customer_pulse_responses for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.customer_pulse_polls p
      where p.id = customer_pulse_responses.poll_id
        and p.is_active = true
        and customer_pulse_responses.option_index >= 0
        and customer_pulse_responses.option_index < cardinality(p.options)
        and (p.starts_at is null or p.starts_at <= now())
        and (p.ends_at is null or p.ends_at >= now())
    )
  );

drop policy if exists "customer_pulse_responses_select_admin" on public.customer_pulse_responses;
create policy "customer_pulse_responses_select_admin"
  on public.customer_pulse_responses for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- business_action_status
-- The "Mark as done" half of the feedback -> action loop. Deliberately
-- stores ONLY completion state, not the action's content — the content
-- (title, evidence, priority) is recomputed live from real data every time
-- by src/lib/insights/businessAdvisor.ts. action_key is a stable,
-- deterministic identifier (e.g. "unmet-demand:size_unavailable") so the
-- same recommendation re-derived tomorrow still matches its saved status.
-- ----------------------------------------------------------------------------
create table if not exists public.business_action_status (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  action_key   text not null,
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint business_action_status_status_check check (status in ('open', 'done')),
  constraint business_action_status_unique unique (business_id, action_key)
);

comment on table public.business_action_status is
  'Completion state only, keyed by a deterministic action_key. Action content itself is always recomputed live from real feedback data, never stored here — this is intentionally the small, extensible foundation the spec asked for, not a task-management system.';

drop trigger if exists set_business_action_status_updated_at on public.business_action_status;
create trigger set_business_action_status_updated_at
  before update on public.business_action_status
  for each row execute procedure public.set_updated_at();

alter table public.business_action_status enable row level security;

drop policy if exists "business_action_status_all_own" on public.business_action_status;
create policy "business_action_status_all_own"
  on public.business_action_status for all
  using (
    exists (select 1 from public.businesses b where b.id = business_action_status.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_action_status.business_id and b.owner_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- public.customer_pulse_pages — the only thing an anonymous voter can read.
-- Same pattern as public.feedback_pages from Module 2: definer-style view,
-- narrow column set, no direct anon grant on the underlying business data.
-- ----------------------------------------------------------------------------
drop view if exists public.customer_pulse_pages;
create view public.customer_pulse_pages as
select
  p.public_code,
  p.question,
  p.options,
  p.is_active,
  p.starts_at,
  p.ends_at,
  b.business_name,
  b.logo_url
from public.customer_pulse_polls p
join public.businesses b on b.id = p.business_id
where p.is_active = true
  and (p.starts_at is null or p.starts_at <= now())
  and (p.ends_at is null or p.ends_at >= now());

comment on view public.customer_pulse_pages is
  'Public-safe read model for /pulse/[code]. Excludes business_id, owner_id, and every other business column.';

grant select on public.customer_pulse_pages to anon, authenticated;
