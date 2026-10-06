-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 2: QR Feedback System
-- ============================================================================
-- Creates: feedback_links, feedback_submissions, public.feedback_pages (view)
-- Enables: Row Level Security, owner-scoped policies, minimal public exposure
--
-- Run this AFTER 0001_init.sql, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- feedback_links
-- One public feedback page/QR per business. public_code is the only
-- identifier ever exposed to customers or printed on a QR code — never the
-- internal businesses.id.
-- ----------------------------------------------------------------------------
create table if not exists public.feedback_links (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null unique references public.businesses (id) on delete cascade,
  public_code  text not null unique,
  tags         text[] not null default array[
                 'Service', 'Staff', 'Quality', 'Cleanliness', 'Value', 'Ambience', 'Speed'
               ],
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint feedback_links_public_code_format check (public_code ~ '^[a-z0-9-]{6,64}$')
);

comment on table public.feedback_links is
  'One public QR/link per business. public_code is the only business identifier ever exposed publicly.';
comment on column public.feedback_links.tags is
  'The optional experience tags shown on this business''s public feedback page.';

create index if not exists feedback_links_public_code_idx on public.feedback_links (public_code);

drop trigger if exists set_feedback_links_updated_at on public.feedback_links;
create trigger set_feedback_links_updated_at
  before update on public.feedback_links
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- feedback_submissions
-- Every customer submission — this IS the business's private feedback
-- channel. It exists independently of whether the customer also continues
-- on to leave a public Google review; nothing here is ever shown publicly.
-- ----------------------------------------------------------------------------
create table if not exists public.feedback_submissions (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  feedback_link_id    uuid references public.feedback_links (id) on delete set null,
  rating              smallint not null,
  tags                text[] not null default '{}',
  message             text,
  ai_draft            text,
  final_draft         text,
  proceeded_to_google boolean not null default false,
  created_at          timestamptz not null default now(),

  constraint feedback_submissions_rating_range check (rating between 1 and 5)
);

comment on table public.feedback_submissions is
  'Every customer submission collected through a feedback_links page. Private to the owning business — never exposed publicly, and never used to decide whether a customer sees the Google review option.';
comment on column public.feedback_submissions.proceeded_to_google is
  'Self-reported by the client after the customer clicks the Google CTA. Informational only — never used to gate or filter anything.';

create index if not exists feedback_submissions_business_id_idx
  on public.feedback_submissions (business_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.feedback_links enable row level security;
alter table public.feedback_submissions enable row level security;

-- feedback_links: only the owning business can fully manage their link.
-- A second, narrow policy also lets anon/authenticated read an ACTIVE
-- link's id/business_id/tags — this is required so the public feedback
-- flow (and the server actions behind it) can resolve a public_code to the
-- business it belongs to and validate it's still active, without ever
-- trusting a business id supplied by the client. This does not expose any
-- business contact/profile data — that stays behind the feedback_pages
-- view below, which anon can also read but only for its narrow column set.
drop policy if exists "feedback_links_select_own" on public.feedback_links;
create policy "feedback_links_select_own"
  on public.feedback_links for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = feedback_links.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "feedback_links_select_public_active" on public.feedback_links;
create policy "feedback_links_select_public_active"
  on public.feedback_links for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "feedback_links_insert_own" on public.feedback_links;
create policy "feedback_links_insert_own"
  on public.feedback_links for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = feedback_links.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "feedback_links_update_own" on public.feedback_links;
create policy "feedback_links_update_own"
  on public.feedback_links for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = feedback_links.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = feedback_links.business_id and b.owner_id = auth.uid()
    )
  );

-- feedback_submissions: the owning business can read their submissions.
-- Nobody (including the owner) can update or delete a submission — it's an
-- honest record of what the customer actually said.
drop policy if exists "feedback_submissions_select_own" on public.feedback_submissions;
create policy "feedback_submissions_select_own"
  on public.feedback_submissions for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = feedback_submissions.business_id and b.owner_id = auth.uid()
    )
  );

-- Public/anonymous customers may INSERT a submission, but only for a
-- business that currently has an active feedback link — this is enforced
-- here at the database layer, not just in application code, so it holds
-- even if the insert doesn't go through our server action.
drop policy if exists "feedback_submissions_insert_public" on public.feedback_submissions;
create policy "feedback_submissions_insert_public"
  on public.feedback_submissions for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.feedback_links fl
      where fl.business_id = feedback_submissions.business_id
        and fl.id = feedback_submissions.feedback_link_id
        and fl.is_active = true
    )
  );

-- Admins get read access, same pattern as Module 1, for the future admin
-- area — scoped to the caller's own profile role, never client-supplied.
-- Uses public.is_admin() (defined in 0001_init.sql), not an inline
-- subquery on profiles, to avoid the RLS self-recursion documented there.
drop policy if exists "feedback_links_select_admin" on public.feedback_links;
create policy "feedback_links_select_admin"
  on public.feedback_links for select
  using (public.is_admin());

drop policy if exists "feedback_submissions_select_admin" on public.feedback_submissions;
create policy "feedback_submissions_select_admin"
  on public.feedback_submissions for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- public.feedback_pages — the business-facing content an anonymous
-- customer can read (name, category, city, logo, Google review link).
--
-- This view intentionally does not set `security_invoker`, so it runs with
-- the privileges of its owner (the migration role), which is the standard
-- Supabase pattern for exposing a narrow, safe slice of RLS-protected
-- tables to anon without granting anon any direct access to `businesses`.
-- anon/authenticated are granted SELECT on this view only — never on
-- `businesses` directly — which is what keeps phone, email, address,
-- owner_id, and every other business column out of the public feedback
-- page, even though the underlying table holds them. (anon does have a
-- separate, narrow, explicit policy on `feedback_links` itself — see
-- above — because the server actions need to resolve a public_code to a
-- business_id; that table only ever held non-sensitive link metadata.)
-- ----------------------------------------------------------------------------
drop view if exists public.feedback_pages;
create view public.feedback_pages as
select
  fl.public_code,
  fl.tags,
  fl.is_active,
  b.business_name,
  b.category,
  b.city,
  b.logo_url,
  b.google_review_url
from public.feedback_links fl
join public.businesses b on b.id = fl.business_id
where fl.is_active = true;

comment on view public.feedback_pages is
  'Public-safe read model for /feedback/[code]. Deliberately excludes business_id, owner_id, phone, email, address, and website.';

grant select on public.feedback_pages to anon, authenticated;
