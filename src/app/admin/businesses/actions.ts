"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin, hasCapability, writeAuditLog } from "@/lib/admin/permissions";
import type { AdminRole } from "@/types/database";

export interface AdminBusinessSummary {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
  status: "active" | "inactive" | "suspended";
  ownerEmail: string | null;
  createdAt: string;
}

/**
 * Business list + search. Read-only, so available to every admin tier
 * (view_dashboard) — matches the approved matrix, where all four tiers can
 * view platform data.
 */
export async function searchBusinesses(
  query: string | undefined
): Promise<{ data: AdminBusinessSummary[] } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };

  const supabase = await createClient();
  let builder = supabase
    .from("businesses")
    .select("id, business_name, category, city, status, created_at, owner_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (query && query.trim()) {
    builder = builder.ilike("business_name", `%${query.trim()}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: error.message };

  const ownerIds = Array.from(new Set((data ?? []).map((b) => b.owner_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email")
    .in("user_id", ownerIds.length > 0 ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
  const emailByOwner = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));

  return {
    data: (data ?? []).map((b) => ({
      id: b.id,
      businessName: b.business_name,
      category: b.category,
      city: b.city,
      status: b.status,
      ownerEmail: emailByOwner.get(b.owner_id) ?? null,
      createdAt: b.created_at,
    })),
  };
}

export interface AdminBusinessDetail extends AdminBusinessSummary {
  phone: string | null;
  address: string | null;
  website: string | null;
  contactEmail: string | null;
  googleReviewUrl: string | null;
  industrySlug: string | null;
  segmentSlug: string | null;
}

export async function getBusinessDetail(
  businessId: unknown
): Promise<{ data: AdminBusinessDetail } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };

  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select(
      "id, business_name, category, city, phone, email, address, website, google_review_url, industry_slug, segment_slug, status, created_at, owner_id"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!business) return { error: "Business not found." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", business.owner_id)
    .maybeSingle();

  return {
    data: {
      id: business.id,
      businessName: business.business_name,
      category: business.category,
      city: business.city,
      phone: business.phone,
      address: business.address,
      website: business.website,
      contactEmail: business.email,
      googleReviewUrl: business.google_review_url,
      industrySlug: business.industry_slug,
      segmentSlug: business.segment_slug,
      status: business.status,
      ownerEmail: profile?.email ?? null,
      createdAt: business.created_at,
    },
  };
}

/**
 * Activate/suspend/reactivate — routes through the verified
 * admin_set_business_status() SECURITY DEFINER function (0010 migration),
 * never a direct table UPDATE. That function independently re-verifies
 * the caller's tier itself (defense in depth); the hasCapability check
 * here just lets the UI fail fast with a clean message rather than a raw
 * Postgres error for an unauthorized tier.
 */
export async function setBusinessStatus(
  businessId: unknown,
  newStatus: unknown,
  reason: unknown
): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (!hasCapability(admin.role, "manage_business_status")) {
    return { error: "Your admin role cannot change business status." };
  }
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };
  const allowedStatuses = ["active", "inactive", "suspended"] as const;
  type BusinessStatus = (typeof allowedStatuses)[number];
  if (typeof newStatus !== "string" || !(allowedStatuses as readonly string[]).includes(newStatus)) {
    return { error: "Invalid status." };
  }
  const validatedStatus = newStatus as BusinessStatus;
  const reasonText = typeof reason === "string" ? reason.trim().slice(0, 500) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_business_status", {
    p_business_id: businessId,
    p_new_status: validatedStatus,
    p_reason: reasonText,
  });

  // admin_set_business_status() already writes its own audit_logs row
  // atomically with the status change (0010 migration) — no separate
  // writeAuditLog() call here would just duplicate that entry.
  if (error) return { error: error.message };

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  return { ok: true };
}

export interface BusinessEditInput {
  businessName: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  website: string;
  googleReviewUrl: string;
}

/** Edit business profile fields — Super Admin and Operations Admin. */
export async function updateBusinessDetails(
  businessId: unknown,
  input: BusinessEditInput
): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (!hasCapability(admin.role, "edit_business_details")) {
    return { error: "Your admin role cannot edit business details." };
  }
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };
  if (!input || typeof input.businessName !== "string" || !input.businessName.trim()) {
    return { error: "Business name is required." };
  }
  const clean = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_business", {
    p_business_id: businessId,
    p_business_name: clean(input.businessName, 200),
    p_category: clean(input.category),
    p_phone: clean(input.phone, 50),
    p_email: clean(input.email),
    p_address: clean(input.address, 500),
    p_city: clean(input.city),
    p_website: clean(input.website, 500),
    p_google_review_url: clean(input.googleReviewUrl, 1000),
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  return { ok: true };
}

/** Permanently delete a business — Super Admin only. */
export async function deleteBusiness(
  businessId: unknown,
  reason: unknown
): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (!hasCapability(admin.role, "delete_business")) {
    return { error: "Only Super Admin can delete a business." };
  }
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };
  const reasonText = typeof reason === "string" ? reason.trim().slice(0, 500) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_business", {
    p_business_id: businessId,
    p_reason: reasonText,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/businesses");
  return { ok: true };
}

export interface SupportNote {
  id: string;
  note: string;
  adminEmail: string | null;
  createdAt: string;
}

export async function listSupportNotes(
  businessId: unknown
): Promise<{ data: SupportNote[] } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (!hasCapability(admin.role, "manage_support_notes")) {
    // Read-only Analyst has no visibility into support notes at all, per
    // the approved matrix — RLS would return zero rows anyway, but fail
    // fast with a clear message instead of an empty-looking list.
    return { error: "Your admin role cannot view support notes." };
  }
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_support_notes")
    .select("id, note, created_at, admin_user_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const adminIds = Array.from(new Set((data ?? []).map((n) => n.admin_user_id).filter((id): id is string => id !== null)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email")
    .in("user_id", adminIds.length > 0 ? adminIds : ["00000000-0000-0000-0000-000000000000"]);
  const emailByAdmin = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));

  return {
    data: (data ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      adminEmail: n.admin_user_id ? (emailByAdmin.get(n.admin_user_id) ?? null) : null,
      createdAt: n.created_at,
    })),
  };
}

export async function addSupportNote(
  businessId: unknown,
  note: unknown
): Promise<{ data: SupportNote } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (!hasCapability(admin.role, "manage_support_notes")) {
    return { error: "Your admin role cannot add support notes." };
  }
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };
  const text = typeof note === "string" ? note.trim().slice(0, 2000) : "";
  if (!text) return { error: "Enter a note." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_support_notes")
    .insert({ business_id: businessId, admin_user_id: admin.userId, note: text })
    .select("id, note, created_at")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    adminUserId: admin.userId,
    action: "add_support_note",
    targetType: "business",
    targetId: businessId,
    result: "success",
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  return { data: { id: data.id, note: data.note, adminEmail: null, createdAt: data.created_at } };
}

export interface AuditHistoryEntry {
  action: string;
  targetType: string | null;
  reason: string | null;
  result: "success" | "failure";
  metadata: Record<string, unknown> | null;
  adminEmail: string | null;
  createdAt: string;
}

/** Account change history for one business — every admin tier can view (view_dashboard). */
export async function getBusinessAuditHistory(
  businessId: unknown
): Promise<{ data: AuditHistoryEntry[] } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };
  if (typeof businessId !== "string" || !businessId) return { error: "Invalid business." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action, target_type, reason, result, metadata, created_at, admin_user_id")
    .eq("target_type", "business")
    .eq("target_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message };

  const adminIds = Array.from(new Set((data ?? []).map((l) => l.admin_user_id).filter((id): id is string => id !== null)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email")
    .in("user_id", adminIds.length > 0 ? adminIds : ["00000000-0000-0000-0000-000000000000"]);
  const emailByAdmin = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));

  return {
    data: (data ?? []).map((l) => ({
      action: l.action,
      targetType: l.target_type,
      reason: l.reason,
      result: l.result,
      metadata: l.metadata,
      adminEmail: l.admin_user_id ? (emailByAdmin.get(l.admin_user_id) ?? null) : null,
      createdAt: l.created_at,
    })),
  };
}

export type { AdminRole };
