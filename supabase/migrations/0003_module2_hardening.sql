-- ============================================================================
-- Digital Review AI (by Banao Digital) — Module 2 hardening
-- ============================================================================
-- Adds:
--   1. Database-level guardrails on feedback_links.tags (defense in depth
--      behind the application-level validation in updateFeedbackTags()).
--   2. A rate-limiting primitive for the public feedback endpoints
--      (generateDraft / submitFeedback), implemented as a SECURITY DEFINER
--      function over a table that anon has NO direct access to — anon can
--      only call the function, never read/write the table itself. This
--      does not weaken RLS anywhere; it adds a new, narrowly-scoped surface.
--
-- Run this AFTER 0001_init.sql and 0002_qr_feedback.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. feedback_links.tags guardrails
-- ----------------------------------------------------------------------------
-- Table CHECK constraints can't contain subqueries directly, so the
-- per-element length check is wrapped in a small immutable helper function.
create or replace function public.text_array_max_length(arr text[])
returns int
language sql
immutable
as $$
  select coalesce(max(length(x)), 0) from unnest(arr) as x;
$$;

alter table public.feedback_links
  drop constraint if exists feedback_links_tags_count;
alter table public.feedback_links
  add constraint feedback_links_tags_count check (cardinality(tags) <= 12);

alter table public.feedback_links
  drop constraint if exists feedback_links_tags_length;
alter table public.feedback_links
  add constraint feedback_links_tags_length check (public.text_array_max_length(tags) <= 24);

-- ----------------------------------------------------------------------------
-- 2. Rate limiting
-- ----------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  id          bigint generated always as identity primary key,
  scope       text not null,
  rl_key      text not null,
  created_at  timestamptz not null default now()
);

comment on table public.rate_limit_hits is
  'Sliding-window rate limit ledger for public endpoints. No RLS policies are defined here on purpose — nobody can read or write this table directly, including anon and authenticated. The only access path is check_rate_limit(), a SECURITY DEFINER function that is granted EXECUTE, not table access.';

create index if not exists rate_limit_hits_scope_key_created_idx
  on public.rate_limit_hits (scope, rl_key, created_at desc);

alter table public.rate_limit_hits enable row level security;
-- No policies are added. RLS enabled + zero policies = default deny for
-- every role except the table owner, which is exactly what we want: only
-- the SECURITY DEFINER function below (running as its owner) can touch it.

create or replace function public.check_rate_limit(
  p_scope text,
  p_key text,
  p_max_count int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Opportunistic cleanup so this table doesn't grow without bound. Cheap,
  -- indexed, and only runs some of the time — fine at this scale. For real
  -- production traffic, replace with a scheduled job (pg_cron) or move
  -- rate limiting to an edge/KV store (e.g. Upstash) instead.
  if random() < 0.02 then
    delete from public.rate_limit_hits where created_at < now() - interval '1 hour';
  end if;

  select count(*) into v_count
  from public.rate_limit_hits
  where scope = p_scope
    and rl_key = p_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_hits (scope, rl_key) values (p_scope, p_key);
  return true;
end;
$$;

comment on function public.check_rate_limit is
  'Records a hit for (scope, key) and returns false if the caller has already made p_max_count or more hits within the trailing p_window_seconds. Used to throttle the public feedback endpoints per (ip hash, feedback code) pair. SECURITY DEFINER so anon can call it without needing any grant on rate_limit_hits itself.';

revoke all on function public.check_rate_limit(text, text, int, int) from public;
grant execute on function public.check_rate_limit(text, text, int, int) to anon, authenticated;
