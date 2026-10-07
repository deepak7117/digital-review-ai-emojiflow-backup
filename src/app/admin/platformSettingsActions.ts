"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin/permissions";

export interface PlatformSettings {
  multistoreEnabled: boolean;
  maxBusinessesPerOwner: number;
}

/** Any admin role may view this — it's informational, read-only for non-super-admins. */
export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const admin = await getCurrentAdmin();
  if (!admin) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("multistore_enabled, max_businesses_per_owner")
    .eq("id", true)
    .maybeSingle();

  if (!data) return null;
  return { multistoreEnabled: data.multistore_enabled, maxBusinessesPerOwner: data.max_businesses_per_owner };
}

/**
 * Only super_admin may change this — enforced both here (app layer) and
 * by the platform_settings RLS policy itself (0018), the same
 * defense-in-depth pattern used throughout this project.
 */
export async function updatePlatformSettings(
  multistoreEnabled: unknown,
  maxBusinessesPerOwner: unknown
): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (admin.role !== "super_admin") {
    return { error: "Only Super Admin can change this setting." };
  }

  if (typeof multistoreEnabled !== "boolean") return { error: "Invalid value." };
  if (typeof maxBusinessesPerOwner !== "number" || !Number.isInteger(maxBusinessesPerOwner)) {
    return { error: "Invalid value." };
  }
  // Mirrors the database CHECK constraint — rejected here first for a
  // clean error message, enforced again by the constraint regardless.
  if (maxBusinessesPerOwner < 1 || maxBusinessesPerOwner > 4) {
    return { error: "Maximum businesses per owner must be between 1 and 4." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ multistore_enabled: multistoreEnabled, max_businesses_per_owner: maxBusinessesPerOwner })
    .eq("id", true);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
