"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

export interface Branch {
  id: string;
  branchName: string;
  address: string | null;
  status: "active" | "inactive";
  createdAt: string;
}

export interface BranchEntitlementSummary {
  multiBranchEnabled: boolean;
  maxBranches: number;
  /** Total ACTIVE branches across ALL of this owner's businesses combined — per the approved definition, not per-business, so an owner can't bypass the limit by spreading branches across several businesses. */
  currentActiveBranchCount: number;
}

type ActiveBusinessContext =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string };
      business: { id: string };
    };

async function requireActiveBusiness(): Promise<ActiveBusinessContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be logged in." };

  const { business } = await getActiveBusiness(supabase);
  if (!business) return { ok: false, error: "Set up your business profile first." };

  return { ok: true, supabase, user, business };
}

export async function listBranches(): Promise<{ data: Branch[] } | { error: string }> {
  const ctx = await requireActiveBusiness();
  if (!ctx.ok) return ctx;
  const { supabase, business } = ctx;

  const { data, error } = await supabase
    .from("business_branches")
    .select("id, branch_name, address, status, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((b) => ({
      id: b.id,
      branchName: b.branch_name,
      address: b.address,
      status: b.status,
      createdAt: b.created_at,
    })),
  };
}

export async function getBranchEntitlementSummary(): Promise<BranchEntitlementSummary | null> {
  const ctx = await requireActiveBusiness();
  if (!ctx.ok) return null;
  const { supabase, user } = ctx;

  const [entitlementResult, countResult] = await Promise.all([
    supabase
      .from("owner_entitlements")
      .select("multi_branch_enabled, max_branches")
      .eq("owner_id", user.id)
      .maybeSingle(),
    // Total ACTIVE branches across ALL of this owner's businesses — not
    // scoped to business_id, per the approved "total owner limit"
    // definition (Phase 3F / Test D).
    supabase
      .from("business_branches")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "active"),
  ]);

  // No entitlement row -> no branch access at all (unlike the Multi-
  // Business fallback, which preserves pre-existing access for owners
  // who already had businesses). Nobody had branches before this
  // migration, so there is no equivalent "existing access" to preserve
  // here — the safe default is simply "branches are off" until Super
  // Admin explicitly grants them, matching owner_entitlements' own
  // column defaults (multi_branch_enabled=false, max_branches=1).
  const e = entitlementResult.data;

  return {
    multiBranchEnabled: e?.multi_branch_enabled ?? false,
    maxBranches: e?.max_branches ?? 1,
    currentActiveBranchCount: countResult.count ?? 0,
  };
}

export async function createBranch(
  branchName: unknown,
  address: unknown
): Promise<{ ok: true } | { error: string; reason?: "disabled" | "limit_reached" }> {
  const ctx = await requireActiveBusiness();
  if (!ctx.ok) return ctx;
  const { supabase, user, business } = ctx;

  const { data: entitlement } = await supabase
    .from("owner_entitlements")
    .select("multi_branch_enabled, max_branches")
    .eq("owner_id", user.id)
    .maybeSingle();

  const multiBranchEnabled = entitlement?.multi_branch_enabled ?? false;
  const maxBranches = entitlement?.max_branches ?? 1;

  if (!multiBranchEnabled) {
    return { error: "Multi-Branch isn't included in your current plan.", reason: "disabled" };
  }

  const { count } = await supabase
    .from("business_branches")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("status", "active");

  if ((count ?? 0) >= maxBranches) {
    return {
      error: `You've reached your branch limit. Your current plan allows ${maxBranches} branch${maxBranches === 1 ? "" : "es"}.`,
      reason: "limit_reached",
    };
  }

  const name = typeof branchName === "string" ? branchName.trim().slice(0, 200) : "";
  if (!name) return { error: "Branch name is required." };
  const addr = typeof address === "string" ? address.trim().slice(0, 300) || null : null;

  const { error } = await supabase.from("business_branches").insert({
    business_id: business.id,
    owner_id: user.id,
    branch_name: name,
    address: addr,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/branches");
  return { ok: true };
}

export async function setBranchStatus(
  branchId: unknown,
  status: unknown
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireActiveBusiness();
  if (!ctx.ok) return ctx;
  const { supabase, user, business } = ctx;

  if (typeof branchId !== "string" || !branchId) return { error: "Invalid branch." };
  if (status !== "active" && status !== "inactive") return { error: "Invalid status." };

  // Reactivating must also respect the entitlement limit — otherwise an
  // owner at their limit could deactivate-then-reactivate to silently
  // exceed it.
  if (status === "active") {
    const [entitlementResult, countResult] = await Promise.all([
      supabase.from("owner_entitlements").select("max_branches").eq("owner_id", user.id).maybeSingle(),
      supabase
        .from("business_branches")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "active"),
    ]);
    const maxBranches = entitlementResult.data?.max_branches ?? 1;
    if ((countResult.count ?? 0) >= maxBranches) {
      return { error: `You've reached your branch limit of ${maxBranches}.` };
    }
  }

  // Scoped to this specific business too (not just owner_id, which RLS
  // already guarantees) — purely a correctness measure so toggling a
  // branch always acts on the one currently shown under the active
  // business, never a stale id from a previously-selected business.
  const { error } = await supabase
    .from("business_branches")
    .update({ status })
    .eq("id", branchId)
    .eq("owner_id", user.id)
    .eq("business_id", business.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/branches");
  return { ok: true };
}
