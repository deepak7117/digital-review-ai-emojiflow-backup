import type { Insight, InsightCategory } from "@/lib/insights/types";

const CATEGORY_META: Record<InsightCategory, { emoji: string; title: string; tone: string }> = {
  love: { emoji: "🔥", title: "What Customers Love", tone: "border-verified/25 bg-verified-tint" },
  attention: { emoji: "😐", title: "What Needs Attention", tone: "border-gold/30 bg-gold-tint" },
  frustration: { emoji: "🚨", title: "What's Frustrating Customers", tone: "border-danger/25 bg-danger-tint" },
  request: { emoji: "💡", title: "What Customers Want", tone: "border-border-strong bg-paper-raised" },
  stock: { emoji: "📦", title: "Demand & Unmet Needs", tone: "border-border-strong bg-paper-raised" },
  repeat: { emoji: "🔁", title: "Repeat Intent", tone: "border-border-strong bg-paper-raised" },
};

function TrendBadge({ trendPct }: { trendPct: number | null }) {
  if (trendPct === null) return null;
  const up = trendPct > 0;
  const flat = trendPct === 0;
  return (
    <span
      className={`font-mono text-xs ${flat ? "text-slate" : up ? "text-danger" : "text-verified"}`}
    >
      {flat ? "→ flat" : `${up ? "↑" : "↓"} ${Math.abs(trendPct)}%`}
    </span>
  );
}

export function InsightCard({ insight }: { insight: Insight }) {
  const { count, outOf, label: evidenceLabel } = insight.evidence;
  const pct = outOf > 0 ? Math.round((count / outOf) * 100) : 0;

  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-sm font-semibold text-ink">{insight.label}</p>
        <TrendBadge trendPct={insight.trendPct} />
      </div>
      <p className="mt-1 text-xs text-slate">
        {count} of {outOf} ({pct}%) — {evidenceLabel}
      </p>
      {insight.exampleSnippets.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {insight.exampleSnippets.map((snippet, i) => (
            <li key={i} className="border-l-2 border-border-strong pl-2.5 text-xs italic text-ink-soft">
              &ldquo;{snippet}&rdquo;
            </li>
          ))}
        </ul>
      )}
      {insight.source === "ai-enhanced" && (
        <span className="mt-2 inline-block font-mono text-[9px] uppercase tracking-wider text-verified">
          AI-enhanced
        </span>
      )}
    </div>
  );
}

export function InsightGroup({
  category,
  insights,
}: {
  category: InsightCategory;
  insights: Insight[];
}) {
  const meta = CATEGORY_META[category];
  const grouped = insights.filter((i) => i.category === category);

  if (grouped.length === 0) return null;

  return (
    <div className={`rounded-xl border p-5 ${meta.tone}`}>
      <p className="font-display text-sm font-semibold text-ink">
        {meta.emoji} {meta.title}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {grouped.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
