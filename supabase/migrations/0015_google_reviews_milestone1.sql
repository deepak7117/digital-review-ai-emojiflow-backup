-- ============================================================================
-- BD Clarity (by Banao Digital) — Google Business Profile Integration,
-- Review Retrieval Milestone 1
-- ============================================================================
-- Adds ONE new table. Does not touch any existing table, column,
-- constraint, trigger, or RLS policy — google_business_connections
-- (0011), the customer feedback flow, Action Engine, Admin Panel, and
-- every other completed module are unaffected.
--
-- Deliberately reuses the EXISTING google_business_connections table for
-- OAuth tokens/account/location identity (per the approved scope: "do not
-- create duplicate Google connection/location tables") — this table only
-- stores the reviews themselves, each tied back to the connection they
-- came from.
--
-- Read-only milestone: owner_reply/owner_reply_at below mirror whatever
-- reply Google already reports for a review (if any existed before BD
-- Clarity connected); BD Clarity does not write a reply anywhere in this
-- migration or in Milestone 1 — publishing is explicitly deferred to a
-- later, separately-approved milestone.
--
-- Run this AFTER 0001-0014, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.google_reviews (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  connection_id      uuid not null references public.google_business_connections (id) on delete cascade,

  -- Google's own review identifier — the dedup key. Stable across syncs,
  -- so re-syncing any number of times never creates duplicate rows.
  google_review_id   text not null,

  reviewer_name      text,
  rating             smallint not null,
  comment            text,

  -- Mirrors whatever Google reports for an existing reply on this review
  -- (e.g. one left before BD Clarity was ever connected). Not written to
  -- by BD Clarity in this milestone.
  owner_reply        text,
  owner_reply_at     timestamptz,
  reply_status       text,

  review_created_at  timestamptz,
  review_updated_at  timestamptz,
  synced_at          timestamptz not null default now(),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint google_reviews_rating_check check (rating between 1 and 5),
  constraint google_reviews_unique unique (connection_id, google_review_id)
);

comment on table public.google_reviews is
  'Imported Google Business Profile reviews, synced on-demand (see the sync server action). Read-only in this milestone — owner_reply/owner_reply_at/reply_status mirror what Google itself reports, BD Clarity does not write a reply here yet. Deduplicated on (connection_id, google_review_id): re-syncing never creates duplicate rows, and an existing row is updated in place rather than re-inserted.';

create index if not exists google_reviews_business_id_idx
  on public.google_reviews (business_id, review_created_at desc);
create index if not exists google_reviews_connection_id_idx
  on public.google_reviews (connection_id);

drop trigger if exists set_google_reviews_updated_at on public.google_reviews;
create trigger set_google_reviews_updated_at
  before update on public.google_reviews
  for each row execute procedure public.set_updated_at();

alter table public.google_reviews enable row level security;

-- Owner: full access to their OWN business's reviews — same pattern as
-- google_business_connections and every other owner-scoped table.
drop policy if exists "google_reviews_all_own" on public.google_reviews;
create policy "google_reviews_all_own"
  on public.google_reviews for all
  using (
    exists (select 1 from public.businesses b where b.id = google_reviews.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = google_reviews.business_id and b.owner_id = auth.uid())
  );

-- Admin: read-only, same "_select_admin" pattern already used elsewhere —
-- grants no more visibility than an admin already has.
drop policy if exists "google_reviews_select_admin" on public.google_reviews;
create policy "google_reviews_select_admin"
  on public.google_reviews for select
  using (public.is_admin());

-- No anon policy of any kind — this table is never customer-facing, and
-- unlike the public feedback flow, there is no legitimate reason for an
-- unauthenticated request to touch it at all.
