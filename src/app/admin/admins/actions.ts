"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/adminClient";
import { getCurrentAdmin, hasCapability, writeAuditLog, ALL_CAPABILITIES } from "@/lib/admin/permissions";
import { createAdminNotification } from "@/app/admin/notificationActions";
import type { AdminRole } from "@/types/database";

const VALID_ROLES: AdminRole[] = ["super_admin", "support_admin", "operations_admin", "read_only_analyst"];

function isValidRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value);
}

async function requireManageAdmins() {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false as const, error: "Not authorized." };
  if (!hasCapability(admin.role, "manage_admin_roles")) {
    return { ok: false as const, error: "You do not have permission to manage administrators." };
  }
  return { ok: true as const, admin };
}

export interface AdminListItem {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
  revokedAt: string | null;
  grantedAt: string;
  grantedByEmail: string | null;
  profileCreatedAt: string | null;
}

/** Any admin with manage_admin_roles may view this — the same capability that gates every mutation below. */
export async function listAdmins(): Promise<{ data: AdminListItem[] } | { error: string }> {
  const gate = await requireManageAdmins();
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const { data: assignments, error } = await supabase
    .from("admin_role_assignments")
    .select("user_id, admin_role, revoked_at, granted_at, granted_by")
    .order("granted_at", { ascending: false });

  if (error) return { error: error.message };
  if (!assignments || assignments.length === 0) return { data: [] };

  const userIds = assignments.map((a) => a.user_id);
  const granterIds = assignments.map((a) => a.granted_by).filter((id): id is string => Boolean(id));
  const allIds = Array.from(new Set([...userIds, ...granterIds]));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email, full_name, created_at")
    .in("user_id", allIds.length > 0 ? allIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return {
    data: assignments.map((a) => ({
      userId: a.user_id,
      email: profileByUserId.get(a.user_id)?.email ?? null,
      fullName: profileByUserId.get(a.user_id)?.full_name ?? null,
      role: a.admin_role,
      revokedAt: a.revoked_at,
      grantedAt: a.granted_at,
      grantedByEmail: a.granted_by ? (profileByUserId.get(a.granted_by)?.email ?? null) : null,
      profileCreatedAt: profileByUserId.get(a.user_id)?.created_at ?? null,
    })),
  };
}

export interface AdminDetail extends AdminListItem {
  /** The effective capabilities for this admin's CURRENT role, from the existing capability matrix — never a second permission calculation. */
  capabilities: string[];
  recentActivity: { action: string; targetType: string | null; result: string; createdAt: string }[];
}

export async function getAdminDetail(userId: unknown): Promise<{ data: AdminDetail } | { error: string }> {
  const gate = await requireManageAdmins();
  if (!gate.ok) return { error: gate.error };
  if (typeof userId !== "string" || !userId) return { error: "Invalid admin." };

  const listResult = await listAdmins();
  if ("error" in listResult) return listResult;
  const found = listResult.data.find((a) => a.userId === userId);
  if (!found) return { error: "Admin not found." };

  const capabilities = ALL_CAPABILITIES.filter((c) => hasCapability(found.role, c));

  const supabase = await createClient();
  const { data: activity } = await supabase
    .from("audit_logs")
    .select("action, target_type, result, created_at")
    .eq("admin_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    data: {
      ...found,
      capabilities,
      recentActivity: (activity ?? []).map((a) => ({
        action: a.action,
        targetType: a.target_type,
        result: a.result,
        createdAt: a.created_at,
      })),
    },
  };
}

/**
 * Creates a new admin using Supabase's own native invite mechanism —
 * BD Clarity's code never generates, stores, or even sees a password.
 * The invited user receives Supabase's own hosted email and sets their
 * password through Supabase's own flow, not anything built here.
 */
export async function createAdmin(
  email: unknown,
  role: unknown
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireManageAdmins();
  if (!gate.ok) return { error: gate.error };

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email address is required." };
  }
  if (!isValidRole(role)) return { error: "Invalid role." };

  if (!isServiceRoleConfigured()) {
    return {
      error:
        "Secure admin creation requires SUPABASE_SERVICE_ROLE_KEY, which is not configured in this environment.",
    };
  }
  const serviceClient = createServiceRoleClient();
  if (!serviceClient) return { error: "Admin creation is not available right now." };

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    await writeAuditLog({
      adminUserId: gate.admin.userId,
      action: "admin_create",
      targetType: "admin",
      reason: email,
      result: "failure",
      metadata: { error: inviteError?.message },
    });
    return { error: inviteError?.message ?? "Could not create the admin account." };
  }

  const newUserId = invited.user.id;
  const supabase = await createClient();

  // handle_new_user() (0001) auto-creates a profiles row the instant
  // Supabase's own invite creates the auth.users row, but always with
  // the column default role ('business_owner') — it has no way to know
  // this particular signup is an admin invite. profiles RLS has no
  // admin-write policy at all (confirmed live: the normal client
  // rejected this exact write with an RLS violation when tested against
  // real Postgres before this fix) — self-update only. This one
  // specific write genuinely requires the service-role client; every
  // other write in this flow (admin_role_assignments, audit_logs) goes
  // through the normal, RLS-respecting client as usual, since those
  // tables already have real super_admin-write policies.
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("user_id", newUserId);

  if (profileError) {
    await writeAuditLog({
      adminUserId: gate.admin.userId,
      action: "admin_create",
      targetType: "admin",
      targetId: newUserId,
      reason: email,
      result: "failure",
      metadata: { error: profileError.message, step: "profile_role_update" },
    });
    return { error: profileError.message };
  }

  const { error: assignError } = await supabase
    .from("admin_role_assignments")
    .insert({ user_id: newUserId, admin_role: role, granted_by: gate.admin.userId });

  if (assignError) {
    await writeAuditLog({
      adminUserId: gate.admin.userId,
      action: "admin_create",
      targetType: "admin",
      targetId: newUserId,
      reason: email,
      result: "failure",
      metadata: { error: assignError.message },
    });
    return { error: assignError.message };
  }

  await writeAuditLog({
    adminUserId: gate.admin.userId,
    action: "admin_create",
    targetType: "admin",
    targetId: newUserId,
    result: "success",
    metadata: { email, role },
  });

  return { ok: true };
}

export async function changeAdminRole(
  userId: unknown,
  newRole: unknown
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireManageAdmins();
  if (!gate.ok) return { error: gate.error };
  if (typeof userId !== "string" || !userId) return { error: "Invalid admin." };
  if (!isValidRole(newRole)) return { error: "Invalid role." };

  // Defense in depth, same spirit as everywhere else in this project —
  // the real, unconditional enforcement is the database trigger from
  // 0008 (self-escalation) and 0021 (last Super Admin), which apply
  // regardless of this check.
  if (userId === gate.admin.userId) {
    return { error: "You cannot change your own admin role." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_role_assignments")
    .update({ admin_role: newRole })
    .eq("user_id", userId);

  if (error) {
    await writeAuditLog({
      adminUserId: gate.admin.userId,
      action: "admin_role_change",
      targetType: "admin",
      targetId: userId,
      result: "failure",
      metadata: { error: error.message, attemptedRole: newRole },
    });
    return { error: error.message };
  }

  await writeAuditLog({
    adminUserId: gate.admin.userId,
    action: "admin_role_change",
    targetType: "admin",
    targetId: userId,
    result: "success",
    metadata: { newRole },
  });

  await createAdminNotification({
    eventType: "admin_role_changed",
    title: `Admin role changed to ${newRole}`,
    targetType: "admin",
    targetId: userId,
    actorAdminId: gate.admin.userId,
    metadata: { newRole },
  });

  return { ok: true };
}

export async function revokeAdmin(userId: unknown): Promise<{ ok: true } | { error: string }> {
  const gate = await requireManageAdmins();
  if (!gate.ok) return { error: gate.error };
  if (typeof userId !== "string" || !userId) return { error: "Invalid admin." };

  if (userId === gate.admin.userId) {
    return { error: "You cannot revoke your own admin access." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_role_assignments")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    await writeAuditLog({
      adminUserId: gate.admin.userId,
      action: "admin_revoke",
      targetType: "admin",
      targetId: userId,
      result: "failure",
      metadata: { error: error.message },
    });
    return { error: error.message };
  }

  await writeAuditLog({
    adminUserId: gate.admin.userId,
    action: "admin_revoke",
    targetType: "admin",
    targetId: userId,
    result: "success",
  });

  await createAdminNotification({
    eventType: "admin_role_changed",
    title: "Admin access revoked",
    targetType: "admin",
    targetId: userId,
    actorAdminId: gate.admin.userId,
  });

  return { ok: true };
}

/**
 * Restores a revoked admin. Per the soft-revoke architecture, this
 * clears revoked_at on the SAME historical row — admin_role_assignments
 * has a unique constraint on user_id, so there is exactly one row per
 * user to restore, never a fresh duplicate. History is preserved
 * because nothing is deleted; granted_at/granted_by from the original
 * assignment remain exactly as they were.
 */
export async function restoreAdmin(
  userId: unknown,
  role: unknown
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireManageAdmins();
  if (!gate.ok) return { error: gate.error };
  if (typeof userId !== "string" || !userId) return { error: "Invalid admin." };
  if (!isValidRole(role)) return { error: "Invalid role." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_role_assignments")
    .update({ revoked_at: null, admin_role: role, granted_by: gate.admin.userId })
    .eq("user_id", userId);

  if (error) {
    await writeAuditLog({
      adminUserId: gate.admin.userId,
      action: "admin_restore",
      targetType: "admin",
      targetId: userId,
      result: "failure",
      metadata: { error: error.message },
    });
    return { error: error.message };
  }

  await writeAuditLog({
    adminUserId: gate.admin.userId,
    action: "admin_restore",
    targetType: "admin",
    targetId: userId,
    result: "success",
    metadata: { role },
  });

  await createAdminNotification({
    eventType: "admin_role_changed",
    title: `Admin access restored as ${role}`,
    targetType: "admin",
    targetId: userId,
    actorAdminId: gate.admin.userId,
    metadata: { role },
  });

  return { ok: true };
}
