import type { Insight, PriorityLevel } from "./types";

export type { PriorityLevel };


/**
 * Deterministic priority thresholds — defined here, not learned or
 * inferred. Applies only to insights that already passed MIN_SIGNAL_COUNT
 * (see types.ts) — an insight below that threshold never reaches this
 * function because customerVoice.ts/demandDetector.ts already excluded it.
 *
 *  frustration:
 *    count >= CRITICAL_COUNT (15) OR share of all frustration mentions >= 40%  -> Critical
 *    count >= HIGH_COUNT (8)      OR share >= 20%                              -> High
 *    otherwise                                                                 -> Medium
 *  attention (mixed sentiment, not clearly a problem or a win):
 *    always Medium
 *  stock / request (unmet demand / growth opportunities):
 *    always Low (worth noting, not urgent the way a real complaint is)
 *  love / repeat (positive signals, nothing to fix):
 *    always Monitor (worth watching/reinforcing, not acting on urgently)
 */
const CRITICAL_COUNT = 15;
const HIGH_COUNT = 8;
const CRITICAL_SHARE = 0.4;
const HIGH_SHARE = 0.2;

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  monitor: "Monitor",
};

export interface PriorityResult {
  level: PriorityLevel;
  label: string;
  /** Percentage of all frustration-category mentions this insight represents — null when not applicable (non-frustration categories, or zero total). */
  pctOfNegative: number | null;
}

export function computePriorityLevel(insight: Insight, totalNegativeMentions: number): PriorityResult {
  const { count } = insight.evidence;

  if (insight.category === "frustration") {
    const pctOfNegative = totalNegativeMentions > 0 ? count / totalNegativeMentions : null;
    const share = pctOfNegative ?? 0;

    let level: PriorityLevel;
    if (count >= CRITICAL_COUNT || share >= CRITICAL_SHARE) {
      level = "critical";
    } else if (count >= HIGH_COUNT || share >= HIGH_SHARE) {
      level = "high";
    } else {
      level = "medium";
    }

    return {
      level,
      label: PRIORITY_LABELS[level],
      pctOfNegative: pctOfNegative !== null ? Math.round(pctOfNegative * 100) : null,
    };
  }

  if (insight.category === "attention") {
    return { level: "medium", label: PRIORITY_LABELS.medium, pctOfNegative: null };
  }

  if (insight.category === "stock" || insight.category === "request") {
    return { level: "low", label: PRIORITY_LABELS.low, pctOfNegative: null };
  }

  // love / repeat
  return { level: "monitor", label: PRIORITY_LABELS.monitor, pctOfNegative: null };
}

/** Sum of evidence counts across all frustration-category insights — the denominator for pctOfNegative above. */
export function computeTotalNegativeMentions(insights: Insight[]): number {
  return insights
    .filter((i) => i.category === "frustration")
    .reduce((sum, i) => sum + i.evidence.count, 0);
}
