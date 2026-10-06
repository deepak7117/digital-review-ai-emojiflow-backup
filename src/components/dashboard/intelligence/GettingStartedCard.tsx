import Link from "next/link";

/**
 * The honest empty/low-data state. Per the Milestone D spec: never a fake
 * "92/100 health score" — instead a clear "not enough data yet" message
 * plus real, actionable next steps.
 */
export function GettingStartedCard({
  currentCount,
  neededCount,
  hasBusinessName,
}: {
  currentCount: number;
  neededCount: number;
  hasBusinessName: boolean;
}) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border-strong p-8">
      <p className="text-center font-display text-base font-semibold text-ink">
        Your Customer Intelligence is getting started
      </p>
      <p className="mt-2 text-center text-sm text-slate">
        {currentCount > 0
          ? `${currentCount} of ${neededCount} submissions needed to unlock reliable insights.`
          : "Collect more customer feedback to unlock reliable business insights."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/qr-feedback"
          className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs text-center transition-colors hover:border-verified"
        >
          <p className="text-sm font-medium text-ink">Share your feedback link</p>
          <p className="mt-1 text-xs text-slate">Get your QR code or copy the link</p>
        </Link>
        <Link
          href="/dashboard/pulse"
          className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs text-center transition-colors hover:border-verified"
        >
          <p className="text-sm font-medium text-ink">Create a Pulse poll</p>
          <p className="mt-1 text-xs text-slate">Ask customers one quick question</p>
        </Link>
        <Link
          href="/dashboard/profile"
          className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs text-center transition-colors hover:border-verified"
        >
          <p className="text-sm font-medium text-ink">
            {hasBusinessName ? "Review your business profile" : "Complete your business profile"}
          </p>
          <p className="mt-1 text-xs text-slate">Pick your segment for tailored insights</p>
        </Link>
      </div>
    </div>
  );
}
