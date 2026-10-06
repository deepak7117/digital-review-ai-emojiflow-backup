-- ============================================================================
-- BD Clarity (by Banao Digital) — Super Admin Panel, Milestone 2 fix:
-- narrow function for admin-driven business status changes
-- ============================================================================
-- Fixes a real gap found during Milestone 2 testing: Milestone 1 added
-- businesses.status but no admin write path existed for it at all — the
-- only UPDATE policy on businesses is businesses_update_own (owner-scoped).
-- An Operations Admin's attempt to suspend an account was silently
-- filtered to zero rows by RLS.
--
-- Deliberately NOT fixed with a broad admin UPDATE policy on businesses,
-- which would let an authorized admin change ANY column (name, address,
-- Google review URL, etc.), not just status — RLS policies can't be
-- scoped to individual columns on their own. Instead: one narrow
-- SECURITY DEFINER function that touches only status, following the same
-- single-purpose-function pattern already used for is_admin(),
-- get_admin_role(), and check_rate_limit() elsewhere in this project.
--
-- Does not touch any existing table, column, constraint, trigger, or RLS
-- policy. No new direct GRANT UPDATE on businesses is added to any role —
-- this function is the ONLY path by which an admin can change status.
--
-- Run this AFTER 0001-0009, in the Supabase SQL editor, or via:
--   supabase db push
-- ============================================================================

create or replace function public.admin_set_business_status(
  p_business_id uuid,
  p_new_status public.business_status,
  p_reason text default null
)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id     uuid;
  v_caller_role   public.admin_role;
  v_old_status    public.business_status;
  v_result        public.businesses;
begin
  -- (1) Trusted identity: auth.uid() is resolved by Postgres from the
  -- caller's own JWT, never from a function parameter — there is no
  -- p_user_id or p_role argument for a caller to supply or forge.
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  -- (2) Trusted role lookup, straight from admin_role_assignments — never
  -- trusts a role claimed by the client. Only Super Admin and Operations
  -- Admin may change business status, per the approved permission matrix;
  -- Support Admin and Read-only Analyst are explicitly NOT authorized.
  select aa.admin_role into v_caller_role
  from public.admin_role_assignments aa
  where aa.user_id = v_caller_id and aa.revoked_at is null;

  if v_caller_role is null or v_caller_role not in ('super_admin', 'operations_admin') then
    raise exception 'Not authorized to change business status.';
  end if;

  -- (4) Validate inputs.
  if p_business_id is null then
    raise exception 'business_id is required.';
  end if;
  if p_new_status is null then
    raise exception 'new_status is required.';
  end if;
  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason must be 500 characters or fewer.';
  end if;

  select b.status into v_old_status from public.businesses b where b.id = p_business_id;
  if v_old_status is null then
    raise exception 'Business not found.';
  end if;

  -- (3) Updates ONLY the status column — no other business field is
  -- touched by this statement, and no other statement in this function
  -- writes to businesses at all.
  update public.businesses
  set status = p_new_status
  where id = p_business_id
  returning * into v_result;

  -- (5) Atomic with the status change: this function body is one
  -- implicit transaction, so if this insert raises for any reason (e.g. a
  -- future constraint on audit_logs), the status UPDATE above is rolled
  -- back too — there is no way for this function to return successfully
  -- with a status change but no corresponding audit entry.
  insert into public.audit_logs (admin_user_id, action, target_type, target_id, reason, result, metadata)
  values (
    v_caller_id,
    'set_business_status',
    'business',
    p_business_id,
    p_reason,
    'success',
    jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status)
  );

  return v_result;
end;
$$;

comment on function public.admin_set_business_status(uuid, public.business_status, text) is
  'The ONLY path by which an admin may change businesses.status. Verifies the caller''s admin tier from admin_role_assignments (never client-supplied), restricted to super_admin/operations_admin, updates only the status column, and writes the paired audit_logs row in the same transaction — both succeed or both fail.';

-- (6) Fixed, safe search_path already set above (`set search_path = public`);
-- every referenced object is schema-qualified with public. throughout.

-- (7) No direct UPDATE grant on businesses is added to any role — this
-- function is the only write path. Execute is granted ONLY to
-- authenticated (never anon: an unauthenticated caller has no auth.uid()
-- and would be rejected inside the function regardless, but there is no
-- reason to expose the RPC endpoint to anon at all).
revoke all on function public.admin_set_business_status(uuid, public.business_status, text) from public;
revoke all on function public.admin_set_business_status(uuid, public.business_status, text) from anon;
grant execute on function public.admin_set_business_status(uuid, public.business_status, text) to authenticated;

-- (8) No escalation vector: the function takes no role/user-id parameter,
-- so there is no input a caller — authorized or not — could supply to
-- act as a different admin or a higher tier than admin_role_assignments
-- actually grants them.
