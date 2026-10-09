"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasCapability, writeAuditLog } from "@/lib/admin/permissions";
import { createAdminNotification } from "@/app/admin/notificationActions";
import { maskEmail } from "@/lib/admin/mask";

/**
 * Admin-initiated password reset for an owner. Uses Supabase's own
 * built-in resetPasswordForEmail() — the standard, secure flow already
 * used by every "forgot password" link in this product
 * (src/app/(auth)/forgot-password). BD Clarity never generates, views,
 * stores, or transmits a token or a password at any point: Supabase
 * creates a one-time, time-limited recovery token internally and
 * emails it directly to the owner. This action's only job is to
 * trigger that existing flow on an owner's behalf and leave a record
 * that it happened — not to build a second, custom reset mechanism.
 *
 * No service-role client is needed here — resetPasswordForEmail() is a
 * public Supabase Auth method, available on the normal anon-key
 * client, by design (it must work for a logged-out "forgot password"
 * page).
 */
export async function initiateOwnerPasswordReset(
  ownerEmail: unknown
): Promise<{ ok: true } | { error: string; reason?: "not_configured" }> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "manage_admin_roles")) {
    return { error: "Not authorized." };
  }

  if (typeof ownerEmail !== "string" || !ownerEmail.trim()) {
    return { error: "A valid owner email is required." };
  }
  const email = ownerEmail.trim();

  const supabase = await createClient();

  // Confirm this email actually belongs to a real owner in this
  // platform before triggering anything — never let this action be
  // used to probe arbitrary email addresses for Supabase Auth account
  // existence.
  const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
  if (!profile) return { error: "No owner account found with that email." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl ? `${siteUrl}/reset-password` : undefined,
  });

  // Audit the REQUEST only — actor, target owner, that a reset was
  // triggered, and the outcome. Never the token (we never receive it;
  // Supabase keeps it entirely internal) and never the new password
  // (we never see it either — the owner sets it directly with
  // Supabase on the reset page).
  await writeAuditLog({
    adminUserId: admin.userId,
    action: "owner_password_reset_initiated",
    targetType: "owner",
    targetId: profile.user_id,
    result: error ? "failure" : "success",
    metadata: { email },
  });

  if (error) {
    return { error: error.message };
  }

  await createAdminNotification({
    eventType: "owner_password_reset",
    // Masked here, at the point the title is stored — this is a
    // shared list-scan surface read by any admin role, including ones
    // without a task-justified need for the full address. The audit
    // log (above) keeps the real email, since that's a per-admin,
    // access-controlled record, not a broadcast feed.
    title: `Password reset initiated for owner (${maskEmail(email)})`,
    targetType: "owner",
    targetId: profile.user_id,
    actorAdminId: admin.userId,
  });

  return { ok: true };
}
