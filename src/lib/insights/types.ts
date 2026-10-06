/**
 * Customer Intelligence — shared insight contract.
 *
 * This is the seam Module 6 is built around: every insight, regardless of
 * whether it comes from the deterministic engine (src/lib/insights/*) or a
 * future AI enhancement layer (src/lib/ai/customerVoiceEnhancer.ts), is
 * shaped as an Insight with a required EvidenceRef. That's a structural
 * guarantee, not a convention someone can forget — TypeScript won't let you
 * construct an Insight without a count and a label backing it.
 *
 * The rule this enforces: an AI layer may help *find* or *phrase* an
 * insight, but the `evidence.count` must always be produced by actually
 * counting rows that match, in this codebase, not by trusting a number the
 * model claims. See src/lib/ai/customerVoiceEnhancer.ts for how the
 * boundary keeps that true even when AI is enabled.
 */

export type InsightSource = "deterministic" | "ai-enhanced";

export interface EvidenceRef {
  /** Actual count of matching submissions/reports — always computed, never AI-supplied. */
  count: number;
  /** Total the count is out of, for percentage display (e.g. total submissions in the window). */
  outOf: number;
  /** Human label for the count, e.g. "customers mentioned this". */
  label: string;
}

export type InsightCategory =
  | "love" // ❤️ what customers love
  | "attention" // 😐 what needs improved
  | "frustration" // 🚨 frustrating customers
  | "request" // 💡 requests
  | "stock" // 📦 unmet demand / things to stock
  | "repeat"; // 🔁 possible repeat intent

export interface Insight {
  /** Stable, deterministic key (e.g. "love:Service") — used for the action loop, not random. */
  id: string;
  category: InsightCategory;
  label: string;
  evidence: EvidenceRef;
  /** Percentage change vs the immediately preceding period of equal length. Null if insufficient data in either window. */
  trendPct: number | null;
  /** Short, anonymized excerpts — no names, no contact info, truncated. */
  exampleSnippets: string[];
  source: InsightSource;
}

export type ActionPriority = 1 | 2 | 3;

/**
 * Finer-grained priority classification (Module 7 Milestone D) — see
 * src/lib/insights/priority.ts for the deterministic thresholds. Distinct
 * from ActionPriority (the coarse 1/2/3 tier used for sort order): this is
 * the richer Critical/High/Medium/Low/Monitor label shown to the owner.
 */
export type PriorityLevel = "critical" | "high" | "medium" | "low" | "monitor";

export interface RecommendedAction {
  /** Deterministic key persisted in business_action_status — must stay stable across recomputation. */
  actionKey: string;
  priority: ActionPriority;
  priorityLevel: PriorityLevel;
  title: string;
  why: string;
  /**
   * Segment-specific suggested action text (Module 7 Milestone C) — present
   * only when the business has a selected segment AND that segment's
   * `recommendationRules` includes a rule watching this insight's tag.
   * Undefined (not a fabricated generic string) otherwise — callers should
   * fall back to displaying `why` alone in that case.
   */
  recommendation?: string;
  evidence: EvidenceRef;
  /** Widened to a 3-state lifecycle in Action Engine Milestone 2. Existing callers checking `=== "done"` (RecommendationsPanel.tsx) are unaffected — "in_progress" correctly falls through to their existing "not done" handling. */
  status: "open" | "in_progress" | "done";
  /**
   * Module 7 Action Engine Milestone 1 — deterministic, generated the same
   * way title/why already are (see businessAdvisor.ts's expectedSignalFor).
   * Never a new intelligence source: purely a template sentence describing
   * what a change in the underlying evidence.count would mean.
   */
  expectedSignal: string;
  /** The human-readable period this action's evidence was computed over (e.g. "Last 30 days") — passed in by the caller, not invented here. */
  evidencePeriod: string;
}

/** The minimum number of submissions before ANY insight/score is shown at all. */
export const MIN_SAMPLE_SIZE = 5;

/** The minimum count an individual insight/demand signal needs before it's surfaced on its own. */
export const MIN_SIGNAL_COUNT = 3;
