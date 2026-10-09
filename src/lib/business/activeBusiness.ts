import "server-only";
import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const ACTIVE_BUSINESS_COOKIE = "bd_active_business";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

export interface BusinessSummary {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
}

export interface ActiveBusinessResult {
  business: BusinessRow | null;
  availableBusinesses: BusinessSummary[];
  multistoreEnabled: boolean;
  maxBusinesses: number;
  /** True when this owner has an entitlement row and its subscription_status isn't 'active' — e.g. suspended/expired/disabled. Business creation is blocked in this state regardless of counts. */
  subscriptionBlocked: boolean;
  subscriptionStatus: "active" | "expired" | "suspended" | "disabled" | null;
}

type EntitlementRow = {
  subscription_status: "active" | "expired" | "suspended" | "disabled";
  multi_business_enabled: boolean;
  max_businesses: number;
} | null;

/**
 * The single, shared computation for "what is this owner actually
 * allowed" — used by both getActiveBusiness() (so the switcher/UI can
 * show the true limit) and createBusiness() (the real enforcement),
 * so this logic exists in exactly one place rather than two drifting
 * copies.
 *
 * An owner with no entitlement row (entitlement === null) is "not yet
 * individually configured" — a temporary Phase 1 compatibility
 * behavior, not a final subscription rule (see 0019's migration
 * comment) — and gets exactly the platform-only ceiling, nothing
 * stricter. Once a row exists, it can only ever RESTRICT relative to
 * the platform ceiling, never exceed it.
 */
export function computeEffectiveEntitlement(
  platformEnabled: boolean,
  platformMax: number,
  entitlement: EntitlementRow
): {
  multistoreEnabled: boolean;
  maxBusinesses: number;
  subscriptionBlocked: boolean;
  subscriptionStatus: "active" | "expired" | "suspended" | "disabled" | null;
} {
  if (!entitlement) {
    return {
      multistoreEnabled: platformEnabled,
      maxBusinesses: platformMax,
      subscriptionBlocked: false,
      subscriptionStatus: null,
    };
  }
  return {
    multistoreEnabled: platformEnabled && entitlement.multi_business_enabled,
    maxBusinesses: Math.min(entitlement.max_businesses, platformMax),
    subscriptionBlocked: entitlement.subscription_status !== "active",
    subscriptionStatus: entitlement.subscription_status,
  };
}

/**
 * Resolves "the business this request should operate on," replacing the
 * ~20 call sites that used to do .eq("owner_id", user.id).maybeSingle()
 * directly.
 *
 * SECURITY: the active-business cookie is NEVER used in a database
 * query. It only selects an entry out of `businesses`, an array already
 * fetched with a query scoped to `owner_id = user.id` (and protected by
 * the existing businesses RLS policy regardless). If the cookie names a
 * business this owner doesn't actually own, `.find()` simply returns
 * undefined and this safely falls back to the owner's first business —
 * the cookie can influence which of the owner's OWN businesses is
 * chosen, never grant access to anyone else's.
 */
export async function getActiveBusiness(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ActiveBusinessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [settingsResult, businessesResult, entitlementResult] = await Promise.all([
    supabase
      .from("platform_settings")
      .select("multistore_enabled, max_businesses_per_owner")
      .eq("id", true)
      .maybeSingle(),
    user
      ? supabase
          .from("businesses")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("owner_entitlements")
          .select("subscription_status, multi_business_enabled, max_businesses")
          .eq("owner_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const platformEnabled = settingsResult.data?.multistore_enabled ?? true;
  const platformMax = settingsResult.data?.max_businesses_per_owner ?? 4;
  const effective = computeEffectiveEntitlement(platformEnabled, platformMax, entitlementResult.data ?? null);
  const businesses = businessesResult.data ?? [];

  if (businesses.length === 0) {
    return {
      business: null,
      availableBusinesses: [],
      multistoreEnabled: effective.multistoreEnabled,
      maxBusinesses: effective.maxBusinesses,
      subscriptionBlocked: effective.subscriptionBlocked,
      subscriptionStatus: effective.subscriptionStatus,
    };
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const selected = selectedId ? businesses.find((b) => b.id === selectedId) : undefined;
  const active = selected ?? businesses[0];

  return {
    business: active,
    availableBusinesses: businesses.map((b) => ({
      id: b.id,
      businessName: b.business_name,
      category: b.category,
      city: b.city,
    })),
    multistoreEnabled: effective.multistoreEnabled,
    maxBusinesses: effective.maxBusinesses,
    subscriptionBlocked: effective.subscriptionBlocked,
    subscriptionStatus: effective.subscriptionStatus,
  };
}

/**
 * Convenience wrapper for the very common case: just the active
 * business's id (or null), for callers that only need to scope a query
 * and don't need the full switcher data.
 */
export async function getActiveBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { business } = await getActiveBusiness(supabase);
  return business?.id ?? null;
}
