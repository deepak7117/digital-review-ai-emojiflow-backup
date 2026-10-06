import Link from "next/link";
import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import type { ExperienceScoreResult } from "@/lib/insights/experienceScore";
import type { RecommendedAction } from "@/lib/insights/types";

/**
 * The dashboard's premium "at a glance" hero grid — every value here comes
 * from the same already-computed, already-tested pipeline the Customer
 * Intelligence page uses (computeFeedbackAnalytics, computeExperienceScore,
 * businessAdvisor's actions). Nothing here is a separate/duplicated data
 * source, and nothing is a placeholder number — nulls render as honest
 * "not enough data" states, never a fabricated figure.
 */

type Tone = "verified" | "gold" | "danger" | "slate";

const TONE_CLASSES: Record<Tone, { border: string; bg: string; text: string }> = {
  verified: { border: "border-verified/25", bg: "bg-verified-tint", text: "text-verified-dark" },
  gold: { border: "border-gold/30", bg: "bg-gold-tint", text: "text-gold" },
  danger: { border: "border-danger/25", bg: "bg-danger-tint", text: "text-danger" },
  slate: { border: "border-border-strong", bg: "bg-paper-raised", text: "text-ink-soft" },
};

function HeroCard({
  emoji,
  label,
  tone,
  href,
  children,
}: {
  emoji: string;
  label: string;
  tone: Tone;
  href: string;
  children: React.ReactNode;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <Link
      href={href}
      className={`block rounded-xl border ${t.border} ${t.bg} p-5 transition-transform hover:-translate-y-0.5`}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
        {emoji} {label}
      </p>
      <div className={`mt-2 ${t.text}`}>{children}</div>
    </Link>
  );
}

function scoreTone(score: number): Tone {
  if (score >= 70) return "verified";
  if (score >= 40) return "gold";
  return "danger";
}

function sentimentFromRating(avgRating: number): { label: string; emoji: string; tone: Tone } {
  if (avgRating >= 4) return { label: "Positive", emoji: "😊", tone: "verified" };
  if (avgRating <= 2) return { label: "Needs improvement", emoji: "😟", tone: "danger" };
  return { label: "Mixed", emoji: "😐", tone: "gold" };
}

function weeklyTrendDirection(weeklyTrend: FeedbackAnalytics["weeklyTrend"]): {
  label: string;
  arrow: string;
  tone: Tone;
} {
  const len = weeklyTrend.length;
  if (len < 2) return { label: "Not enough data", arrow: "→", tone: "slate" };
  const last = weeklyTrend[len - 1].count;
  const prev = weeklyTrend[len - 2].count;
  if (last > prev) return { label: `Up from ${prev} to ${last} this week`, arrow: "↑", tone: "verified" };
  if (last < prev) return { label: `Down from ${prev} to ${last} this week`, arrow: "↓", tone: "gold" };
  return { label: `Steady at ${last} this week`, arrow: "→", tone: "slate" };
}

export function DashboardHeroCards({
  score,
  analytics,
  topAction,
}: {
  score: ExperienceScoreResult;
  analytics: FeedbackAnalytics;
  topAction: RecommendedAction | null;
}) {
  const sentiment = analytics.avgRating !== null ? sentimentFromRating(analytics.avgRating) : null;
  const trend = weeklyTrendDirection(analytics.weeklyTrend);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <HeroCard emoji="⭐" label="Experience Score" tone={score.score !== null ? scoreTone(score.score) : "slate"} href="/dashboard/intelligence">
        {score.score !== null ? (
          <p className="text-2xl font-semibold">{score.score}/100</p>
        ) : (
          <p className="text-sm">Not enough data yet</p>
        )}
      </HeroCard>

      <HeroCard emoji={sentiment?.emoji ?? "😐"} label="Customer Sentiment" tone={sentiment?.tone ?? "slate"} href="/dashboard/intelligence">
        <p className="text-lg font-semibold">{sentiment?.label ?? "Not enough data yet"}</p>
      </HeroCard>

      <HeroCard emoji="💬" label="Customer Voice" tone="slate" href="/dashboard/feedback">
        <p className="text-2xl font-semibold text-ink">{analytics.total}</p>
        <p className="text-xs text-slate">submissions in the last 30 days</p>
      </HeroCard>

      <HeroCard
        emoji="⚠️"
        label="Needs Attention"
        tone={topAction && topAction.priority === 1 ? "danger" : "slate"}
        href="/dashboard/intelligence"
      >
        <p className="text-sm font-medium">
          {topAction ? topAction.title : "Nothing urgent right now"}
        </p>
      </HeroCard>

      <HeroCard emoji="📈" label="Feedback Trend" tone={trend.tone} href="/dashboard/analytics">
        <p className="text-lg font-semibold">
          {trend.arrow} {trend.label}
        </p>
      </HeroCard>

      <HeroCard emoji="💡" label="AI Recommendation" tone="slate" href="/dashboard/intelligence">
        <p className="text-sm font-medium">
          {topAction ? topAction.recommendation ?? topAction.why : "No recommendations yet"}
        </p>
      </HeroCard>
    </div>
  );
}
