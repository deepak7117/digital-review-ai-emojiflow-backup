"use client";

import type { ContactDestination } from "@/lib/config/contact";

const MESSAGES: Record<string, { title: string; body: string }> = {
  limit_reached: {
    title: "You've reached your business limit.",
    body: "Upgrade your plan to add another business.",
  },
  disabled: {
    title: "Additional business access isn't included in your current plan.",
    body: "Upgrade your plan to add another business.",
  },
  subscription_blocked: {
    title: "Your account access is currently restricted.",
    body: "Contact Banao Digital for assistance.",
  },
};

export function UpgradeContactState({
  reason,
  contact,
}: {
  reason: "limit_reached" | "disabled" | "subscription_blocked";
  contact: ContactDestination;
}) {
  const copy = MESSAGES[reason] ?? MESSAGES.limit_reached;
  const hasAnyContact = Boolean(contact.whatsappUrl || contact.contactUrl);

  return (
    <div className="rounded-[var(--radius-md)] border border-gold/25 bg-gold-tint p-4 text-sm">
      <p className="font-medium text-ink">{copy.title}</p>
      <p className="mt-1 text-ink-soft">{copy.body}</p>

      {hasAnyContact ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {contact.whatsappUrl && (
            <a
              href={contact.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-sm)] bg-verified px-3.5 py-1.5 text-xs font-medium text-white shadow-sm"
            >
              Upgrade via WhatsApp
            </a>
          )}
          {contact.contactUrl && (
            <a
              href={contact.contactUrl}
              className="rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-3.5 py-1.5 text-xs font-medium text-ink-soft"
            >
              Contact Banao Digital
            </a>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate">
          Contact details aren&rsquo;t configured yet — ask your Banao Digital representative directly.
        </p>
      )}
    </div>
  );
}
