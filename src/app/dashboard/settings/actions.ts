"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidThemeId } from "@/lib/branding/themes";
import { getActiveBusinessId, getActiveBusiness } from "@/lib/business/activeBusiness";

async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  return getActiveBusinessId(supabase);
}

export interface SettingsSummary {
  businessName: string | null;
  category: string | null;
  logoUrl: string | null;
  brandTheme: string;
  googleConnected: boolean;
  googleLocationName: string | null;
  qrActive: boolean;
  qrCode: string | null;
  email: string;
}

/**
 * Aggregates data for the Settings hub's summary cards. Deliberately
 * reuses existing tables only — businesses (profile/brand fields),
 * google_business_connections (already built), feedback_links (already
 * built). No new table, no new query pattern invented for this.
 */
export async function getSettingsSummary(): Promise<SettingsSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { business } = await getActiveBusiness(supabase);

  if (!business) {
    return {
      businessName: null,
      category: null,
      logoUrl: null,
      brandTheme: "default",
      googleConnected: false,
      googleLocationName: null,
      qrActive: false,
      qrCode: null,
      email: user.email ?? "",
    };
  }

  const [connection, link] = await Promise.all([
    supabase
      .from("google_business_connections")
      .select("google_location_name")
      .eq("business_id", business.id)
      .eq("status", "connected")
      .maybeSingle(),
    supabase
      .from("feedback_links")
      .select("public_code, is_active")
      .eq("business_id", business.id)
      .maybeSingle(),
  ]);

  return {
    businessName: business.business_name,
    category: business.category,
    logoUrl: business.logo_url,
    brandTheme: business.brand_theme,
    googleConnected: Boolean(connection.data),
    googleLocationName: connection.data?.google_location_name ?? null,
    qrActive: Boolean(link.data?.is_active),
    qrCode: link.data?.public_code ?? null,
    email: user.email ?? "",
  };
}

/**
 * Persists the two genuinely-supported Brand & Experience fields.
 * logo_url is a plain URL (text), not a file upload — this project has
 * no file-storage infrastructure, and building a fake upload control
 * that doesn't actually store a file would violate the explicit
 * no-fake-functionality requirement. brand_theme is restricted to the
 * curated set in src/lib/branding/themes.ts, validated here AND by the
 * database CHECK constraint (defense in depth, same pattern used
 * throughout this project).
 */
export async function updateBrandSettings(
  logoUrl: unknown,
  themeId: unknown
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const businessId = await getOwnedBusinessId(supabase);
  if (!businessId) return { error: "Set up your business profile first." };

  if (!isValidThemeId(themeId)) {
    return { error: "Invalid theme selected." };
  }

  const trimmedLogoUrl = typeof logoUrl === "string" ? logoUrl.trim().slice(0, 500) : "";
  if (trimmedLogoUrl && !/^https?:\/\//i.test(trimmedLogoUrl)) {
    return { error: "Logo URL must start with http:// or https://" };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      logo_url: trimmedLogoUrl || null,
      brand_theme: themeId,
    })
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/brand");
  return { ok: true };
}
