"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, writeAuditLog } from "@/lib/admin/permissions";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { getEmailProvider, getSmsProvider } from "@/lib/communication/provider";
import { maskEmail, maskPhone } from "@/lib/admin/mask";

const ALLOWED_TEMPLATES = ["general_notice", "entitlement_notice", "account_notice"] as const;
type TemplateType = (typeof ALLOWED_TEMPLATES)[number];

export interface CommunicationRecord {
  id: string;
  channel: "email" | "sms";
  recipientMasked: string;
  templateType: string;
  status: "queued" | "submitted" | "delivered" | "failed" | "unknown";
  providerName: string | null;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Admin-initiated send. Gated the same as owner credential recovery
 * (manage_admin_roles, super_admin only) — a deliberately conservative
 * choice rather than inventing a new, less-scrutinized capability for
 * "send a message to a customer on the platform's behalf."
 *
 * Rate limited via the exact same database-backed check_rate_limit()
 * used for login throttling in Batch B — not a new in-memory counter.
 *
 * The status this function records is always exactly what the
 * provider interface returned — "not_configured" is mapped to a real,
 * truthful "failed" row with that reason recorded, never silently
 * upgraded to anything resembling success.
 */
export async function sendAdminCommunication(params: {
  channel: unknown;
  recipient: unknown;
  templateType: unknown;
  subject?: unknown;
  body: unknown;
  targetType?: unknown;
  targetId?: unknown;
}): Promise<{ ok: true; status: string } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "super_admin") {
    return { error: "Not authorized." };
  }

  if (params.channel !== "email" && params.channel !== "sms") {
    return { error: "Invalid channel." };
  }
  if (typeof params.recipient !== "string" || !params.recipient.trim()) {
    return { error: "A recipient is required." };
  }
  if (typeof params.templateType !== "string" || !(ALLOWED_TEMPLATES as readonly string[]).includes(params.templateType)) {
    return { error: "Invalid template type." };
  }
  if (typeof params.body !== "string" || !params.body.trim()) {
    return { error: "A message body is required." };
  }
  if (params.body.length > 2000) {
    return { error: "Message body is too long." };
  }

  const recipient = params.recipient.trim();
  const templateType = params.templateType as TemplateType;
  const subject = typeof params.subject === "string" ? params.subject.trim().slice(0, 200) : null;
  const targetType = typeof params.targetType === "string" ? params.targetType : null;
  const targetId = typeof params.targetId === "string" ? params.targetId : null;

  const supabase = await createClient();

  // Rate limit: at most 10 admin-initiated sends per 10 minutes,
  // platform-wide — a safeguard against accidental repeated sends
  // (e.g. a double-click or a retry loop), not a precise quota.
  const allowed = await checkRateLimit(supabase, "admin_communication_send", "global", 10, 600);
  if (!allowed) {
    return { error: "Too many messages sent recently. Please wait a few minutes before sending another." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("communication_history")
    .insert({
      channel: params.channel,
      recipient,
      template_type: templateType,
      subject,
      status: "queued",
      sent_by_admin_id: admin.userId,
      target_type: targetType,
      target_id: targetId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Failed to record the send attempt." };
  }

  const result =
    params.channel === "email"
      ? await getEmailProvider().sendEmail(recipient, subject ?? "BD Clarity", params.body)
      : await getSmsProvider().sendSms(recipient, params.body);

  // "not_configured" is recorded as a real, honest "failed" status with
  // its actual reason — never silently treated as success.
  const finalStatus = result.status === "not_configured" ? "failed" : result.status;

  await supabase
    .from("communication_history")
    .update({
      status: finalStatus,
      provider_name: result.providerName,
      provider_ref: result.providerRef,
      failure_reason: result.failureReason,
    })
    .eq("id", inserted.id);

  await writeAuditLog({
    adminUserId: admin.userId,
    action: "admin_communication_sent",
    targetType: targetType ?? "communication",
    targetId: targetId ?? inserted.id,
    result: finalStatus === "failed" ? "failure" : "success",
    metadata: { channel: params.channel, templateType, status: finalStatus },
  });

  return { ok: true, status: finalStatus };
}

export async function listCommunicationHistory(): Promise<{ data: CommunicationRecord[] } | { error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communication_history")
    .select("id, channel, recipient, template_type, status, provider_name, failure_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((r) => ({
      id: r.id,
      channel: r.channel,
      recipientMasked: r.channel === "email" ? maskEmail(r.recipient) : maskPhone(r.recipient),
      templateType: r.template_type,
      status: r.status,
      providerName: r.provider_name,
      failureReason: r.failure_reason,
      createdAt: r.created_at,
    })),
  };
}
