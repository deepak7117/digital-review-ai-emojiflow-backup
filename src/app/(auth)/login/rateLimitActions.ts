"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIpHash } from "@/lib/utils/rateLimit";

/**
 * Login attempt throttling. Reuses the existing check_rate_limit()
 * Postgres function — already database-backed (a shared table, not a
 * per-process in-memory counter), so this is correct across multiple
 * application instances without any new infrastructure. Two
 * independent buckets, both must pass:
 *   - per IP: stops one source hammering many different accounts.
 *   - per email: stops credential-stuffing against one specific
 *     account from many different IPs/sources.
 * Same fail-open philosophy as the existing utility's own doc comment
 * (a misconfigured/unmigrated database shouldn't lock everyone out of
 * login entirely) — this is a defense-in-depth abuse guard layered on
 * top of Supabase's own password check, not a replacement for it.
 */
export async function checkLoginAllowed(email: unknown): Promise<{ allowed: boolean }> {
  if (typeof email !== "string" || !email.trim()) return { allowed: true };

  const supabase = await createClient();
  const emailKey = email.trim().toLowerCase();

  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(supabase, "login_attempt_ip", await getClientIpHash(), 10, 300),
    checkRateLimit(supabase, "login_attempt_email", emailKey, 5, 300),
  ]);

  return { allowed: ipOk && emailOk };
}
