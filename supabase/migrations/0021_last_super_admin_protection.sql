-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Enhancement, Milestone A
-- Last Super Admin Protection
-- ============================================================================
-- Confirmed during audit: no such safeguard existed anywhere. This
-- migration adds ONE trigger function to the EXISTING
-- admin_role_assignments table — no new table, no change to the
-- existing self-escalation trigger from 0008 (which prevents a user
-- from touching their OWN row; this is a separate, complementary rule
-- about the LAST remaining active super_admin row, regardless of whose
-- it is).
--
-- Enforced here, at the database level, specifically because the
-- requirement says this "must NOT depend on frontend confirmation" —
-- a trigger is the one place this can never be bypassed, including by
-- a future bug in application code.
--
-- Run this AFTER 0001-0020, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create or replace function public.prevent_last_super_admin_removal()
returns trigger as $$
declare
  other_active_super_admins integer;
begin
  -- Only relevant when the row BEING CHANGED is currently an active
  -- (non-revoked) super_admin, and the change would either revoke it or
  -- demote it away from super_admin.
  if old.admin_role = 'super_admin' and old.revoked_at is null
     and (new.revoked_at is not null or new.admin_role <> 'super_admin') then

    select count(*) into other_active_super_admins
    from public.admin_role_assignments
    where admin_role = 'super_admin'
      and revoked_at is null
      and user_id <> old.user_id;

    if other_active_super_admins = 0 then
      raise exception 'Cannot remove or demote the last active Super Admin. At least one must remain.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.prevent_last_super_admin_removal is
  'Blocks any UPDATE that would leave the platform with zero active super_admin rows — revocation or role-change, regardless of actor. Complementary to the existing self-escalation trigger (0008), which only prevents a user from touching their own row; this rule is about the global count, not the actor.';

drop trigger if exists prevent_last_super_admin_removal_trigger on public.admin_role_assignments;
create trigger prevent_last_super_admin_removal_trigger
  before update on public.admin_role_assignments
  for each row execute procedure public.prevent_last_super_admin_removal();
