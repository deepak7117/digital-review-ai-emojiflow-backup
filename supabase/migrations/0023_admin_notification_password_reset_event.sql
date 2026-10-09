-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Batch A
-- Extend admin_notifications event types: owner_password_reset
-- ============================================================================
-- An admin-initiated owner password reset is a genuinely distinct
-- platform event from the three already defined (business status,
-- admin role, entitlement). Forcing it under one of those labels
-- would mislabel the notification — caught and fixed before shipping,
-- not after. This migration only widens the existing CHECK constraint
-- on the existing admin_notifications table; no new table, no change
-- to any other column, policy, or row.
--
-- Run this AFTER 0001-0022, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

alter table public.admin_notifications drop constraint if exists admin_notifications_event_type_check;
alter table public.admin_notifications add constraint admin_notifications_event_type_check
  check (event_type in ('business_status_changed', 'admin_role_changed', 'entitlement_changed', 'owner_password_reset'));
