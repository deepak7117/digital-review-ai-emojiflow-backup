/**
 * Business Segment Engine — type contracts (Milestone A).
 *
 * This is the seam the whole "Business Reputation OS" direction is built
 * around: ONE engine, driven by structured data, not 1,000 hand-built
 * applications. Adding segment #11 through #1000 later means adding
 * entries to registry.ts (or, eventually, rows in a database-backed
 * catalog with the same shape) — never writing new UI or business logic
 * per segment.
 *
 * Deliberately code-based (not DB-backed) for Milestone A: it keeps the
 * engine trivially unit-testable with zero database dependency and lets
 * the config live in version control. A future milestone can move this to
 * a `segment_configs` table with the same shape once the product needs
 * runtime-editable segments (e.g. an admin UI) — see the Module 7 report
 * for this documented as a deliberate, not accidental, scope boundary.
 */

export interface Industry {
  slug: string;
  name: string;
}

export interface FeedbackTagSet {
  positive: string[];
  negative: string[];
}

export interface PulseQuestionTemplate {
  question: string;
  options: string[];
}

export interface SegmentMetric {
  key: string;
  label: string;
}

/**
 * A rule the recommendation engine uses to turn a recurring negative tag
 * into a prioritized action (see Module 7 Milestone C —
 * src/lib/insights/businessAdvisor.ts).
 */
export interface RecommendationRule {
  watchesTag: string;
  title: string;
  action: string;
}

export interface SegmentConfig {
  industrySlug: string;
  segmentSlug: string;
  displayName: string;
  description: string;
  /** What this business calls its customers — "guests", "patients", "clients", etc. */
  customerTerminology: string;
  feedbackTags: FeedbackTagSet;
  metrics: SegmentMetric[];
  pulseQuestionTemplates: PulseQuestionTemplate[];
  /** Prompts a future "Ask Your Business" feature can offer as starting points. */
  customerQuestions: string[];
  recommendationRules: RecommendationRule[];
}
