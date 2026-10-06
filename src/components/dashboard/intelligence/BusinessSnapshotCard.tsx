import type { BusinessSnapshot } from "@/lib/insights/businessSnapshot";

function SnapshotRow({
  emoji,
  label,
  value,
  detail,
}: {
  emoji: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg leading-none" aria-hidden="true">
        {emoji}
      </span>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
        {detail && <p className="text-xs text-slate">{detail}</p>}
      </div>
    </div>
  );
}

function trendLine(snapshot: BusinessSnapshot): string | null {
  if (!snapshot.trend) return null;
  if (snapshot.trend.direction === "stable") return "Rating trend is stable vs the previous period.";
  const verb = snapshot.trend.direction === "improving" ? "improved" : "declined";
  return `Average rating has ${verb} by ${snapshot.trend.delta} vs the previous period.`;
}

/**
 * "If I only have 30 seconds, what should I know about my business?" —
 * every field is either a real top insight (already threshold-gated
 * upstream) or an honest "not enough data" fallback. Nothing here is
 * fabricated to fill a slot.
 */
export function BusinessSnapshotCard({ snapshot }: { snapshot: BusinessSnapshot }) {
  if (!snapshot.hasEnoughData) return null;

  const trend = trendLine(snapshot);

  return (
    <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
        Your Business Snapshot
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SnapshotRow
          emoji="❤️"
          label="What customers love"
          value={snapshot.loves ? snapshot.loves.label : "Not enough data yet"}
          detail={snapshot.loves ? `${snapshot.loves.evidence.count} mentions` : undefined}
        />
        <SnapshotRow
          emoji="🚨"
          label="What frustrates them"
          value={snapshot.frustrates ? snapshot.frustrates.label : "Nothing significant right now"}
          detail={snapshot.frustrates ? `${snapshot.frustrates.evidence.count} mentions` : undefined}
        />
        <SnapshotRow
          emoji="😐"
          label="What needs attention"
          value={snapshot.needsAttention ? snapshot.needsAttention.label : "Nothing flagged right now"}
          detail={snapshot.needsAttention ? `${snapshot.needsAttention.evidence.count} mentions` : undefined}
        />
        <SnapshotRow
          emoji="🎯"
          label="What to do next"
          value={snapshot.nextAction ? snapshot.nextAction.title : "You're all caught up"}
          detail={snapshot.nextAction ? snapshot.nextAction.why : undefined}
        />
      </div>
      {trend && <p className="mt-4 text-xs text-slate">{trend}</p>}
    </div>
  );
}
