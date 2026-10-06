import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import { MIN_SAMPLE_SIZE } from "./types";

export interface ScoreFactor {
  label: string;
  /** Signed points this factor contributed to the final score (already applied). */
  contribution: number;
  detail: string;
}

export interface ExperienceScoreResult {
  /** null when there isn't enough data to be meaningful — never a fabricated placeholder score. */
  score: number | null;
  factors: ScoreFactor[];
  totalFeedback: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Fully transparent scoring formula — every point is traceable to a real,
 * already-computed number and shown in `factors`. Nothing here is an
 * opaque model output.
 *
 *   satisfaction   = (avgRating - 1) / 4 * 100         — 1★→0, 5★→100, linear (this IS the base, unweighted, so a perfect period scores exactly 100)
 *   lowRatingHit   = -(pct of 1-2★ ratings) * 0.3       — up to -30
 *   unmetDemandHit = -(unmetDemand / totalFeedback * 100) * 0.5, capped at -15
 *
 *   score = clamp(round(satisfaction + lowRatingHit + unmetDemandHit), 0, 100)
 */
export function computeExperienceScore(
  analytics: FeedbackAnalytics,
  unmetDemandCount: number
): ExperienceScoreResult {
  if (analytics.total < MIN_SAMPLE_SIZE || analytics.avgRating === null) {
    return { score: null, factors: [], totalFeedback: analytics.total };
  }

  const satisfactionRaw = ((analytics.avgRating - 1) / 4) * 100;
  const satisfactionContribution = Math.round(satisfactionRaw);

  const lowRatingPct =
    (analytics.distribution.find((d) => d.rating === 1)?.pct ?? 0) +
    (analytics.distribution.find((d) => d.rating === 2)?.pct ?? 0);
  const lowRatingContribution = -Math.round(lowRatingPct * 0.3);

  const unmetDemandRate = unmetDemandCount / analytics.total;
  const unmetDemandContribution = -Math.min(15, Math.round(unmetDemandRate * 100 * 0.5));

  const rawScore = satisfactionContribution + lowRatingContribution + unmetDemandContribution;
  const score = clamp(rawScore, 0, 100);

  const factors: ScoreFactor[] = [
    {
      label: "Average rating",
      contribution: satisfactionContribution,
      detail: `Average rating of ${analytics.avgRating}★ across ${analytics.total} submissions.`,
    },
    {
      label: "Low ratings (1–2★)",
      contribution: lowRatingContribution,
      detail:
        lowRatingPct > 0
          ? `${lowRatingPct}% of feedback was 1 or 2 stars.`
          : "No 1 or 2 star ratings in this period.",
    },
    {
      label: "Unmet demand reports",
      contribution: unmetDemandContribution,
      detail:
        unmetDemandCount > 0
          ? `${unmetDemandCount} customers reported something they wanted but couldn't find.`
          : "No unmet demand reports in this period.",
    },
  ];

  return { score, factors, totalFeedback: analytics.total };
}
