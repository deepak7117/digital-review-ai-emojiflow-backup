import type { Insight, RecommendedAction, ActionPriority } from "./types";
import type { SegmentConfig, RecommendationRule } from "@/lib/segments/types";
import { computePriorityLevel, computeTotalNegativeMentions } from "./priority";

/**
 * The Business Advisor turns Insight[] (from customerVoice.ts +
 * demandDetector.ts — deterministic, always available) into prioritized,
 * evidence-cited recommendations. This is deliberately a pure function of
 * Insight[]: it doesn't care whether an insight came from the deterministic
 * engine or a future AI-enhanced one, because both produce the same typed
 * shape with a required EvidenceRef (see types.ts). That's the seam a
 * future "AI Customer Brain" plugs into — it can enrich the Insight[] input
 * (e.g. by clustering more free-text demand signals) or generate a more
 * natural `why` sentence, but the priority ordering and evidence counts
 * below stay derived from real, counted data either way.
 *
 * Priority rules (transparent, not learned/opaque):
 *   1 = frustration signals (customers had a real problem) — most urgent
 *   2 = stock/request signals (unmet demand — a growth opportunity)
 *   3 = love signals (reinforce what's already working) + repeat intent
 */
function priorityForCategory(category: Insight["category"]): ActionPriority | null {
  if (category === "frustration") return 1;
  if (category === "stock" || category === "request") return 2;
  if (category === "love" || category === "repeat") return 3;
  return null; // "attention" is shown in the dashboard but isn't turned into a top action on its own
}

function titleFor(insight: Insight): string {
  switch (insight.category) {
    case "frustration":
      return `Address concerns about "${insight.label}"`;
    case "stock":
      return `Review availability: ${insight.label}`;
    case "request":
      return `Consider: ${insight.label}`;
    case "love":
      return `Keep doing what's working: ${insight.label}`;
    case "repeat":
      return "Nurture returning customers";
    default:
      return insight.label;
  }
}

function whyFor(insight: Insight): string {
  const { count } = insight.evidence;
  const trend =
    insight.trendPct !== null
      ? insight.trendPct > 0
        ? ` (up ${insight.trendPct}% vs the previous period)`
        : insight.trendPct < 0
          ? ` (down ${Math.abs(insight.trendPct)}% vs the previous period)`
          : ""
      : "";

  switch (insight.category) {
    case "frustration":
      return `${count} customers gave lower ratings mentioning "${insight.label}"${trend}.`;
    case "stock":
    case "request":
      return `${count} customers reported "${insight.label.toLowerCase()}"${trend}.`;
    case "love":
      return `${count} customers gave high ratings mentioning "${insight.label}"${trend}.`;
    case "repeat":
      return `${count} customers used language suggesting they may return${trend}.`;
    default:
      return `${count} customers mentioned this${trend}.`;
  }
}

/**
 * "What should I watch for if I act on this?" — Action Engine Milestone 1.
 * Same deterministic-template discipline as titleFor/whyFor: a plain
 * sentence describing what a future change in this insight's own
 * evidence.count would mean, never a prediction or a new metric.
 */
function expectedSignalFor(insight: Insight): string {
  switch (insight.category) {
    case "frustration":
      return `Customer mentions of "${insight.label}" should decrease.`;
    case "stock":
    case "request":
      return `Customer requests for "${insight.label}" should decrease as this is addressed.`;
    case "love":
      return `Positive mentions of "${insight.label}" should continue or increase.`;
    case "repeat":
      return "Language suggesting repeat visits should continue or increase.";
    default:
      return `Mentions of "${insight.label}" are worth continuing to monitor.`;
  }
}

/**
 * Finds the segment's recommendationRule (if any) whose watchesTag matches
 * this insight's label. Restricted to "frustration"-category insights on
 * purpose: every recommendationRule in the registry is written as guidance
 * for a real customer problem (e.g. "Address concerns about...", "Review
 * recent complaints..."). Applying that same problem-oriented wording to a
 * "love"-category insight of the same tag (a business can legitimately get
 * both glowing AND critical mentions of, say, "Staff Behaviour" in the same
 * period) would be actively misleading — it would tell an owner to "address
 * concerns" about something customers are actually praising. Returns null
 * (never a fabricated or mismatched rule) for every other category.
 */
function findMatchingRule(
  insight: Insight,
  segmentConfig: SegmentConfig | null
): RecommendationRule | null {
  if (!segmentConfig || insight.category !== "frustration") return null;
  return segmentConfig.recommendationRules.find((r) => r.watchesTag === insight.label) ?? null;
}

/**
 * Builds the full prioritized recommendation list. `statusByKey` lets the
 * caller merge in real "done" state from business_action_status without
 * this function needing to know anything about the database.
 *
 * `segmentConfig` (Module 7 Milestone C, optional — defaults to null so
 * every pre-Milestone-C call site keeps working unchanged): when provided,
 * and the business's segment has a `recommendationRules` entry watching an
 * insight's exact tag, that rule's `title`/`action` are used instead of the
 * generic template — turning "Address concerns about Waiting Time" into,
 * e.g., a restaurant-specific "Investigate peak-hour service delays" or a
 * dental-clinic-specific "Review appointment scheduling during peak hours"
 * for the SAME underlying tag. This is still a pure lookup over
 * already-computed Insight[] — it can never change an evidence count,
 * priority order, or which insights qualify as actions in the first place;
 * it only ever changes wording for insights that already passed the
 * deterministic thresholds in customerVoice.ts/demandDetector.ts.
 *
 * `periodLabel` (Action Engine Milestone 1, optional — defaults to a
 * generic string so every earlier call site keeps compiling unchanged):
 * the human-readable period the caller already computed the evidence over
 * (e.g. "Last 30 days", from getPeriodRange()) — attached to every action
 * unchanged, never recomputed or guessed here.
 */
export function buildRecommendedActions(
  insights: Insight[],
  statusByKey: Map<string, "open" | "in_progress" | "done"> = new Map(),
  segmentConfig: SegmentConfig | null = null,
  periodLabel: string = "the current period"
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const totalNegativeMentions = computeTotalNegativeMentions(insights);

  for (const insight of insights) {
    const priority = priorityForCategory(insight.category);
    if (priority === null) continue;

    const rule = findMatchingRule(insight, segmentConfig);
    const priorityLevel = computePriorityLevel(insight, totalNegativeMentions).level;

    actions.push({
      actionKey: insight.id,
      priority,
      priorityLevel,
      title: rule ? rule.title : titleFor(insight),
      why: whyFor(insight),
      recommendation: rule ? rule.action : undefined,
      evidence: insight.evidence,
      status: statusByKey.get(insight.id) ?? "open",
      expectedSignal: expectedSignalFor(insight),
      evidencePeriod: periodLabel,
    });
  }

  actions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.evidence.count - a.evidence.count;
  });

  return actions;
}

/** The "What should I do today?" card — the top N open actions, highest priority first. */
export function topActionsForToday(actions: RecommendedAction[], limit = 3): RecommendedAction[] {
  return actions.filter((a) => a.status === "open").slice(0, limit);
}
