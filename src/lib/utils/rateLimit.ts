import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

/**
 * Returns a stable, non-reversible-in-practice hash of the caller's IP, for
 * use only as a rate-limit bucket key — never stored alongside the
 * feedback content itself, and never logged.
 *
 * Reads standard proxy headers (works behind Vercel/most hosts). Falls back
 * to a shared "unknown" bucket if no IP header is present, which still
 * limits abuse from clients that don't forward one, just less precisely.
 */
export async function getClientIpHash(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Checks and records a rate-limit hit for (scope, key) via the
 * check_rate_limit() Postgres function (see
 * supabase/migrations/0003_module2_hardening.sql). That function is
 * SECURITY DEFINER over a table anon has no direct access to, so this is
 * the only way to touch it — nothing here weakens RLS.
 *
 * Fails OPEN (allows the request) if the RPC itself errors, so a
 * misconfigured or not-yet-migrated database doesn't take down the public
 * feedback flow — this is a defense-in-depth abuse guard, not the only
 * layer of protection (RLS + input validation still apply regardless).
 */
export async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: string,
  key: string,
  maxCount: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_scope: scope,
    p_key: key,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("check_rate_limit RPC failed, failing open:", error.message);
    return true;
  }

  return data === true;
}
