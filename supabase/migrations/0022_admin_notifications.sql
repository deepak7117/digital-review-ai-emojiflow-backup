-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Enhancement, Milestone C
-- Admin Notifications
-- ============================================================================
-- Confirmed during audit: no admin-facing notification infrastructure
-- exists anywhere. owner_notifications (0014) is a genuinely useful
-- reference pattern — lean payload referencing the real event, simple
-- read_at — but it is architecturally owner-scoped (business_id FK,
-- RLS to that business's owner only) and cannot be reused directly for
-- platform-wide admin events with a different recipient model.
--
-- DELIBERATE DESIGN DECISION, documented rather than silent: this is a
-- SHARED INBOX, not per-admin unread state. read_at/read_by are set
-- once by whichever admin reads the notification first, visible to
-- all. A "small, useful first version" per the brief — per-admin
-- unread tracking would need a second join table for a capability this
-- milestone doesn't require yet.
--
-- Expiry notifications ("approaching expiry") are NOT stored here —
-- there is no scheduler/cron/worker in this project, and none is
-- introduced by this migration. They are computed live from
-- owner_entitlements.expiry_date at read time (see
-- notificationActions.ts), the same safe, idempotent, zero-new-
-- infrastructure pattern already used for the Milestone B dashboard
-- metrics. Only genuinely event-driven notifications (business status
-- change, admin role change, entitlement material change) are stored
-- as real rows here.
--
-- Run this AFTER 0001-0021, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.admin_notifications (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,
  title         text not null,
  -- References to the real underlying record, never a duplicated copy
  -- of sensitive data — same philosophy as owner_notifications.
  target_type   text,
  target_id     uuid,
  actor_admin_id uuid references auth.users (id) on delete set null,
  metadata      jsonb,
  read_at       timestamptz,
  read_by       uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint admin_notifications_event_type_check
    check (event_type in ('business_status_changed', 'admin_role_changed', 'entitlement_changed'))
);

comment on table public.admin_notifications is
  'Shared admin notification inbox — platform-wide events, visible to any admin role, read_at/read_by set once by whichever admin reads it first (not per-admin unread state; see migration header). Expiry notifications are computed live from owner_entitlements, never stored here — no scheduler exists in this project and none is introduced by this table.';

create index if not exists admin_notifications_created_at_idx
  on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (read_at) where read_at is null;

alter table public.admin_notifications enable row level security;

-- Any admin role can read — reuses the exact same is_admin() gate as
-- every other admin-readable table in this project.
drop policy if exists "admin_notifications_select_admin" on public.admin_notifications;
create policy "admin_notifications_select_admin"
  on public.admin_notifications for select
  using (public.is_admin());

-- Marking read is also available to any admin (shared inbox — not
-- privileged the way role/entitlement writes are). Only read_at/read_by
-- are ever meant to change after creation; insert happens exclusively
-- through server actions using admin-authorized writes, enforced here
-- by requiring is_admin() for insert too (defense in depth beyond the
-- application-layer capability check).
drop policy if exists "admin_notifications_insert_admin" on public.admin_notifications;
create policy "admin_notifications_insert_admin"
  on public.admin_notifications for insert
  with check (public.is_admin());

drop policy if exists "admin_notifications_update_admin" on public.admin_notifications;
create policy "admin_notifications_update_admin"
  on public.admin_notifications for update
  using (public.is_admin())
  with check (public.is_admin());

-- No anon policy, no delete policy — never customer-facing, and
-- preserved as a permanent record once created (consistent with this
-- project's audit_logs immutability philosophy, though this table is
-- a notification inbox rather than a security audit trail, so a
-- read_at/read_by update is legitimate where a row EDIT would not be).
