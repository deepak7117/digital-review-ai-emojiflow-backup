-- ============================================================================
-- BD Clarity (by Banao Digital) — Settings: Brand & Experience
-- ============================================================================
-- Adds ONE additive column to the EXISTING businesses table. No new
-- table, no change to any existing column, constraint, or RLS policy —
-- the existing businesses_select_own/_update_own/_select_admin policies
-- already cover this new column automatically (RLS is row-level, not
-- column-level).
--
-- Exists specifically so the "Brand & Experience" theme selector in
-- Settings is genuinely functional (persisted, and actually read by the
-- customer-facing feedback page to change its accent color) rather than
-- a UI control that doesn't do anything — the brief explicitly forbids
-- shipping fake settings.
--
-- The actual set of allowed theme values is a small, curated list
-- (src/lib/branding/themes.ts) — enforced here too via CHECK, so an
-- invalid value can never be stored even if the application layer had a
-- bug.
--
-- Run this AFTER 0001-0016, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

alter table public.businesses
  add column if not exists brand_theme text not null default 'default';

alter table public.businesses
  drop constraint if exists businesses_brand_theme_check;
alter table public.businesses
  add constraint businesses_brand_theme_check
  check (brand_theme in ('default', 'midnight_gold', 'ocean_blue', 'emerald', 'royal_purple', 'warm_sand', 'graphite'));

comment on column public.businesses.brand_theme is
  'Curated theme preset for the customer-facing feedback experience (not a free color picker, per the approved design constraint). Read by src/app/feedback/[code]/page.tsx to apply the matching accent colors from src/lib/branding/themes.ts.';

-- ----------------------------------------------------------------------------
-- feedback_pages view (0002) — additive extension only. The customer
-- feedback page cannot read businesses.brand_theme directly (anon has no
-- SELECT on that table at all, by design), so without this the theme
-- selector would be unable to actually affect the customer experience —
-- exactly the "fake setting" this feature must not be. CREATE OR REPLACE
-- VIEW, not an edit to 0002_qr_feedback.sql itself; every column this
-- view already exposed is unchanged, only brand_theme is added.
-- ----------------------------------------------------------------------------
create or replace view public.feedback_pages as
select
  fl.public_code,
  fl.tags,
  fl.is_active,
  b.business_name,
  b.category,
  b.city,
  b.logo_url,
  b.google_review_url,
  b.brand_theme
from public.feedback_links fl
join public.businesses b on b.id = fl.business_id
where fl.is_active = true;

comment on view public.feedback_pages is
  'Public-safe read model for /feedback/[code]. Deliberately excludes business_id, owner_id, phone, email, address, and website. brand_theme added for the Settings > Brand & Experience feature — still excludes everything sensitive.';
