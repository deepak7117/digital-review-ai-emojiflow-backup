import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 ${i < rating ? "fill-gold" : "fill-none stroke-border-strong"}`}
          strokeWidth={i < rating ? 0 : 1.5}
        >
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
        </svg>
      ))}
    </div>
  );
}

function formatWeekLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso)
  );
}

export function RatingDistributionChart({
  distribution,
}: {
  distribution: FeedbackAnalytics["distribution"];
}) {
  const max = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2.5">
      {distribution
        .slice()
        .reverse()
        .map((bucket) => (
          <div key={bucket.rating} className="flex items-center gap-3">
            <div className="w-16 shrink-0">
              <StarRow rating={bucket.rating} />
            </div>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.max(2, (bucket.count / max) * 100)}%` }}
              />
            </div>
            <div className="w-16 shrink-0 text-right font-mono text-xs text-slate">
              {bucket.count} ({bucket.pct}%)
            </div>
          </div>
        ))}
    </div>
  );
}

export function WeeklyTrendChart({ weeklyTrend }: { weeklyTrend: FeedbackAnalytics["weeklyTrend"] }) {
  const maxCount = Math.max(1, ...weeklyTrend.map((w) => w.count));

  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {weeklyTrend.map((week) => (
          <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-24 w-full items-end">
              <div
                className={`w-full rounded-t ${week.count > 0 ? "bg-verified" : "bg-border"}`}
                style={{
                  height: week.count > 0 ? `${Math.max(6, (week.count / maxCount) * 100)}%` : "2px",
                }}
                title={
                  week.count > 0
                    ? `${week.count} submission${week.count === 1 ? "" : "s"}, avg ${week.avgRating}★`
                    : "No submissions"
                }
              />
            </div>
            <span className="font-mono text-[9px] text-slate">{week.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {weeklyTrend.map((week) => (
          <span
            key={week.weekStart}
            className="flex-1 text-center font-mono text-[9px] uppercase tracking-wider text-slate/70"
          >
            {formatWeekLabel(week.weekStart)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TagBreakdownList({ tagBreakdown }: { tagBreakdown: FeedbackAnalytics["tagBreakdown"] }) {
  if (tagBreakdown.length === 0) {
    return <p className="text-sm text-slate">No tags have been selected in feedback yet.</p>;
  }

  const max = Math.max(1, ...tagBreakdown.map((t) => t.count));

  return (
    <ul className="flex flex-col gap-2.5">
      {tagBreakdown.map((tag) => (
        <li key={tag.tag} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-ink-soft">{tag.tag}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-verified"
              style={{ width: `${Math.max(2, (tag.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-xs text-slate">
            {tag.count} · {tag.avgRating}★
          </span>
        </li>
      ))}
    </ul>
  );
}
