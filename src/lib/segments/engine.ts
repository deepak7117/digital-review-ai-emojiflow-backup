import type { Industry, SegmentConfig, PulseQuestionTemplate } from "./types";
import { INDUSTRIES, SEGMENTS } from "./registry";

/** All industries currently in the registry, in display order. */
export function getIndustries(): Industry[] {
  return INDUSTRIES;
}

/** All segments belonging to an industry. Empty array (not an error) for an unknown industry. */
export function getSegmentsForIndustry(industrySlug: string): SegmentConfig[] {
  return SEGMENTS.filter((s) => s.industrySlug === industrySlug);
}

/** The full config for one industry+segment pair, or null if it doesn't exist. */
export function getSegmentConfig(industrySlug: string, segmentSlug: string): SegmentConfig | null {
  return (
    SEGMENTS.find((s) => s.industrySlug === industrySlug && s.segmentSlug === segmentSlug) ?? null
  );
}

/** Every segment across every industry — mainly for admin/listing use, not per-business lookups. */
export function getAllSegments(): SegmentConfig[] {
  return SEGMENTS;
}

/** Whether an industry+segment pair is a real, known combination. */
export function isValidSegment(industrySlug: string, segmentSlug: string): boolean {
  return getSegmentConfig(industrySlug, segmentSlug) !== null;
}

/**
 * The Pulse question templates a business in this segment can offer —
 * "question generation" per the Milestone A brief. Currently a direct
 * pass-through of the registry data; kept as its own function (rather than
 * inlining `config.pulseQuestionTemplates` everywhere) so a future
 * milestone can add real generation logic (e.g. picking the most relevant
 * subset based on the business's actual data) without changing every call
 * site.
 */
export function generateSegmentPulseQuestions(config: SegmentConfig): PulseQuestionTemplate[] {
  return config.pulseQuestionTemplates;
}

/**
 * The merged, deduplicated tag list for a segment — "feedback tag mapping"
 * per the Milestone A brief. This is what replaces Module 2's generic
 * DEFAULT_FEEDBACK_TAGS for a business that has picked a segment.
 */
export function getFeedbackTagsForSegment(config: SegmentConfig): string[] {
  const merged = [...config.feedbackTags.positive, ...config.feedbackTags.negative];
  return Array.from(new Set(merged));
}
