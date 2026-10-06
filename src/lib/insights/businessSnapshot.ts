import type { Insight, RecommendedAction, InsightCategory } from "./types";
import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import { MIN_SAMPLE_SIZE } from "./types";

export type TrendDirection = "improving" | "worsening" | "stable";

export interface OverallTrend {
  direction: TrendDirection;
  /** Absolute difference in average rating vs the previous period. */
  delta: number;
}

/**
 * Compares this period's average rating to the previous period's raw
 * ratings. Returns null (not a fabricated "stable") when either period
 * lacks enough data to be meaningful — the previous period needs at least
 * MIN_SAMPLE_SIZE ratings of its own before a comparison is trustworthy.
 */
export function computeOverallTrend(
  currentAvgRating: number | null,
  previousRatings: number[]
): OverallTrend | null {
  if (currentAvgRating === null) return null;
  if (previousRatings.length < MIN_SAMPLE_SIZE) return null;

  const previousAvg = previousRatings.reduce((sum, r) => sum + r, 0) / previousRatings.length;
  const delta = Math.round((currentAvgRating - previousAvg) * 10) / 10;

  const direction: TrendDirection = delta > 0.2 ? "improving" : delta < -0.2 ? "worsening" : "stable";

  return { direction, delta: Math.abs(delta) };
}

export interface BusinessSnapshot {
  hasEnoughData: boolean;
  totalFeedback: number;
  loves: Insight | null;
  frustrates: Insight | null;
  needsAttention: Insight | null;
  nextAction: RecommendedAction | null;
  trend: OverallTrend | null;
}

function topOfCategory(insights: Insight[], category: InsightCategory): Insight | null {
  return (
    insights
      .filter((i) => i.category === category)
      .sort((a, b) => b.evidence.count - a.evidence.count)[0] ?? null
  );
}

/**
 * "If I only have 30 seconds, what should I know about my business?" — the
 * owner "wow" moment card. Every field is either a real top insight (by
 * count, already computed and threshold-gated upstream) or null — never a
 * fabricated placeholder when data is thin.
 */
export function computeBusinessSnapshot(
  analytics: FeedbackAnalytics,
  insights: Insight[],
  actions: RecommendedAction[],
  previousRatings: number[]
): BusinessSnapshot {
  const hasEnoughData = analytics.total >= MIN_SAMPLE_SIZE;

  if (!hasEnoughData) {
    return {
      hasEnoughData: false,
      totalFeedback: analytics.total,
      loves: null,
      frustrates: null,
      needsAttention: null,
      nextAction: null,
      trend: null,
    };
  }

  const nextAction =
    actions
      .filter((a) => a.status === "open")
      .sort((a, b) => a.priority - b.priority || b.evidence.count - a.evidence.count)[0] ?? null;

  return {
    hasEnoughData: true,
    totalFeedback: analytics.total,
    loves: topOfCategory(insights, "love"),
    frustrates: topOfCategory(insights, "frustration"),
    needsAttention: topOfCategory(insights, "attention"),
    nextAction,
    trend: computeOverallTrend(analytics.avgRating, previousRatings),
  };
}
