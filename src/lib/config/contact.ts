/**
 * Banao Digital contact destination for the "upgrade your plan" flow.
 *
 * CONFIGURATION REQUIRED: no WhatsApp number or contact destination for
 * Banao Digital exists anywhere in this codebase — confirmed during the
 * Master Implementation Plan's inspection phase. The values below are
 * environment-variable driven placeholders, never hard-coded fake
 * contact information. Until real values are set, the "Upgrade via
 * WhatsApp" action is hidden and only the Banao Digital contact link
 * (falling back to a mailto, which doesn't require a vetted number) is
 * shown.
 *
 * Required from the Product Owner before this is fully live:
 *   BANAO_WHATSAPP_NUMBER        — full international format, e.g. "15551234567" (no +, no spaces)
 *   BANAO_CONTACT_EMAIL          — support/sales inbox to receive these upgrade requests
 */

export interface ContactDestination {
  whatsappUrl: string | null;
  contactUrl: string | null;
}

/**
 * Returns null for a destination whenever its underlying env var isn't
 * set — never a guessed fallback address. A UI consuming this must
 * handle both being null (hide that action, or show a "contact details
 * not yet configured" note) rather than assume one is always present.
 */
export function getBanaoContactDestination(): ContactDestination {
  const whatsappNumber = process.env.BANAO_WHATSAPP_NUMBER;
  const contactEmail = process.env.BANAO_CONTACT_EMAIL;

  return {
    whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
    contactUrl: contactEmail
      ? `mailto:${contactEmail}?subject=${encodeURIComponent("BD Clarity — Upgrade my plan")}`
      : null,
  };
}
