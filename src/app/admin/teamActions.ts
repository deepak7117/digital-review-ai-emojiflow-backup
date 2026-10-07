"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin, hasCapability } from "@/lib/admin/permissions";
import type { AdminRole } from "@/types/database";

const ROLES: AdminRole[] = ["super_admin", "operations_admin", "support_admin", "read_only_analyst"];

export interface AdminTeamMember {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
  grantedAt: string;
}

export async function listAdminTeam(): Promise<{ data: AdminTeamMember[] } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "manage_admin_roles")) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_role_assignments")
    .select("user_id, admin_role, granted_at")
    .is("revoked_at", null)
    .order("granted_at", { ascending: true });
  if (error) return { error: error.message };

  const ids = (data ?? []).map((a) => a.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email, full_name")
    .in("user_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return {
    data: (data ?? []).map((a) => ({
      userId: a.user_id,
      email: byId.get(a.user_id)?.email ?? null,
      fullName: byId.get(a.user_id)?.full_name ?? null,
      role: a.admin_role,
      grantedAt: a.granted_at,
    })),
  };
}

/** Grant admin access to an existing account, or change an admin's tier. Super Admin only. */
export async function grantAdminRole(email: unknown, role: unknown): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "manage_admin_roles")) return { error: "Not authorized." };
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) return { error: "Enter a valid email." };
  if (typeof role !== "string" || !ROLES.includes(role as AdminRole)) return { error: "Invalid role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_role", { p_email: email.trim(), p_role: role as AdminRole });
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { ok: true };
}

export async function revokeAdminRole(userId: unknown): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "manage_admin_roles")) return { error: "Not authorized." };
  if (typeof userId !== "string" || !userId) return { error: "Invalid user." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_role", { p_user_id: userId });
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { ok: true };
}
