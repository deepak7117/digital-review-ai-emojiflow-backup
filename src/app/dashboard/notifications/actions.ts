"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/business/activeBusiness";

async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  return getActiveBusinessId(supabase);
}

/**
 * Unread count only — never returns the notification rows themselves
 * here, since this is called from the header on every dashboard page and
 * should stay minimal. Full detail is viewed via the existing Feedback
 * Inbox, which already has the real content under its own established RLS.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const businessId = await getOwnedBusinessId(supabase);
  if (!businessId) return 0;

  const { count } = await supabase
    .from("owner_notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("read_at", null);

  return count ?? 0;
}

/** Marks every unread notification for the caller's own business as read — called when the owner visits the Feedback Inbox, the natural "I've seen this" moment. */
export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const businessId = await getOwnedBusinessId(supabase);
  if (!businessId) return;

  await supabase
    .from("owner_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .is("read_at", null);
}
