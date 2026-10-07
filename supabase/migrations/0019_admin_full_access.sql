-- ============================================================================
-- Admin full access: admin team management + business edit/delete
-- ============================================================================
-- Adds FOUR narrow SECURITY DEFINER functions. Changes no existing table,
-- column, policy, or trigger. Same single-purpose-function pattern as
-- admin_set_business_status() (0010): the caller's tier is always read from
-- admin_role_assignments via auth.uid(), never from a parameter, and every
-- function writes its audit_logs row in the same transaction.
--
-- Run AFTER 0001-0018, in the Supabase SQL editor, or via: supabase db push
-- ============================================================================

-- Internal helper: caller's active tier (null if none).
create or replace function public._caller_admin_role()
returns public.admin_role
language sql
security definer
stable
set search_path = public
as $$
  select admin_role from public.admin_role_assignments
  where user_id = auth.uid() and revoked_at is null;
$$;
revoke all on function public._caller_admin_role() from public, anon;
grant execute on function public._caller_admin_role() to authenticated;

-- ----------------------------------------------------------------------------
-- admin_grant_role: make an existing user an admin, or change an admin's tier.
-- Super Admin only. Cannot target yourself. Cannot demote the last Super Admin.
-- ----------------------------------------------------------------------------
create or replace function public.admin_grant_role(p_email text, p_role public.admin_role)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target uuid;
  v_old    public.admin_role;
begin
  if v_caller is null then raise exception 'Not authenticated.'; end if;
  if public._caller_admin_role() is distinct from 'super_admin' then
    raise exception 'Only Super Admin can manage admin roles.';
  end if;

  select user_id into v_target from public.profiles where lower(email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'No account found with that email. The person must sign up first.';
  end if;
  if v_target = v_caller then
    raise exception 'You cannot change your own admin role.';
  end if;

  select admin_role into v_old from public.admin_role_assignments
  where user_id = v_target and revoked_at is null;

  if v_old = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from public.admin_role_assignments
          where admin_role = 'super_admin' and revoked_at is null) <= 1 then
    raise exception 'Cannot demote the last Super Admin.';
  end if;

  update public.profiles set role = 'admin' where user_id = v_target;

  insert into public.admin_role_assignments (user_id, admin_role, granted_by, granted_at, revoked_at)
  values (v_target, p_role, v_caller, now(), null)
  on conflict (user_id) do update
    set admin_role = excluded.admin_role,
        granted_by = excluded.granted_by,
        granted_at = now(),
        revoked_at = null;

  insert into public.audit_logs (admin_user_id, action, target_type, target_id, result, metadata)
  values (v_caller, 'grant_admin_role', 'user', v_target, 'success',
          jsonb_build_object('old_role', v_old, 'new_role', p_role));

  return v_target;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_revoke_role: remove admin access. Super Admin only; not yourself;
-- not the last Super Admin. Soft-revokes (history kept) and returns the
-- profile to business_owner.
-- ----------------------------------------------------------------------------
create or replace function public.admin_revoke_role(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_old    public.admin_role;
begin
  if v_caller is null then raise exception 'Not authenticated.'; end if;
  if public._caller_admin_role() is distinct from 'super_admin' then
    raise exception 'Only Super Admin can manage admin roles.';
  end if;
  if p_user_id = v_caller then
    raise exception 'You cannot revoke your own admin access.';
  end if;

  select admin_role into v_old from public.admin_role_assignments
  where user_id = p_user_id and revoked_at is null;
  if v_old is null then raise exception 'That user is not an active admin.'; end if;

  if v_old = 'super_admin'
     and (select count(*) from public.admin_role_assignments
          where admin_role = 'super_admin' and revoked_at is null) <= 1 then
    raise exception 'Cannot revoke the last Super Admin.';
  end if;

  update public.admin_role_assignments set revoked_at = now() where user_id = p_user_id;
  update public.profiles set role = 'business_owner' where user_id = p_user_id;

  insert into public.audit_logs (admin_user_id, action, target_type, target_id, result, metadata)
  values (v_caller, 'revoke_admin_role', 'user', p_user_id, 'success',
          jsonb_build_object('old_role', v_old));

  return p_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_update_business: edit a business's profile fields.
-- Super Admin + Operations Admin. Does not touch owner_id or status.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_business(
  p_business_id uuid,
  p_business_name text,
  p_category text,
  p_phone text,
  p_email text,
  p_address text,
  p_city text,
  p_website text,
  p_google_review_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'Not authenticated.'; end if;
  if public._caller_admin_role() is null
     or public._caller_admin_role() not in ('super_admin', 'operations_admin') then
    raise exception 'Not authorized to edit businesses.';
  end if;
  if p_business_name is null or length(trim(p_business_name)) = 0 then
    raise exception 'Business name is required.';
  end if;

  update public.businesses set
    business_name = trim(p_business_name),
    category = nullif(trim(p_category), ''),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email), ''),
    address = nullif(trim(p_address), ''),
    city = nullif(trim(p_city), ''),
    website = nullif(trim(p_website), ''),
    google_review_url = nullif(trim(p_google_review_url), '')
  where id = p_business_id;
  if not found then raise exception 'Business not found.'; end if;

  insert into public.audit_logs (admin_user_id, action, target_type, target_id, result)
  values (v_caller, 'edit_business_details', 'business', p_business_id, 'success');

  return p_business_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_delete_business: permanently delete a business (cascades to its
-- feedback, QR links, etc. via existing FKs). Super Admin only. Audit row is
-- written BEFORE the delete and records the name, since the row will be gone.
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_business(p_business_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_name   text;
begin
  if v_caller is null then raise exception 'Not authenticated.'; end if;
  if public._caller_admin_role() is distinct from 'super_admin' then
    raise exception 'Only Super Admin can delete a business.';
  end if;
  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason must be 500 characters or fewer.';
  end if;

  select business_name into v_name from public.businesses where id = p_business_id;
  if v_name is null then raise exception 'Business not found.'; end if;

  insert into public.audit_logs (admin_user_id, action, target_type, target_id, reason, result, metadata)
  values (v_caller, 'delete_business', 'business', p_business_id, p_reason, 'success',
          jsonb_build_object('business_name', v_name));

  delete from public.businesses where id = p_business_id;
  return p_business_id;
end;
$$;

-- Execute: authenticated only (each function re-verifies the tier itself).
do $$
declare f text;
begin
  foreach f in array array[
    'admin_grant_role(text, public.admin_role)',
    'admin_revoke_role(uuid)',
    'admin_update_business(uuid, text, text, text, text, text, text, text, text)',
    'admin_delete_business(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
