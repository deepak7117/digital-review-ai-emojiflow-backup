-- ============================================================================
-- BD Clarity (by Banao Digital) — Customer Recovery Flow:
-- In-app owner notification for negative feedback
-- ============================================================================
-- Adds ONE new table. Does not touch any existing table, column,
-- constraint, trigger, or RLS policy — Modules 1-7, the Admin Panel, the
-- Action Engine, Customer Brain/Pulse, the Segment Engine, and the Google
-- OAuth foundation are all unaffected.
--
-- Deliberately does NOT store the raw feedback message or tags — only a
-- reference to the existing feedback_submissions row plus the rating.
-- The notification itself is a generic, templated alert ("new feedback
-- needs your attention"); the actual content is viewed through the
-- existing, already-permissioned Feedback Inbox. This is a privacy
-- decision, not an oversight: it avoids creating a second copy of
-- potentially sensitive customer text, and directly satisfies "must not
-- expose unnecessary customer information."
--
-- Run this AFTER 0001-0013, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.owner_notifications (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references public.businesses (id) on delete cascade,
  feedback_submission_id  uuid references public.feedback_submissions (id) on delete set null,
  rating                  smallint not null,
  read_at                 timestamptz,
  created_at              timestamptz not null default now(),

  constraint owner_notifications_rating_check check (rating between 1 and 5)
);

comment on table public.owner_notifications is
  'In-app alerts for the business owner, triggered when a rating <= 2 submission is saved (see submitFeedback() in src/app/feedback/[code]/actions.ts). Deliberately carries no raw feedback text/tags — only a reference to the real feedback_submissions row, whose own RLS already governs who can read the actual content. This table is additive to, not a replacement for, that existing access boundary.';

create index if not exists owner_notifications_business_id_idx
  on public.owner_notifications (business_id, read_at, created_at desc);

alter table public.owner_notifications enable row level security;

-- Owner: full access to their OWN business's notifications (read + mark
-- as read) — same pattern as every owner-scoped table in this project.
drop policy if exists "owner_notifications_all_own" on public.owner_notifications;
create policy "owner_notifications_all_own"
  on public.owner_notifications for all
  using (
    exists (select 1 from public.businesses b where b.id = owner_notifications.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = owner_notifications.business_id and b.owner_id = auth.uid())
  );

-- Admin: read-only, same "_select_admin" pattern already used elsewhere —
-- grants no more visibility than an admin already has via
-- feedback_submissions itself.
drop policy if exists "owner_notifications_select_admin" on public.owner_notifications;
create policy "owner_notifications_select_admin"
  on public.owner_notifications for select
  using (public.is_admin());

-- Insert: the public feedback flow (anon) needs to create these rows at
-- submission time. IMPORTANT: anon has no SELECT policy on
-- feedback_submissions at all (by design — customers can't read feedback
-- back, including their own), so a WITH CHECK that queries
-- feedback_submissions directly would silently fail for every caller,
-- valid or not — RLS subqueries run under the CALLER's own row
-- visibility, not the table owner's. Validates against feedback_links
-- instead (anon-readable for active links via
-- feedback_links_select_public_active, 0002) — the same trust boundary
-- feedback_submissions_insert_public itself already relies on. This
-- confirms business_id corresponds to a genuine, currently-active public
-- feedback destination; feedback_submission_id itself is still recorded
-- but not re-validated here, since the server action that performs this
-- insert always supplies the real id it just received back from the
-- feedback_submissions insert moments earlier in the same request.
drop policy if exists "owner_notifications_insert_public" on public.owner_notifications;
create policy "owner_notifications_insert_public"
  on public.owner_notifications for insert
  with check (
    exists (
      select 1 from public.feedback_links fl
      where fl.business_id = owner_notifications.business_id
        and fl.is_active = true
    )
  );

-- No anon SELECT/UPDATE/DELETE policy — a customer can create the alert
-- as a side effect of submitting feedback, but can never read, modify, or
-- clear it afterward.
