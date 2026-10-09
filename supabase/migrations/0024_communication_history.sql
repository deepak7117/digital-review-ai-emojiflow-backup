-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Batch C
-- Communication History
-- ============================================================================
-- Confirmed during audit: zero provider integration, template system, or
-- send-history table exists anywhere. The existing contact.ts is static
-- links (wa.me / mailto) that open the ADMIN's own email/WhatsApp
-- client — not a server-side send. This table is new because nothing
-- in the existing schema can honestly record "an admin asked the
-- platform to send a message, and here is what really happened."
--
-- Status values are deliberately honest about what can be known without
-- a real provider webhook/callback integration: 'queued' and 'failed'
-- are states this code can set truthfully on its own; 'submitted'
-- means a provider accepted the request (its own API returned success)
-- but did not yet confirm delivery; 'delivered' requires a provider
-- that reports delivery (most do via webhook, not implemented here —
-- see Batch C's own report for exactly what remains); 'unknown' covers
-- any provider response this code could not interpret. Nothing in this
-- schema allows the application to directly set 'delivered' itself —
-- there is no code path that inserts that value without a real,
-- provider-confirmed signal, by design.
-- ============================================================================

create table if not exists public.communication_history (
  id              uuid primary key default gen_random_uuid(),
  channel         text not null,
  recipient       text not null,
  template_type   text not null,
  subject         text,
  status          text not null default 'queued',
  provider_name   text,
  provider_ref    text,
  failure_reason  text,
  sent_by_admin_id uuid references auth.users (id) on delete set null,
  target_type     text,
  target_id       uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint communication_history_channel_check check (channel in ('email', 'sms')),
  constraint communication_history_status_check
    check (status in ('queued', 'submitted', 'delivered', 'failed', 'unknown'))
);

comment on table public.communication_history is
  'Record of admin-initiated send attempts and their real, provider-reported outcomes. Never a duplicate of admin_notifications (platform events) or owner_notifications (owner-facing items) — this table exists specifically because neither captures "a message was sent to someone, and here is what actually happened." The application code has no path that sets status to delivered without a genuine provider signal.';

create index if not exists communication_history_created_at_idx
  on public.communication_history (created_at desc);
create index if not exists communication_history_target_idx
  on public.communication_history (target_type, target_id);

drop trigger if exists set_communication_history_updated_at on public.communication_history;
create trigger set_communication_history_updated_at
  before update on public.communication_history
  for each row execute procedure public.set_updated_at();

alter table public.communication_history enable row level security;

-- Same is_admin() read gate as every other admin-readable table.
drop policy if exists "communication_history_select_admin" on public.communication_history;
create policy "communication_history_select_admin"
  on public.communication_history for select
  using (public.is_admin());

-- Insert/update restricted to super_admin specifically — matching the
-- same RLS pattern already used for owner_entitlements and
-- admin_role_assignments (comparably sensitive writes), not the
-- broader is_admin() used for ordinary admin-readable tables. Caught
-- during testing: an earlier draft used is_admin() here, which would
-- have let any admin role insert/update directly, bypassing the
-- application layer's super_admin-only check entirely — fixed before
-- this was ever shipped.
drop policy if exists "communication_history_insert_admin" on public.communication_history;
create policy "communication_history_insert_admin"
  on public.communication_history for insert
  with check (public.get_admin_role() = 'super_admin');

drop policy if exists "communication_history_update_admin" on public.communication_history;
create policy "communication_history_update_admin"
  on public.communication_history for update
  using (public.get_admin_role() = 'super_admin')
  with check (public.get_admin_role() = 'super_admin');

-- No anon policy, no delete policy — a send record, once created,
-- is never removed; only its status/provider fields are updated as a
-- real provider response comes back.
