-- ============================================================================
-- BD Clarity (by Banao Digital) — Google Business Profile Integration,
-- Milestone 1: Connection Foundation
-- ============================================================================
-- Adds ONE new table. Does not touch any existing table, column,
-- constraint, trigger, or RLS policy — Super Admin Panel, the customer
-- flow, businesses.google_review_url, and every completed module are
-- unaffected.
--
-- BRANCH MAPPING, INTERIM DESIGN (flagged explicitly per the approved
-- inspection report): no business_branches table exists yet (Module 7
-- Milestone 3, not started). branch_label below is a plain nullable text
-- field, NOT a foreign key — a business can create multiple connections,
-- each optionally labeled (e.g. "Nashik", "Pune"), without inventing the
-- deferred Branch Management schema. Once a real branches table exists,
-- a future migration can add a branch_id FK alongside (or replacing)
-- this column without breaking anything built here.
--
-- TOKEN SECURITY: access_token/refresh_token are stored as encrypted
-- bytea, encrypted/decrypted in Node.js application code (AES-256-GCM,
-- see src/lib/google/tokenCrypto.ts) — NOT via pgcrypto/SQL-side
-- encryption, so the encryption key stays purely a server-side
-- process.env value (GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY), consistent with
-- how every other secret in this project (AI_PROVIDER_API_KEY,
-- GOOGLE_PLACES_API_KEY) is handled — never touching the database layer.
-- No RLS policy on this table ever returns these two columns to a client
-- component; every server action that reads connection data for display
-- explicitly SELECTs only the non-token columns (see the Milestone 1
-- report for the exact discipline this depends on).
--
-- Run this AFTER 0001-0010, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create table if not exists public.google_business_connections (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,

  -- Interim multi-location support — see note above.
  branch_label             text,

  -- Google identifiers, not secrets — safe to read/display. Nullable
  -- while status='pending': the callback route creates this row
  -- immediately after a successful token exchange, before the owner has
  -- chosen which location it maps to — see the Milestone 1 report for why
  -- (the alternative would require passing a raw access token through a
  -- browser-visible redirect, which is exactly what must never happen).
  google_account_id        text,
  google_location_id       text,
  google_location_name     text,

  -- Encrypted at the application layer (see file header). Never selected
  -- by any client-facing query.
  access_token_encrypted   bytea not null,
  refresh_token_encrypted  bytea not null,
  token_expires_at         timestamptz not null,

  connected_by             uuid references auth.users (id) on delete set null,
  status                   text not null default 'pending',
  disconnected_at          timestamptz,
  disconnected_by          uuid references auth.users (id) on delete set null,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint google_business_connections_status_check check (status in ('pending', 'connected', 'disconnected')),
  -- A business may connect the SAME Google location only once while that
  -- connection is active (prevents accidental duplicate connections for
  -- the same location; a disconnected row doesn't block reconnecting).
  -- Pending rows (location not yet chosen) are exempt by construction:
  -- google_location_id is NULL for those, and Postgres treats each NULL
  -- as distinct for uniqueness purposes, so multiple pending/abandoned
  -- attempts never collide with each other or with a real connection.
  constraint google_business_connections_unique_active unique (business_id, google_location_id, status)
);

comment on table public.google_business_connections is
  'One row per Google Business Profile location a business owner has connected. Tokens are encrypted at the application layer (AES-256-GCM, see src/lib/google/tokenCrypto.ts) — this table alone is not the full security boundary; server actions must never select access_token_encrypted/refresh_token_encrypted into any client-facing response.';

create index if not exists google_business_connections_business_id_idx
  on public.google_business_connections (business_id, status);

drop trigger if exists set_google_business_connections_updated_at on public.google_business_connections;
create trigger set_google_business_connections_updated_at
  before update on public.google_business_connections
  for each row execute procedure public.set_updated_at();

alter table public.google_business_connections enable row level security;

-- Owner: full access to their OWN business's connections — same pattern
-- as every owner-scoped table in this project (businesses_select_own,
-- feedback_submissions_select_own, etc).
drop policy if exists "google_business_connections_all_own" on public.google_business_connections;
create policy "google_business_connections_all_own"
  on public.google_business_connections for all
  using (
    exists (select 1 from public.businesses b where b.id = google_business_connections.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = google_business_connections.business_id and b.owner_id = auth.uid())
  );

-- Admin: read-only, same "_select_admin" pattern already used for 9 other
-- tables — an admin can see THAT a business is connected and to which
-- location, for support/diagnostics, but this policy grants no more than
-- the owner already has, and the token columns remain encrypted
-- regardless of who reads the row.
drop policy if exists "google_business_connections_select_admin" on public.google_business_connections;
create policy "google_business_connections_select_admin"
  on public.google_business_connections for select
  using (public.is_admin());

-- No anon/public policy of any kind — this table is never customer-facing.

-- ----------------------------------------------------------------------------
-- Narrow addition to the EXISTING audit_logs table (0008) — does not edit
-- that migration file. audit_logs_insert_own (0008) requires
-- public.is_admin(), which a business owner is not — so without this,
-- an owner's own connect/disconnect actions would be silently rejected
-- by RLS. This policy is deliberately narrow: it permits an INSERT only
-- for the two named Google-connection actions, only attributed to the
-- caller themselves, and only targeting a business the caller actually
-- owns — it grants no broader audit-log write access than that, and does
-- not touch or weaken audit_logs_insert_own itself.
-- ----------------------------------------------------------------------------
drop policy if exists "audit_logs_insert_owner_google" on public.audit_logs;
create policy "audit_logs_insert_owner_google"
  on public.audit_logs for insert
  with check (
    action in ('google_business_connect', 'google_business_disconnect')
    and admin_user_id = auth.uid()
    and target_type = 'business'
    and exists (select 1 from public.businesses b where b.id = audit_logs.target_id and b.owner_id = auth.uid())
  );
