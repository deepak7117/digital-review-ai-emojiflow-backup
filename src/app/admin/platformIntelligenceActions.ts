"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasCapability } from "@/lib/admin/permissions";
import { getOwnerEntitlementSummary } from "@/app/admin/entitlementActions";

/**
 * Milestone B — Platform Intelligence + Owner-Centric Management.
 * Every number below is a real aggregation over existing tables
 * (businesses, business_branches, owner_entitlements, profiles,
 * audit_logs) — no new table, no synthetic/demo data. Where a metric
 * genuinely cannot be derived (e.g. this schema has no owner-level
 * "status" field independent of their businesses or entitlement), it
 * is explicitly omitted or labeled rather than invented — see the
 * doc comments on each field below for exactly what it means and
 * where it comes from.
 */

export interface PlatformMetrics {
  totalOwners: number;
  totalBusinesses: number;
  activeBusinesses: number;
  totalBranches: number;
  activeBranches: number;
  multiBusinessOwners: number;
  multiBranchOwners: number;
  entitlement: {
    /** Owners with no owner_entitlements row at all — "not yet individually configured," per the Phase 1 architecture, not a status in its own right. */
    notConfigured: number;
    active: number;
    expired: number;
    suspended: number;
    disabled: number;
    expiringWithin7Days: number;
    expiringWithin30Days: number;
  };
}

export async function getPlatformMetrics(): Promise<{ data: PlatformMetrics } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "view_dashboard")) return { error: "Not authorized." };

  const supabase = await createClient();

  // One query per table, each selecting only the columns this needs —
  // no N+1, no per-row follow-up queries.
  const [businessesResult, branchesResult, entitlementsResult] = await Promise.all([
    supabase.from("businesses").select("owner_id, status"),
    supabase.from("business_branches").select("owner_id, status"),
    supabase
      .from("owner_entitlements")
      .select("owner_id, subscription_status, multi_business_enabled, multi_branch_enabled, expiry_date"),
  ]);

  const businesses = businessesResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const entitlements = entitlementsResult.data ?? [];

  const ownerIds = new Set(businesses.map((b) => b.owner_id));
  const businessCountByOwner = new Map<string, number>();
  for (const b of businesses) {
    businessCountByOwner.set(b.owner_id, (businessCountByOwner.get(b.owner_id) ?? 0) + 1);
  }
  const branchCountByOwner = new Map<string, number>();
  for (const br of branches) {
    if (br.status !== "active") continue;
    branchCountByOwner.set(br.owner_id, (branchCountByOwner.get(br.owner_id) ?? 0) + 1);
  }

  const now = Date.now();
  const in7Days = now + 7 * 24 * 60 * 60 * 1000;
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  const entitlementCounts = { active: 0, expired: 0, suspended: 0, disabled: 0 };
  let expiringWithin7Days = 0;
  let expiringWithin30Days = 0;
  const ownersWithEntitlement = new Set<string>();

  for (const e of entitlements) {
    ownersWithEntitlement.add(e.owner_id);
    entitlementCounts[e.subscription_status] = (entitlementCounts[e.subscription_status] ?? 0) + 1;
    if (e.expiry_date) {
      const expiryMs = new Date(e.expiry_date).getTime();
      // "Expiring" is scoped to still-active entitlements with a real
      // future-or-past expiry date within the window — an already
      // expired/suspended/disabled row isn't "expiring soon," it's
      // already in that state.
      if (e.subscription_status === "active" && expiryMs <= in30Days) {
        expiringWithin30Days++;
        if (expiryMs <= in7Days) expiringWithin7Days++;
      }
    }
  }

  return {
    data: {
      totalOwners: ownerIds.size,
      totalBusinesses: businesses.length,
      activeBusinesses: businesses.filter((b) => b.status === "active").length,
      totalBranches: branches.length,
      activeBranches: branches.filter((b) => b.status === "active").length,
      multiBusinessOwners: Array.from(businessCountByOwner.values()).filter((c) => c > 1).length,
      multiBranchOwners: Array.from(branchCountByOwner.values()).filter((c) => c > 1).length,
      entitlement: {
        notConfigured: Math.max(0, ownerIds.size - ownersWithEntitlement.size),
        active: entitlementCounts.active,
        expired: entitlementCounts.expired,
        suspended: entitlementCounts.suspended,
        disabled: entitlementCounts.disabled,
        expiringWithin7Days,
        expiringWithin30Days,
      },
    },
  };
}

export interface OwnerSearchResult {
  ownerId: string;
  email: string | null;
  fullName: string | null;
  businessCount: number;
  branchCount: number;
  subscriptionStatus: "active" | "expired" | "suspended" | "disabled" | "not_configured";
}

export interface OwnerSearchPage {
  results: OwnerSearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Owner-centric search — resolves by name/email (profiles) OR business
 * name, always to the distinct OWNER, never a flat business list.
 * Batch A addition: statusFilter + page/pageSize. Pagination is applied
 * in-process after resolving the full owner-id set (not a SQL
 * OFFSET/LIMIT), since the matching set already has to be fully
 * resolved to compute business/branch counts per owner — the realistic
 * owner count for this product does not warrant a more complex
 * streaming/cursor design yet.
 */
export async function searchOwners(
  query: unknown,
  statusFilter?: unknown,
  page?: unknown,
  pageSize?: unknown
): Promise<{ data: OwnerSearchPage } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "view_dashboard")) return { error: "Not authorized." };

  const validStatuses = ["active", "expired", "suspended", "disabled", "not_configured"] as const;
  const status =
    typeof statusFilter === "string" && (validStatuses as readonly string[]).includes(statusFilter)
      ? (statusFilter as (typeof validStatuses)[number])
      : null;
  const pageNum = typeof page === "number" && page >= 1 ? Math.floor(page) : 1;
  const size = typeof pageSize === "number" && pageSize >= 1 && pageSize <= 100 ? Math.floor(pageSize) : 20;

  const supabase = await createClient();
  const trimmed = typeof query === "string" ? query.trim() : "";

  let ownerIds: string[];
  if (trimmed) {
    const [matchingProfiles, matchingBusinesses] = await Promise.all([
      supabase.from("profiles").select("user_id").or(`email.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`),
      supabase.from("businesses").select("owner_id").ilike("business_name", `%${trimmed}%`),
    ]);
    ownerIds = Array.from(
      new Set([
        ...(matchingProfiles.data ?? []).map((p) => p.user_id),
        ...(matchingBusinesses.data ?? []).map((b) => b.owner_id),
      ])
    );
    // Only owners who actually own at least one business are shown —
    // a matching profile with zero businesses isn't a platform "owner."
    const { data: ownedCheck } = await supabase
      .from("businesses")
      .select("owner_id")
      .in("owner_id", ownerIds.length > 0 ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
    ownerIds = Array.from(new Set((ownedCheck ?? []).map((b) => b.owner_id)));
  } else {
    const { data: allOwners } = await supabase.from("businesses").select("owner_id");
    ownerIds = Array.from(new Set((allOwners ?? []).map((b) => b.owner_id)));
  }

  if (ownerIds.length === 0) return { data: { results: [], totalCount: 0, page: pageNum, pageSize: size } };

  const [profiles, businesses, branches, entitlements] = await Promise.all([
    supabase.from("profiles").select("user_id, email, full_name").in("user_id", ownerIds),
    supabase.from("businesses").select("owner_id").in("owner_id", ownerIds),
    supabase.from("business_branches").select("owner_id, status").in("owner_id", ownerIds),
    supabase.from("owner_entitlements").select("owner_id, subscription_status").in("owner_id", ownerIds),
  ]);

  const profileByOwner = new Map((profiles.data ?? []).map((p) => [p.user_id, p]));
  const businessCountByOwner = new Map<string, number>();
  for (const b of businesses.data ?? []) {
    businessCountByOwner.set(b.owner_id, (businessCountByOwner.get(b.owner_id) ?? 0) + 1);
  }
  const branchCountByOwner = new Map<string, number>();
  for (const br of branches.data ?? []) {
    if (br.status !== "active") continue;
    branchCountByOwner.set(br.owner_id, (branchCountByOwner.get(br.owner_id) ?? 0) + 1);
  }
  const entitlementByOwner = new Map<string, "active" | "expired" | "suspended" | "disabled">(
    (entitlements.data ?? []).map((e) => [e.owner_id, e.subscription_status])
  );

  const results: OwnerSearchResult[] = ownerIds.map((ownerId) => ({
    ownerId,
    email: profileByOwner.get(ownerId)?.email ?? null,
    fullName: profileByOwner.get(ownerId)?.full_name ?? null,
    businessCount: businessCountByOwner.get(ownerId) ?? 0,
    branchCount: branchCountByOwner.get(ownerId) ?? 0,
    subscriptionStatus: entitlementByOwner.get(ownerId) ?? "not_configured",
  }));
  results.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  const filtered = status ? results.filter((r) => r.subscriptionStatus === status) : results;
  const totalCount = filtered.length;
  const start = (pageNum - 1) * size;
  const page_ = filtered.slice(start, start + size);

  return { data: { results: page_, totalCount, page: pageNum, pageSize: size } };
}

export interface OwnerDetailBusiness {
  id: string;
  businessName: string;
  status: "active" | "inactive" | "suspended";
  branchCount: number;
  createdAt: string;
}

export interface OwnerDetail {
  ownerId: string;
  email: string | null;
  fullName: string | null;
  profileCreatedAt: string | null;
  entitlement: Awaited<ReturnType<typeof getOwnerEntitlementSummary>>;
  businesses: OwnerDetailBusiness[];
  feedbackSubmissionCount: number;
  recentActivity: { action: string; targetType: string | null; result: string; createdAt: string }[];
}

export async function getOwnerDetail(ownerId: unknown): Promise<{ data: OwnerDetail } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "view_dashboard")) return { error: "Not authorized." };
  if (typeof ownerId !== "string" || !ownerId) return { error: "Invalid owner." };

  const supabase = await createClient();

  const [profileResult, businessesResult, entitlement] = await Promise.all([
    supabase.from("profiles").select("email, full_name, created_at").eq("user_id", ownerId).maybeSingle(),
    supabase
      .from("businesses")
      .select("id, business_name, status, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true }),
    getOwnerEntitlementSummary(ownerId),
  ]);

  const businesses = businessesResult.data ?? [];
  if (businesses.length === 0 && !profileResult.data) return { error: "Owner not found." };

  const businessIds = businesses.map((b) => b.id);

  const [branchesResult, feedbackCountResult, activityResult] = await Promise.all([
    supabase.from("business_branches").select("business_id").eq("owner_id", ownerId).eq("status", "active"),
    businessIds.length > 0
      ? supabase
          .from("feedback_submissions")
          .select("id", { count: "exact", head: true })
          .in("business_id", businessIds)
      : Promise.resolve({ count: 0 }),
    // Scoped to real target_type/target_id values this project actually
    // writes ("business" with a business id, "owner" with the owner's
    // own id) — reusing audit_logs exactly as it already exists, not a
    // second activity table. Limited to the most recent 20, not the
    // full history, per the explicit performance requirement.
    supabase
      .from("audit_logs")
      .select("action, target_type, result, created_at")
      .or(
        `and(target_type.eq.owner,target_id.eq.${ownerId})${
          businessIds.length > 0
            ? `,and(target_type.eq.business,target_id.in.(${businessIds.join(",")}))`
            : ""
        }`
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const branchCountByBusiness = new Map<string, number>();
  for (const br of branchesResult.data ?? []) {
    branchCountByBusiness.set(br.business_id, (branchCountByBusiness.get(br.business_id) ?? 0) + 1);
  }

  return {
    data: {
      ownerId,
      email: profileResult.data?.email ?? null,
      fullName: profileResult.data?.full_name ?? null,
      profileCreatedAt: profileResult.data?.created_at ?? null,
      entitlement,
      businesses: businesses.map((b) => ({
        id: b.id,
        businessName: b.business_name,
        status: b.status,
        branchCount: branchCountByBusiness.get(b.id) ?? 0,
        createdAt: b.created_at,
      })),
      feedbackSubmissionCount: feedbackCountResult.count ?? 0,
      recentActivity: (activityResult.data ?? []).map((a) => ({
        action: a.action,
        targetType: a.target_type,
        result: a.result,
        createdAt: a.created_at,
      })),
    },
  };
}
