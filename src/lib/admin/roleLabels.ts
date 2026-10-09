import type { AdminRole } from "@/types/database";

/**
 * Plain data, no server-only dependency — deliberately split out of
 * permissions.ts (which imports "server-only") so client components
 * like AdminManagementTable can display role labels without pulling in
 * anything server-restricted. permissions.ts re-exports this same
 * constant so existing server-side call sites are unaffected.
 */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
  operations_admin: "Operations Admin",
  read_only_analyst: "Read-only Analyst",
};
