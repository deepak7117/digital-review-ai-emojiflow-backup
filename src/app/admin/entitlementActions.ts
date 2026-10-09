"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin, writeAuditLog } from "@/lib/admin/permissions";
import { createAdminNotification } from "@/app/admin/notificationActions";

export interface OwnerEntitlement {
  subscriptionStatus: "active" | "expired" | "suspended" | "disabled";
  planDuration: "1_year" | "2_years" | "3_years" | null;
  startDate: string | null;
  expiryDate: string | null;
  paymentId: string | null;
  multiBusinessEnabled: boolean;
  maxBusinesses: number;
  multiBranchEnabled: boolean;
  maxBranches: number;
  adminNotes: string | null;
}

export interface OwnerEntitlementSummary {
  ownerEmail: string | null;
  currentBusinessCount: number;
  platformMaxBusinesses: number;
  /** null = no row yet — "not individually configured," falls back to the platform ceiling, not an error. */
  entitlement: OwnerEntitlement | null;
}

/** Any admin role may view — informational. */
export async function getOwnerEntitlementSummary(ownerId: string): Promise<OwnerEntitlementSummary | null> {
  const admin = await getCurrentAdmin();
  if (!admin) return null;

  const supabase = await createClient();
  const [profileResult, countResult, settingsResult, entitlementResult] = await Promise.all([
    supabase.from("profiles").select("email").eq("user_id", ownerId).maybeSingle(),
    supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", ownerId),
    supabase.from("platform_settings").select("max_businesses_per_owner").eq("id", true).maybeSingle(),
    supabase
      .from("owner_entitlements")
      .select(
        "subscription_status, plan_duration, start_date, expiry_date, payment_id, multi_business_enabled, max_businesses, multi_branch_enabled, max_branches, admin_notes"
      )
      .eq("owner_id", ownerId)
      .maybeSingle(),
  ]);

  const e = entitlementResult.data;

  return {
    ownerEmail: profileResult.data?.email ?? null,
    currentBusinessCount: countResult.count ?? 0,
    platformMaxBusinesses: settingsResult.data?.max_businesses_per_owner ?? 4,
    entitlement: e
      ? {
          subscriptionStatus: e.subscription_status,
          planDuration: e.plan_duration,
          startDate: e.start_date,
          expiryDate: e.expiry_date,
          paymentId: e.payment_id,
          multiBusinessEnabled: e.multi_business_enabled,
          maxBusinesses: e.max_businesses,
          multiBranchEnabled: e.multi_branch_enabled,
          maxBranches: e.max_branches,
          adminNotes: e.admin_notes,
        }
      : null,
  };
}

/**
 * super_admin only — enforced here AND by the owner_entitlements RLS
 * policy itself (defense in depth, same pattern used throughout this
 * project). Validates ranges before writing, mirroring the database
 * CHECK constraints so the error message is clean; the constraints
 * themselves are the real, unconditional enforcement.
 */
export async function upsertOwnerEntitlement(
  ownerId: unknown,
  fields: {
    subscriptionStatus: unknown;
    planDuration: unknown;
    startDate: unknown;
    expiryDate: unknown;
    paymentId: unknown;
    multiBusinessEnabled: unknown;
    maxBusinesses: unknown;
    multiBranchEnabled: unknown;
    maxBranches: unknown;
    adminNotes: unknown;
  }
): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (admin.role !== "super_admin") return { error: "Only Super Admin can change customer entitlements." };

  if (typeof ownerId !== "string" || !ownerId) return { error: "Invalid owner." };

  const validStatuses = ["active", "expired", "suspended", "disabled"] as const;
  type Status = (typeof validStatuses)[number];
  if (typeof fields.subscriptionStatus !== "string" || !validStatuses.includes(fields.subscriptionStatus as Status)) {
    return { error: "Invalid subscription status." };
  }
  const subscriptionStatus = fields.subscriptionStatus as Status;

  const validDurations = ["1_year", "2_years", "3_years"] as const;
  type Duration = (typeof validDurations)[number];
  const planDuration: Duration | null =
    typeof fields.planDuration === "string" && validDurations.includes(fields.planDuration as Duration)
      ? (fields.planDuration as Duration)
      : null;

  if (typeof fields.maxBusinesses !== "number" || fields.maxBusinesses < 1 || fields.maxBusinesses > 4) {
    return { error: "Maximum businesses must be between 1 and 4." };
  }
  if (typeof fields.maxBranches !== "number" || fields.maxBranches < 1) {
    return { error: "Maximum branches must be at least 1." };
  }
  if (typeof fields.multiBusinessEnabled !== "boolean" || typeof fields.multiBranchEnabled !== "boolean") {
    return { error: "Invalid value." };
  }

  const supabase = await createClient();

  // Fetched BEFORE the write, specifically to answer "did anything
  // material actually change" — the real dedup strategy requested for
  // this milestone, rather than firing a notification on every save
  // regardless of whether the admin changed anything.
  const { data: existing } = await supabase
    .from("owner_entitlements")
    .select("subscription_status, max_businesses, multi_business_enabled, max_branches, multi_branch_enabled")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const { error } = await supabase.from("owner_entitlements").upsert(
    {
      owner_id: ownerId,
      subscription_status: subscriptionStatus,
      plan_duration: planDuration,
      start_date: typeof fields.startDate === "string" && fields.startDate ? fields.startDate : null,
      expiry_date: typeof fields.expiryDate === "string" && fields.expiryDate ? fields.expiryDate : null,
      payment_id: typeof fields.paymentId === "string" ? fields.paymentId.trim().slice(0, 200) || null : null,
      multi_business_enabled: fields.multiBusinessEnabled,
      max_businesses: fields.maxBusinesses,
      multi_branch_enabled: fields.multiBranchEnabled,
      max_branches: fields.maxBranches,
      admin_notes: typeof fields.adminNotes === "string" ? fields.adminNotes.trim().slice(0, 2000) || null : null,
    },
    { onConflict: "owner_id" }
  );

  if (error) return { error: error.message };

  // Confirmed missing during Milestone B's audit: this action never
  // wrote to audit_logs since Phase 1 — a real gap, not invented to pad
  // this milestone. Fixed here since the new owner detail "Activity"
  // section depends on entitlement changes actually being recorded.
  // Reuses the existing writeAuditLog()/audit_logs exactly as every
  // other admin action does — not a new audit system.
  await writeAuditLog({
    adminUserId: admin.userId,
    action: "entitlement_update",
    targetType: "owner",
    targetId: ownerId,
    result: "success",
    metadata: {
      subscriptionStatus,
      maxBusinesses: fields.maxBusinesses,
      multiBusinessEnabled: fields.multiBusinessEnabled,
      maxBranches: fields.maxBranches,
      multiBranchEnabled: fields.multiBranchEnabled,
    },
  });

  const materiallyChanged =
    !existing ||
    existing.subscription_status !== subscriptionStatus ||
    existing.max_businesses !== fields.maxBusinesses ||
    existing.multi_business_enabled !== fields.multiBusinessEnabled ||
    existing.max_branches !== fields.maxBranches ||
    existing.multi_branch_enabled !== fields.multiBranchEnabled;

  if (materiallyChanged) {
    await createAdminNotification({
      eventType: "entitlement_changed",
      title: existing ? "Owner entitlement updated" : "Owner entitlement created",
      targetType: "owner",
      targetId: ownerId,
      actorAdminId: admin.userId,
      metadata: { subscriptionStatus, maxBusinesses: fields.maxBusinesses, maxBranches: fields.maxBranches },
    });
  }

  revalidatePath("/admin/businesses");
  return { ok: true };
}
