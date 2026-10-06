-- ============================================================================
-- BD Clarity (by Banao Digital) — Google Reply Workflow
-- (AI draft -> owner edit/approve -> publish to Google)
-- ============================================================================
-- Additive ALTER on the EXISTING google_reviews table (0015) only. No new
-- table, no existing migration edited, no change to
-- google_business_connections, no change to any RLS policy's logic (the
-- existing owner-only / admin-read-only policies on google_reviews
-- already cover these new columns automatically, since RLS is row-level
-- not column-level).
--
-- Distinction from the EXISTING owner_reply/owner_reply_at/reply_status
-- columns (0015): those three mirror whatever Google itself reports for a
-- review's reply (read-only, populated by sync). The new columns below
-- are BD Clarity's OWN in-progress draft/publish state — separate,
-- because a review can have an AI-drafted, not-yet-published reply sitting
-- in BD Clarity while Google still reports no reply at all (or an older
-- one). Once a publish succeeds, the sync-populated owner_reply/
-- owner_reply_at/reply_status are expected to catch up to match on the
-- next sync, confirming Google's own source of truth.
--
-- Run this AFTER 0001-0015, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

alter table public.google_reviews
  add column if not exists ai_reply_draft    text,
  add column if not exists draft_status      text not null default 'none',
  add column if not exists draft_updated_at  timestamptz,
  add column if not exists publish_attempted_at timestamptz,
  add column if not exists publish_error     text;

alter table public.google_reviews
  drop constraint if exists google_reviews_draft_status_check;
alter table public.google_reviews
  add constraint google_reviews_draft_status_check
  check (draft_status in ('none', 'drafted', 'edited', 'publishing', 'published', 'failed'));

comment on column public.google_reviews.ai_reply_draft is
  'BD Clarity''s own in-progress reply text (AI-generated, then possibly owner-edited) — not yet confirmed published to Google. Distinct from owner_reply (0015), which mirrors what Google itself reports.';
comment on column public.google_reviews.draft_status is
  'none -> drafted (AI generated) -> edited (owner changed it) -> publishing -> published | failed. "failed" allows a retry without losing the draft text.';
