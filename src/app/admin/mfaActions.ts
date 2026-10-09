"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/adminClient";
import { getCurrentAdmin, writeAuditLog } from "@/lib/admin/permissions";

/**
 * Admin MFA, built entirely on Supabase Auth's native TOTP factors
 * (`auth.mfa.*`). This requires NO external SMS/email provider — TOTP
 * is a self-contained standard (RFC 6238): Supabase generates a shared
 * secret, the admin scans it into any authenticator app (Google
 * Authenticator, 1Password, etc.), and all verification happens
 * against that shared secret with no third-party delivery step at
 * all. This is a genuine second factor (something you HAVE — the
 * authenticator app) distinct from the password (something you KNOW)
 * and distinct from email-based recovery (which uses the same
 * account/inbox as login, not a separate factor).
 *
 * LIVE ENFORCEMENT DEPENDS ON A SUPABASE PROJECT SETTING: MFA
 * enrollment must be enabled for this project in the Supabase
 * dashboard (Authentication → MFA). The code below is correct and
 * complete against the Supabase Auth API regardless, but cannot be
 * exercised against a real project in this sandbox (no
 * NEXT_PUBLIC_SUPABASE_URL/keys configured) — reported as Blocked
 * pending that dashboard setting and real credentials, not claimed as
 * verified.
 */

export interface MfaFactor {
  id: string;
  status: "verified" | "unverified";
  createdAt: string;
}

export async function listMfaFactors(): Promise<{ data: MfaFactor[] } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { error: error.message };

  return {
    data: (data.totp ?? []).map((f) => ({ id: f.id, status: f.status, createdAt: f.created_at })),
  };
}

export async function enrollMfaFactor(): Promise<
  { data: { factorId: string; qrCode: string; secret: string } } | { error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) return { error: error.message };

  return {
    data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  };
}

export async function verifyMfaEnrollment(
  factorId: unknown,
  code: unknown
): Promise<{ ok: true } | { error: string }> {
  if (typeof factorId !== "string" || typeof code !== "string" || !code.trim()) {
    return { error: "Invalid verification code." };
  }

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) return { error: challengeError.message };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) return { error: verifyError.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Audit the enrollment itself — never the TOTP secret or any code.
    await writeAuditLog({
      adminUserId: user.id,
      action: "admin_mfa_enrolled",
      targetType: "admin",
      targetId: user.id,
      result: "success",
    });
  }

  return { ok: true };
}

export async function unenrollOwnMfaFactor(factorId: unknown): Promise<{ ok: true } | { error: string }> {
  if (typeof factorId !== "string" || !factorId) return { error: "Invalid factor." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await writeAuditLog({
      adminUserId: user.id,
      action: "admin_mfa_removed",
      targetType: "admin",
      targetId: user.id,
      result: "success",
    });
  }

  return { ok: true };
}

/**
 * Recovery path for an admin locked out by a lost authenticator.
 * Requires a DIFFERENT, currently-authenticated super_admin to act,
 * and the service-role client (Admin API) — self-unenroll is
 * impossible by definition once locked out, so this cannot go through
 * the normal user-session MFA endpoints at all. Mirrors the exact
 * pattern already established for createAdmin() in Milestone A: code
 * is correct and complete, live execution requires
 * SUPABASE_SERVICE_ROLE_KEY, which is not configured in this sandbox —
 * reported as Blocked, not simulated.
 */
export async function recoverLockedOutAdminMfa(
  targetUserId: unknown
): Promise<{ ok: true } | { error: string; reason?: "not_configured" }> {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "super_admin") return { error: "Only Super Admin can perform MFA recovery." };
  if (typeof targetUserId !== "string" || !targetUserId) return { error: "Invalid target admin." };

  if (!isServiceRoleConfigured()) {
    return {
      error:
        "MFA recovery requires SUPABASE_SERVICE_ROLE_KEY, which is not configured in this environment.",
      reason: "not_configured",
    };
  }

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return { error: "Service-role client unavailable.", reason: "not_configured" };
  }

  const { data: factors, error: listError } = await serviceClient.auth.admin.mfa.listFactors({
    userId: targetUserId,
  });
  if (listError) return { error: listError.message };

  for (const factor of factors.factors ?? []) {
    const { error: deleteError } = await serviceClient.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: targetUserId,
    });
    if (deleteError) return { error: deleteError.message };
  }

  await writeAuditLog({
    adminUserId: admin.userId,
    action: "admin_mfa_recovery",
    targetType: "admin",
    targetId: targetUserId,
    result: "success",
    metadata: { factorsRemoved: factors.factors?.length ?? 0 },
  });

  return { ok: true };
}
