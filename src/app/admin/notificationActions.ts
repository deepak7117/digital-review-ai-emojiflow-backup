"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasCapability } from "@/lib/admin/permissions";

export type AdminNotificationEventType =
  | "business_status_changed"
  | "admin_role_changed"
  | "entitlement_changed"
  | "owner_password_reset";

/**
 * The single writer every hook point calls — not a second notification
 * path per event type. Deliberately swallows its own errors (never
 * throws): a notification failing to write must never break the real
 * action that triggered it (suspending a business, say). Called only
 * after the real action has already succeeded.
 */
export async function createAdminNotification(params: {
  eventType: AdminNotificationEventType;
  title: string;
  targetType?: string;
  targetId?: string;
  actorAdminId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("admin_notifications").insert({
      event_type: params.eventType,
      title: params.title,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      actor_admin_id: params.actorAdminId,
      metadata: params.metadata ?? null,
    });
  } catch {
    // Intentionally swallowed — see doc comment above.
  }
}

export interface AdminNotification {
  id: string;
  kind: "stored" | "expiry";
  eventType: string;
  title: string;
  description: string | null;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: string;
  /** Only "stored" notifications can be marked read — expiry items are recomputed live every load, so there's nothing to persist a read state against. */
  canMarkRead: boolean;
}

export async function listNotifications(): Promise<{ data: AdminNotification[] } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "view_dashboard")) return { error: "Not authorized." };

  const supabase = await createClient();

  const [storedResult, expiringResult] = await Promise.all([
    supabase
      .from("admin_notifications")
      .select("id, event_type, title, target_type, target_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    // Live-computed, never stored — see migration 0022's header comment
    // for why. Recomputed fresh on every page load from real data.
    supabase
      .from("owner_entitlements")
      .select("owner_id, subscription_status, expiry_date")
      .eq("subscription_status", "active")
      .not("expiry_date", "is", null),
  ]);

  const stored: AdminNotification[] = (storedResult.data ?? []).map((n) => ({
    id: n.id,
    kind: "stored",
    eventType: n.event_type,
    title: n.title,
    description: null,
    targetType: n.target_type,
    targetId: n.target_id,
    isRead: n.read_at !== null,
    createdAt: n.created_at,
    canMarkRead: true,
  }));

  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const expiring: AdminNotification[] = (expiringResult.data ?? [])
    .filter((e) => e.expiry_date && new Date(e.expiry_date).getTime() <= in30Days)
    .map((e) => {
      const daysLeft = Math.ceil((new Date(e.expiry_date as string).getTime() - now) / (24 * 60 * 60 * 1000));
      return {
        id: `expiry:${e.owner_id}`,
        kind: "expiry" as const,
        eventType: "entitlement_expiring",
        title:
          daysLeft < 0
            ? `Entitlement expired ${Math.abs(daysLeft)} day(s) ago`
            : `Entitlement expiring in ${daysLeft} day(s)`,
        description: null,
        targetType: "owner",
        targetId: e.owner_id,
        isRead: false,
        createdAt: new Date().toISOString(),
        canMarkRead: false,
      };
    });

  return { data: [...expiring, ...stored].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "view_dashboard")) return 0;

  const supabase = await createClient();
  const [storedResult, expiringResult] = await Promise.all([
    supabase.from("admin_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("owner_entitlements")
      .select("expiry_date")
      .eq("subscription_status", "active")
      .not("expiry_date", "is", null),
  ]);

  const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const expiringCount = (expiringResult.data ?? []).filter(
    (e) => e.expiry_date && new Date(e.expiry_date).getTime() <= in30Days
  ).length;

  return (storedResult.count ?? 0) + expiringCount;
}

export async function markNotificationRead(notificationId: unknown): Promise<{ ok: true } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "view_dashboard")) return { error: "Not authorized." };
  if (typeof notificationId !== "string" || !notificationId) return { error: "Invalid notification." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString(), read_by: admin.userId })
    .eq("id", notificationId);

  if (error) return { error: error.message };
  return { ok: true };
}
