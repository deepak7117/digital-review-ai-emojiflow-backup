import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/types/database";

/**
 * The Super Admin Panel's permission layer.
 *
 * Two-tier design, deliberate:
 *   - profiles.role = 'admin' (Module 1) is the coarse platform gate —
 *     unchanged, still what every existing "_select_admin" RLS policy
 *     depends on across 9 tables.
 *   - admin_role_assignments (this milestone) is a finer-grained tier on
 *     TOP of that gate, consulted only by admin-panel pages/actions.
 * A user needs both: profiles.role='admin' to see admin-readable data at
 * all (existing RLS), and an active admin_role_assignments row to use any
 * tiered admin-panel feature (new, this file).
 *
 * Every capability check below mirrors a real RLS policy or a real,
 * documented product decision — this file is defense in depth alongside
 * the database, exactly like every other server action in this project
 * (e.g. `.eq("business_id", owned.businessId)` alongside RLS), never a
 * substitute for it.
 */

// Re-exported from roleLabels.ts (a plain-data file with no server-only
// dependency) — moved there so client components can use the same
// labels without pulling in this server-only module. Every existing
// import of ADMIN_ROLE_LABELS from this file keeps working unchanged.
export { ADMIN_ROLE_LABELS } from "@/lib/admin/roleLabels";

export type AdminCapability =
  | "view_dashboard"
  | "manage_business_status"
  | "manage_branches"
  | "support_access_sessions"
  | "manage_support_notes"
  | "manage_admin_roles"
  | "manage_platform_settings";

/**
 * The approved permission matrix. Kept as one explicit table (not
 * scattered `if (role === ...)` checks through the codebase) so it can be
 * reviewed and changed in one place as future milestones add rows.
 */
const PERMISSION_MATRIX: Record<AdminRole, Set<AdminCapability>> = {
  super_admin: new Set([
    "view_dashboard",
    "manage_business_status",
    "manage_branches",
    "support_access_sessions",
    "manage_support_notes",
    "manage_admin_roles",
    "manage_platform_settings",
  ]),
  operations_admin: new Set([
    "view_dashboard",
    "manage_business_status",
    "manage_branches",
    "support_access_sessions",
    "manage_support_notes",
  ]),
  support_admin: new Set(["view_dashboard", "support_access_sessions", "manage_support_notes"]),
  read_only_analyst: new Set(["view_dashboard"]),
};

export function hasCapability(role: AdminRole | null, capability: AdminCapability): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[role].has(capability);
}

/** The full capability list, derived from the matrix itself rather than hand-maintained separately — used by Admin Management to show an admin's effective capabilities without a second, independent permission calculation. */
export const ALL_CAPABILITIES: AdminCapability[] = Array.from(
  new Set(Object.values(PERMISSION_MATRIX).flatMap((set) => Array.from(set)))
);

export interface CurrentAdmin {
  userId: string;
  role: AdminRole;
}

/**
 * Resolves the caller's admin tier, or null if they have none (not an
 * admin at all, or an admin with no active — i.e. not revoked —
 * assignment). Always derived server-side from the session; never trusts
 * anything client-supplied.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return null;

  const { data: assignment } = await supabase
    .from("admin_role_assignments")
    .select("admin_role")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!assignment) return null;

  return { userId: user.id, role: assignment.admin_role };
}

/**
 * Writes one audit_logs row. Never throws — a logging failure must not
 * block the admin action it's describing; it's reported to the server
 * console instead, same non-blocking-failure pattern already used for
 * feedback_question_answers in the Milestone F submit flow.
 *
 * `adminUserId` is required explicitly (not re-derived here) so callers
 * always pass the same id they just used for their real permission check,
 * avoiding a second, possibly-stale auth lookup.
 */
export async function writeAuditLog(params: {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  result?: "success" | "failure";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_logs").insert({
      admin_user_id: params.adminUserId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      reason: params.reason ?? null,
      result: params.result ?? "success",
      metadata: params.metadata ?? null,
    });
    if (error) {
      console.error("audit_logs insert failed (non-fatal):", error.message);
    }
  } catch (err) {
    console.error("audit_logs insert threw (non-fatal):", err);
  }
}
