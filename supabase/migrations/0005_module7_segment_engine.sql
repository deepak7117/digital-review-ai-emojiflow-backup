-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 7 Milestone A: Business
-- Segment Engine — segment selection storage
-- ============================================================================
-- Adds ONLY two nullable columns to the existing businesses table. Does
-- NOT touch any existing column, constraint, index, trigger, or RLS policy
-- on businesses or any other table — Modules 1-6 are unaffected.
--
-- The segment CATALOG itself (industries/segments/config) deliberately
-- lives in code (src/lib/segments/registry.ts) for Milestone A, not in the
-- database — see that file's module comment for why. That means there is
-- no foreign key from these columns to a catalog table yet; validity is
-- checked at the application layer via isValidSegment() before saving.
-- A later milestone can move the catalog into the database (with real FKs)
-- once the product needs runtime-editable segments, without changing the
-- shape of these two columns.
--
-- Run this AFTER 0001-0004, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

alter table public.businesses
  add column if not exists industry_slug text,
  add column if not exists segment_slug text;

comment on column public.businesses.industry_slug is
  'References src/lib/segments/registry.ts INDUSTRIES[].slug — validated at the application layer (isValidSegment()), not a database FK, since the catalog is code-based in Milestone A. Nullable: existing businesses have not chosen a segment.';
comment on column public.businesses.segment_slug is
  'References src/lib/segments/registry.ts SEGMENTS[].segmentSlug for the same industry_slug — validated at the application layer. Nullable for the same reason as industry_slug.';

-- No RLS changes needed: these are plain columns on an already-protected
-- table. The existing businesses_select_own / businesses_update_own
-- policies (0001_init.sql) already govern read/write access to them.
