import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The ONE place in this codebase that uses SUPABASE_SERVICE_ROLE_KEY —
 * an env var this project has documented as required since Module 1,
 * but never actually wired into any code until now. This client
 * bypasses RLS entirely, so it is used for exactly one narrow purpose:
 * Supabase's own native `auth.admin.inviteUserByEmail()` call, needed
 * to create a new admin's auth.users row and send them Supabase's own
 * secure, hosted invite/set-password email — BD Clarity's own code
 * never generates, stores, or sees a password at any point.
 *
 * Deliberately NOT a general-purpose "admin database client" — every
 * other operation in this file's caller (profiles, admin_role_assignments,
 * audit_logs inserts) still goes through the normal, RLS-respecting
 * server client, with the standard capability/authorization checks.
 * This client is reached only after those checks already passed.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
