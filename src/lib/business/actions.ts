"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/business/activeBusiness";

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
export async function createBusiness(
  input: CreateBusinessInput
): Promise<{ ok: true; businessId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("multistore_enabled, max_businesses_per_owner")
    .eq("id", true)
    .maybeSingle();

  const multistoreEnabled = settings?.multistore_enabled ?? true;
  const maxBusinesses = settings?.max_businesses_per_owner ?? 4;

  if (!multistoreEnabled) {
    return { error: "Adding additional businesses is currently disabled." };
  }

  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if ((count ?? 0) >= maxBusinesses) {
    return { error: `You've reached your current ${maxBusinesses}-business limit.` };
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
