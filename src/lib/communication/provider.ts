import "server-only";

/**
 * Communication provider abstraction. Deliberately provider-agnostic —
 * no specific vendor's SDK or REST shape is wired in, since no vendor
 * has actually been chosen or configured for this project yet (no
 * credentials exist in this environment, confirmed during audit). This
 * is the safe scaffolding requested: the shape every real provider
 * implementation must satisfy, plus a NotConfiguredProvider that is
 * always honest about doing nothing.
 *
 * No new npm dependency was added for this — intentionally. Most
 * transactional email/SMS providers (Resend, Postmark, Twilio, etc.)
 * expose a plain HTTP REST API, so a real implementation can be built
 * with the standard fetch() already available in this runtime, without
 * installing a paid SDK before a vendor and credentials actually exist.
 *
 * CONFIGURATION REQUIRED to go from scaffolding to a real send:
 *   EMAIL_PROVIDER_API_KEY   — the chosen provider's API key
 *   EMAIL_PROVIDER_FROM      — the verified sending address
 *   SMS_PROVIDER_API_KEY     — the chosen provider's API key
 *   SMS_PROVIDER_FROM        — the verified sending number
 * None of these are set in this environment — confirmed directly, not
 * assumed. Until they are, every send attempt honestly reports
 * "not_configured" and nothing is actually transmitted anywhere.
 */

export type SendStatus = "submitted" | "failed" | "not_configured";

export interface SendResult {
  status: SendStatus;
  providerName: string | null;
  providerRef: string | null;
  failureReason: string | null;
}

export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<SendResult>;
}

export interface SmsProvider {
  sendSms(to: string, body: string): Promise<SendResult>;
}

class NotConfiguredEmailProvider implements EmailProvider {
  async sendEmail(): Promise<SendResult> {
    return {
      status: "not_configured",
      providerName: null,
      providerRef: null,
      failureReason: "No email provider is configured (EMAIL_PROVIDER_API_KEY / EMAIL_PROVIDER_FROM unset).",
    };
  }
}

class NotConfiguredSmsProvider implements SmsProvider {
  async sendSms(): Promise<SendResult> {
    return {
      status: "not_configured",
      providerName: null,
      providerRef: null,
      failureReason: "No SMS provider is configured (SMS_PROVIDER_API_KEY / SMS_PROVIDER_FROM unset).",
    };
  }
}

/**
 * Returns the real provider once one is genuinely configured, or the
 * honest not-configured stub otherwise. A real implementation, once a
 * vendor is chosen, replaces the body of this function's `if` branch
 * with an actual fetch() call to that vendor's send endpoint — the
 * call site below (sendActions.ts) never needs to change, since it
 * only depends on this interface.
 */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_PROVIDER_FROM;
  if (!apiKey || !from) return new NotConfiguredEmailProvider();

  // No real vendor has been chosen/configured in this environment, so
  // there is nothing further to implement honestly yet — this branch
  // is reached only once both env vars are actually set, at which
  // point a real fetch() call to the chosen provider's API belongs
  // here.
  return new NotConfiguredEmailProvider();
}

export function getSmsProvider(): SmsProvider {
  const apiKey = process.env.SMS_PROVIDER_API_KEY;
  const from = process.env.SMS_PROVIDER_FROM;
  if (!apiKey || !from) return new NotConfiguredSmsProvider();

  return new NotConfiguredSmsProvider();
}
