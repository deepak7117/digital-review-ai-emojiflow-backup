"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BUSINESS_COOKIE, computeEffectiveEntitlement } from "@/lib/business/activeBusiness";

/**
 * Sets which business is active. The business id is re-validated
 * against the real, RLS-protected `businesses` table — scoped to the
 * authenticated owner — BEFORE the cookie is ever written. The cookie
 * only ever ends up holding a business id this specific request already
 * confirmed belongs to this owner; it is never trusted on its own
 * afterward either (getActiveBusiness re-derives the owner's business
 * list fresh on every read and only uses the cookie to pick among them).
 */
export async function setActiveBusiness(
  businessId: unknown
): Promise<{ ok: true } | { error: string }> {
  if (typeof businessId !== "string" || !businessId) {
    return { error: "Invalid business." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!business) return { error: "You don't have access to that business." };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export interface CreateBusinessInput {
  businessName: unknown;
  category: unknown;
  city: unknown;
}

/**
 * Creates an additional business for an owner who already has at least
 * one. The limit and the enabled flag are both re-checked here, fresh,
 * server-side — never trusted from anything the client computed or
 * displayed (the switcher's own "at limit" UI is just a courtesy; this
 * is the real enforcement).
 */
export type CreateBusinessBlockReason = "subscription_blocked" | "disabled" | "limit_reached";

export async function createBusiness(
  input: CreateBusinessInput
): Promise<
  { ok: true; businessId: string } | { error: string; reason?: CreateBusinessBlockReason }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const [settingsResult, entitlementResult] = await Promise.all([
    supabase
      .from("platform_settings")
      .select("multistore_enabled, max_businesses_per_owner")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("owner_entitlements")
      .select("subscription_status, multi_business_enabled, max_businesses")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const platformEnabled = settingsResult.data?.multistore_enabled ?? true;
  const platformMax = settingsResult.data?.max_businesses_per_owner ?? 4;

  // Single shared computation (src/lib/business/activeBusiness.ts),
  // also used by getActiveBusiness() for the UI — not a second copy of
  // this logic. An owner with no entitlement row is "not yet
  // individually configured" — a temporary Phase 1 compatibility
  // behavior, not a final subscription rule — and gets exactly the
  // platform ceiling alone, nothing stricter.
  const effective = computeEffectiveEntitlement(platformEnabled, platformMax, entitlementResult.data ?? null);

  if (effective.subscriptionBlocked) {
    return {
      error:
        effective.subscriptionStatus === "expired"
          ? "Your subscription has expired. Contact Banao Digital to renew."
          : "Your account access is currently restricted. Contact Banao Digital for assistance.",
      reason: "subscription_blocked",
    };
  }

  const multistoreEnabled = effective.multistoreEnabled;
  const maxBusinesses = effective.maxBusinesses;

  if (!multistoreEnabled) {
    return { error: "Adding additional businesses is currently disabled.", reason: "disabled" };
  }

  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if ((count ?? 0) >= maxBusinesses) {
    return {
      error: `You've reached your current ${maxBusinesses}-business limit.`,
      reason: "limit_reached",
    };
  }

  const businessName = typeof input.businessName === "string" ? input.businessName.trim().slice(0, 200) : "";
  if (!businessName) return { error: "Business name is required." };
  const category = typeof input.category === "string" ? input.category.trim().slice(0, 100) : null;
  const city = typeof input.city === "string" ? input.city.trim().slice(0, 100) : null;

  const { data: created, error } = await supabase
    .from("businesses")
    .insert({ owner_id: user.id, business_name: businessName, category, city })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard", "layout");
  return { ok: true, businessId: created.id };
}
