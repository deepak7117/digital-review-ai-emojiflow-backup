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

  const [settingsResult, businessesResult] = await Promise.all([
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
  ]);

  const multistoreEnabled = settingsResult.data?.multistore_enabled ?? true;
  const maxBusinesses = settingsResult.data?.max_businesses_per_owner ?? 4;
  const businesses = businessesResult.data ?? [];

  if (businesses.length === 0) {
    return { business: null, availableBusinesses: [], multistoreEnabled, maxBusinesses };
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
    multistoreEnabled,
    maxBusinesses,
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
